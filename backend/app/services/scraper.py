from typing import List, Set
import re
import time
import os
import requests
from bs4 import BeautifulSoup

# Playwright (sync) optional
try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
    _HAS_PLAYWRIGHT = True
except Exception:
    _HAS_PLAYWRIGHT = False

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9"
}

DUMP_PLAYWRIGHT = "/tmp/sentio_page_dump_playwright.html"
DUMP_REQUESTS = "/tmp/sentio_page_dump_requests.html"

def ensure_scheme(u: str) -> str:
    u = (u or "").strip()
    if not re.match(r"^https?://", u, re.I):
        return "https://" + u
    return u

def _save_dump(html: str, path: str):
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
    except Exception:
        pass

def _clean_text(t: str) -> str:
    if not t:
        return ""
    t = re.sub(r"READ MORE", "", t, flags=re.I)
    t = re.sub(r"Permalink|Certified Buyer", "", t, flags=re.I)
    t = re.sub(r"Page \d+ of \d+|Next|Previous", "", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t

def _is_likely_review(text: str) -> bool:
    if not text or len(text.strip()) < 40:
        return False
    low = text.lower()
    # reject clear boilerplate
    for bad in ("bank offer", "available offers", "special price", "add to cart", "delivery by", "available offers", "specifications", "about this item"):
        if bad in low:
            return False
    # accept typical review indicators
    if any(k in low for k in ("certified buyer", "certified", "verified", "read more", "permalink", "helpful", "★", "stars")):
        return True
    # accept natural sentences with pronouns or common review words
    if re.search(r"\b(i|my|we|me|they|he|she)\b", low) or any(w in low for w in ("battery", "sound", "price", "quality", "worked", "broke", "broken", "refund")):
        return True
    return False

def _extract_texts_from_soup(soup: BeautifulSoup) -> List[str]:
    texts: List[str] = []
    # Flipkart review containers / text classes
    selectors = [
        "div.t-ZTKy",        # review text wrapper
        "div._16PBlm",       # review card container
        "div._2-N8zT",       # alt wrapper
        "div.qwjRop",        # sometimes review text
        "span[data-hook='review-body']"  # amazon fallback
    ]
    for sel in selectors:
        for el in soup.select(sel):
            txt = el.get_text(separator=" ", strip=True)
            if txt:
                texts.append(txt)
    # fallback: long paragraphs
    for tag in soup.find_all(["p", "div", "span"]):
        try:
            t = tag.get_text(separator=" ", strip=True)
        except Exception:
            continue
        if t and len(t) > 80:
            texts.append(t)
    # clean + dedupe
    seen = []
    for t in texts:
        ct = _clean_text(t)
        if ct and ct not in seen:
            seen.append(ct)
    return seen

def scrape_reviews(url: str, limit: int = 50, max_pages: int = 6) -> List[str]:
    """
    Playwright-first scraper that specifically handles Flipkart review cards and pagination.
    Falls back to requests+BeautifulSoup.
    """
    url = ensure_scheme(url)
    collected: List[str] = []
    seen: Set[str] = set()

    # Playwright path (preferred for JS-heavy Flipkart)
    if _HAS_PLAYWRIGHT:
        try:
            with sync_playwright() as p:
                proxy = os.getenv("PLAYWRIGHT_PROXY")
                launch_args = {"headless": True}
                if proxy:
                    launch_args["proxy"] = {"server": proxy}
                browser = p.chromium.launch(**launch_args)
                context = browser.new_context(user_agent=DEFAULT_HEADERS["User-Agent"], locale="en-US")
                page = context.new_page()
                page.goto(url, timeout=30000)
                page.wait_for_timeout(1200)

                # If Flipkart, try to click "See all reviews" / "All reviews" / open reviews section
                if "flipkart." in url:
                    try:
                        # try some common review buttons/links
                        for txt in ("See all reviews", "All reviews", "View all reviews", "Read all reviews", "Reviews"):
                            try:
                                loc = page.get_by_text(txt, exact=False)
                                if loc.count() > 0:
                                    loc.first.click()
                                    page.wait_for_timeout(900)
                                    break
                            except Exception:
                                pass
                        # also try anchors pointing to product-reviews
                        try:
                            anchors = page.query_selector_all("a[href*='product-reviews'], a[href*='reviews'], a[href*='pid=']")
                            for a in anchors:
                                try:
                                    a.click()
                                    page.wait_for_timeout(700)
                                    break
                                except Exception:
                                    continue
                        except Exception:
                            pass
                    except Exception:
                        pass

                pages_visited = 0
                while pages_visited < max_pages and len(collected) < limit:
                    pages_visited += 1
                    # allow lazy load
                    try:
                        page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
                        page.wait_for_timeout(700)
                    except Exception:
                        pass

                    # prefer Flipkart review text selectors
                    try:
                        elems = page.query_selector_all("div.t-ZTKy, div._16PBlm, div._2-N8zT, div.qwjRop, span[data-hook='review-body']")
                    except Exception:
                        elems = []

                    # page title for filtering
                    try:
                        page_title = (page.title() or "").strip()
                    except Exception:
                        page_title = None

                    for el in elems:
                        try:
                            t = el.inner_text().strip()
                        except Exception:
                            t = (el.text_content() or "").strip()
                        t = _clean_text(t)
                        if not t or t in seen:
                            continue
                        if not _is_likely_review(t):
                            continue
                        collected.append(t)
                        seen.add(t)
                        if len(collected) >= limit:
                            break

                    # attempt clicking Next (common Flipkart "Next" link/button)
                    if len(collected) >= limit:
                        break

                    next_clicked = False
                    try:
                        # try button/link with text Next
                        nxt = page.get_by_text("Next", exact=False)
                        if nxt.count() > 0:
                            nxt.first.click()
                            page.wait_for_timeout(900)
                            next_clicked = True
                    except Exception:
                        pass

                    if not next_clicked:
                        # try pagination anchor/button patterns
                        try:
                            pag_anchors = page.query_selector_all("a._1LKTO3, a._3fVaIS")  # common Flipkart classes
                            for a in pag_anchors:
                                try:
                                    a.click()
                                    page.wait_for_timeout(800)
                                    next_clicked = True
                                    break
                                except Exception:
                                    continue
                        except Exception:
                            pass

                    if not next_clicked:
                        break

                # save dump for inspection
                _save_dump(page.content(), DUMP_PLAYWRIGHT)
                browser.close()
                if collected:
                    return collected[:limit]
        except Exception as exc:
            # don't fail hard; fall back to requests
            print(f"[scraper] playwright error: {exc}")

    # Requests fallback
    try:
        current = url
        pages = 0
        while pages < max_pages and len(collected) < limit:
            pages += 1
            resp = requests.get(current, headers=DEFAULT_HEADERS, timeout=20)
            html = resp.text or ""
            _save_dump(html, DUMP_REQUESTS)
            soup = BeautifulSoup(html, "html.parser")
            parsed = _extract_texts_from_soup(soup)
            for t in parsed:
                ct = _clean_text(t)
                if not ct or ct in seen:
                    continue
                if not _is_likely_review(ct):
                    continue
                collected.append(ct)
                seen.add(ct)
                if len(collected) >= limit:
                    break

            # find a next page link (simple heuristics)
            next_href = None
            for a in soup.select("a"):
                txt = (a.get_text() or "").lower()
                href = a.get("href") or ""
                if "next" in txt or re.search(r"page=\d+|/p/\d+|/page/\d+", href):
                    next_href = href
                    break
            if not next_href:
                break
            if next_href.startswith("http"):
                current = next_href
            else:
                base = re.match(r"^(https?://[^/]+)", current)
                if base:
                    current = base.group(1) + next_href
                else:
                    current = ensure_scheme(next_href)
            time.sleep(0.6)
        return collected[:limit]
    except Exception as exc:
        print(f"[scraper] requests error: {exc}")
        return collected[:limit]