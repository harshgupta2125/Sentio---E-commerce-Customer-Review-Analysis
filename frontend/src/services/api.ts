import { ReviewResponse } from '../types';

const DEFAULT_API = "https://sentio-e-commerce-customer-review-a.vercel.app";

function ensureUrlHasScheme(u: string) {
  const trimmed = (u || "").trim();
  if (!/^https?:\/\//i.test(trimmed)) return 'https://' + trimmed;
  return trimmed;
}

// --- changed code: only allow Amazon URLs ---
function isAmazonUrl(u: string) {
  try {
    const host = new URL(ensureUrlHasScheme(u)).hostname.toLowerCase();
    return host.includes("amazon.") || host.includes("amzn.");
  } catch {
    return false;
  }
}
// --- end changed code ---

function extractFlipkartPid(u: string): string | null {
  try {
    const url = new URL(ensureUrlHasScheme(u));
    if (url.searchParams.has("pid")) return url.searchParams.get("pid");
    const m = url.pathname.match(/\/p\/([^\/?&]+)/);
    if (m) return m[1];
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  } catch {
    return null;
  }
}

function buildFlipkartReviewsUrl(u: string, page = 1) {
  const pid = extractFlipkartPid(u);
  return pid ? `https://www.flipkart.com/product-reviews/${pid}?page=${page}` : ensureUrlHasScheme(u);
}

function buildMeeshoReviewsUrl(u: string) {
  try {
    const url = new URL(ensureUrlHasScheme(u));
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts.length ? parts[parts.length - 1] : null;
    return id ? `https://www.meesho.com/product/reviews/${id}` : ensureUrlHasScheme(u);
  } catch {
    return ensureUrlHasScheme(u);
  }
}

function buildGenericReviewUrl(u: string) {
  try {
    const url = new URL(ensureUrlHasScheme(u));
    const host = url.hostname.toLowerCase();
    if (host.includes("flipkart.")) return buildFlipkartReviewsUrl(u);
    if (host.includes("meesho.")) return buildMeeshoReviewsUrl(u);
    return ensureUrlHasScheme(u);
  } catch {
    return ensureUrlHasScheme(u);
  }
}

async function postToApi(body: Record<string, any>, apiBase = DEFAULT_API) {
  const endpoint = `${apiBase}/api/v1/reviews/`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data, rawText: text };
}

export async function analyzeUrl(url: string, apiBase = DEFAULT_API) {
  const normalized = ensureUrlHasScheme(url);

  // --- changed code: reject non-Amazon early ---
  if (!isAmazonUrl(normalized)) {
    throw new Error("This deployment supports Amazon product URLs only. Please paste an Amazon product page URL (amazon.com / amazon.in / etc).");
  }
  // --- end changed code ---

  const reviewUrl = buildGenericReviewUrl(normalized);

  // prefer order: for Meesho try original first; for others try review-list first
  let host = "";
  try { host = new URL(normalized).hostname.toLowerCase(); } catch {}
  const meesholike = host.includes("meesho.");

  const candidates = meesholike ? [normalized, reviewUrl] : [reviewUrl, normalized];

  let resp = null;
  for (const u of candidates) {
    resp = await postToApi({ url: u, original_url: normalized });
    if (resp.ok) break;
    // if 400 and we still have another candidate, try next
    if (!resp.ok && resp.status !== 400) break;
  }

  if (!resp || !resp.ok) {
    let msg = "Request failed";
    if (resp?.data) {
      if (typeof resp.data === "string") msg = resp.data;
      else if (resp.data.detail) msg = resp.data.detail;
      else msg = JSON.stringify(resp.data);
    } else if (resp?.rawText) {
      msg = resp.rawText;
    } else {
      msg = `HTTP ${resp?.status ?? "?"}`;
    }
    console.debug("[analyzeUrl] server response:", resp);
    throw new Error(msg);
  }

  return resp.data as ReviewResponse;
}