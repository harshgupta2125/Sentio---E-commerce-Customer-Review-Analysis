from typing import List, Dict, Any

# try to import transformers pipeline if available (optional)
_sentiment_pipeline = None
try:
    from transformers import pipeline
    _has_transformers = True
except Exception:
    _has_transformers = False

def _get_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None and _has_transformers:
        try:
            _sentiment_pipeline = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
        except Exception:
            _sentiment_pipeline = None
    return _sentiment_pipeline

def analyze_sentiment(reviews: List[str]) -> List[Dict[str, Any]]:
    """
    Return list of dicts: {label: 'POSITIVE'|'NEGATIVE'|'NEUTRAL', score: float}
    Use thresholds to reduce false-neutrals/false-positives.
    """
    if not reviews:
        return []

    # thresholds: tune as needed
    POS_THRESH = 0.60
    NEG_THRESH = 0.40

    pipe = _get_pipeline()
    results: List[Dict[str, Any]] = []

    if pipe:
        try:
            raw = pipe(reviews, truncation=True)
            for r in raw:
                label = str(r.get("label", "NEUTRAL")).upper()
                score = float(r.get("score", 0.0))
                # normalize to three-way using score thresholds
                if label.startswith("POS"):
                    if score >= POS_THRESH:
                        final = "POSITIVE"
                    elif score <= NEG_THRESH:
                        final = "NEGATIVE"
                    else:
                        final = "NEUTRAL"
                elif label.startswith("NEG"):
                    if score >= POS_THRESH:
                        final = "POSITIVE"
                    elif score <= NEG_THRESH:
                        final = "NEGATIVE"
                    else:
                        final = "NEUTRAL"
                else:
                    final = "NEUTRAL"
                results.append({"label": final, "score": float(score)})
            return results
        except Exception:
            pass

    # fallback rule-based
    positive_words = {"good", "great", "excellent", "love", "best", "amazing", "perfect", "fantastic", "awesome"}
    negative_words = {"bad", "poor", "awful", "worst", "disappointed", "died", "broken", "refund", "terrible", "stopworking", "stopped"}

    for text in reviews:
        t = (text or "").lower()
        pos_hits = sum(1 for w in positive_words if w in t)
        neg_hits = sum(1 for w in negative_words if w in t)
        # score in [0,1] where >0.5 => positive bias
        base = 0.5 + 0.15 * (pos_hits - neg_hits)
        # clamp
        score = max(0.0, min(1.0, base))
        # apply thresholds
        if score >= POS_THRESH:
            label = "POSITIVE"
        elif score <= NEG_THRESH:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"
        results.append({"label": label, "score": float(score)})

    return results