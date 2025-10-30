from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, DefaultDict, Tuple
from collections import defaultdict
import re

from app.schemas.review import ReviewCreate, ReviewResponse
from app.services import scraper, analysis

router = APIRouter()

# Simple aspect keywords mapping for MVP (tweak/add keywords per category)
ASPECT_KEYWORDS: Dict[str, List[str]] = {
    "battery": ["battery", "battery life", "charge", "charging"],
    "sound": ["sound", "bass", "treble", "audio", "microphone", "mic"],
    "build": ["build", "quality", "material", "durable", "broken"],
    "design": ["design", "look", "style", "color"],
    "value": ["price", "value", "expensive", "cheap", "cost"],
    "delivery": ["delivery", "shipping", "packaging"],
    "support": ["support", "warranty", "service", "customer support"],
    # add more as you learn frequent aspects
}

def extract_aspects(text: str) -> List[str]:
    if not text:
        return []
    lower = text.lower()
    found: List[str] = []
    for aspect, keywords in ASPECT_KEYWORDS.items():
        for kw in keywords:
            if kw in lower:
                found.append(aspect)
                break
    # return unique aspect list
    return list(dict.fromkeys(found))

# Heuristic to decide whether a text chunk looks like a user review
def is_likely_review(text: str) -> bool:
    if not text:
        return False
    t = text.strip()
    # must be reasonably long
    if len(t) < 40:
        return False
    low = t.lower()
    # reject obvious boilerplate / product listing text
    for bad in ("bank offer", "available offers", "special price", "add to cart", "delivery by", "ratings & reviews", "secure delivery", "offers", "cashback", "seller", "specifications", "product description", "about this item", "warranty", "return policy"):
        if bad in low:
            return False
    # accept patterns often found in reviews
    review_indicators = ("certified buyer", "verified", "read more", "permalink", "★", "stars", "helpful", "reviewed", "review by")
    if any(ind in low for ind in review_indicators):
        return True
    # accept natural language sentences with punctuation and personal pronouns
    if re.search(r"[A-Za-z]{2,}\s+[A-Za-z]{2,}", t) and (("." in t or "!" in t or "?" in t) and any(w in low for w in ("i", "my", "me", "we", "they", "he", "she", "battery", "sound", "price", "quality", "work", "broke", "good", "bad"))):
        return True
    return False

@router.post("/reviews/", response_model=ReviewResponse)
async def analyze_review(review: ReviewCreate):
    try:
        scraped_reviews: List[str] = scraper.scrape_reviews(review.url) or []
        filtered_reviews = [r for r in scraped_reviews if is_likely_review(r)]

        if not filtered_reviews:
            raise HTTPException(
                status_code=400,
                detail="No reviews detected on the provided URL. Make sure you supplied a product/reviews page (not a homepage or listing)."
            )

        raw_results: List[Dict[str, Any]] = analysis.analyze_sentiment(filtered_reviews)

        reviews_out: List[Dict[str, Any]] = []
        for i, text in enumerate(filtered_reviews):
            res = raw_results[i] if i < len(raw_results) else None
            label = "NEUTRAL"
            score = None
            if isinstance(res, dict):
                label = str(res.get("label", res.get("sentiment", "NEUTRAL"))).upper()
                try:
                    score = float(res.get("score")) if res.get("score") is not None else None
                except Exception:
                    score = None
            else:
                try:
                    lbl, sc = res
                    label = str(lbl).upper()
                    score = float(sc)
                except Exception:
                    label = "NEUTRAL"
                    score = None

            aspects = extract_aspects(text)
            if not aspects:
                aspects = ["general"]

            reviews_out.append({
                "review_text": text,
                "sentiment": label,
                "score": score,
                "aspects": aspects
            })

        total = len(reviews_out)
        pos = sum(1 for r in reviews_out if r["sentiment"].startswith("POS"))
        neg = sum(1 for r in reviews_out if r["sentiment"].startswith("NEG"))
        neu = total - pos - neg
        avg = float((pos - neg) / total) if total else 0.0

        # per-aspect aggregation
        aspect_stats: DefaultDict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0, "positive": 0, "negative": 0, "neutral": 0, "score_sum": 0.0, "score_count": 0})
        for r in reviews_out:
            for a in r["aspects"]:
                st = aspect_stats[a]
                st["total"] += 1
                if r["sentiment"].startswith("POS"):
                    st["positive"] += 1
                elif r["sentiment"].startswith("NEG"):
                    st["negative"] += 1
                else:
                    st["neutral"] += 1
                if r.get("score") is not None:
                    st["score_sum"] += float(r["score"])
                    st["score_count"] += 1

        aspect_summary: Dict[str, Dict[str, Any]] = {}
        for a, st in aspect_stats.items():
            avg_score = (st["score_sum"] / st["score_count"]) if st["score_count"] else None
            aspect_summary[a] = {
                "total": st["total"],
                "positive": st["positive"],
                "negative": st["negative"],
                "neutral": st["neutral"],
                "average_score": avg_score
            }

        # ---------- Recommendation logic ----------
        recommendation = {
            "decision": "INSUFFICIENT_DATA",
            "explanation": "Not enough reviews to make a recommendation.",
            "positive_ratio": None,
            "negative_ratio": None,
            "top_positive_aspects": [],
            "top_negative_aspects": []
        }

        if total >= 3:
            pos_ratio = pos / total
            neg_ratio = neg / total
            neu_ratio = neu / total

            # find top aspects by positive and negative counts
            def top_aspects_by(kind: str, top_n: int = 3) -> List[str]:
                scored: List[Tuple[str, int]] = []
                for a, st in aspect_summary.items():
                    scored.append((a, st.get(kind, 0)))
                scored.sort(key=lambda x: x[1], reverse=True)
                return [a for a, cnt in scored if cnt > 0][:top_n]

            top_pos = top_aspects_by("positive", 3)
            top_neg = top_aspects_by("negative", 3)

            recommendation["positive_ratio"] = round(pos_ratio, 3)
            recommendation["negative_ratio"] = round(neg_ratio, 3)
            recommendation["top_positive_aspects"] = top_pos
            recommendation["top_negative_aspects"] = top_neg

            # decision rules (neutral-aware)
            #  - if most reviews neutral -> NEUTRAL
            #  - else if strong positive -> BUY
            #  - else if strong negative -> AVOID
            #  - else mixed -> CONSIDER
            if neu_ratio >= 0.60:
                decision = "NEUTRAL"
                explanation = f"Most reviews are neutral ({int(neu_ratio*100)}%). Not enough sentiment signal to recommend buying or avoiding."
            elif pos_ratio >= 0.60 and neg_ratio <= 0.25:
                decision = "BUY"
                explanation = f"Majority positive reviews ({pos}/{total}). Positive aspects: {', '.join(top_pos) or 'general'}."
            elif neg_ratio >= 0.45:
                decision = "AVOID"
                explanation = f"High negative signal ({neg}/{total}). Negative aspects: {', '.join(top_neg) or 'general'}."
            else:
                # if positive and negative are both low but neither wins strongly
                if abs(pos_ratio - neg_ratio) < 0.15:
                    decision = "CONSIDER"
                    explanation = f"Mixed or balanced feedback ({pos}/{total} positive, {neg}/{total} negative). Consider reading sample reviews."
                else:
                    # choose the stronger side
                    if pos_ratio > neg_ratio:
                        decision = "BUY"
                        explanation = f"More positive than negative reviews ({pos}/{total}). Check positives: {', '.join(top_pos) or 'general'}."
                    else:
                        decision = "AVOID"
                        explanation = f"More negative than positive reviews ({neg}/{total}). Check concerns: {', '.join(top_neg) or 'general'}."

            recommendation["decision"] = decision
            recommendation["explanation"] = explanation

        # finalize summary
        summary = {
            "total_reviews": total,
            "positive_reviews": pos,
            "negative_reviews": neg,
            "neutral_reviews": neu,
            "average_sentiment": avg
        }

        return ReviewResponse(reviews=reviews_out, summary=summary, aspect_summary=aspect_summary, recommendation=recommendation)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))