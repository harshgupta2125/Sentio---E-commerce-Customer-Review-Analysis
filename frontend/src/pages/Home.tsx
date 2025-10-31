import React, { useState, useMemo } from "react";
import SentimentChart from "../components/SentimentChart";
import { analyzeUrl } from "../services/api";
import type { ReviewResponse, ReviewSentiment, Recommendation } from "../types";

export default function Home(): JSX.Element {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [query, setQuery] = useState("");
  const [showOnly, setShowOnly] = useState<"ALL" | "POS" | "NEG" | "NEU">("ALL");

  async function handleAnalyze(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError(null);
    if (!url) {
      setError("Enter a product URL.");
      return;
    }
    setLoading(true);
    setPage(1);
    try {
      const res = await analyzeUrl(url);
      setData(res);
      setQuery("");
      setShowOnly("ALL");
    } catch (err: any) {
      let msg = err?.message ?? (typeof err === "string" ? err : null);
      if (!msg && err && typeof err === "object") {
        try { msg = JSON.stringify(err); } catch { msg = "Request failed"; }
      }
      setError(msg || "Request failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const filteredReviews = useMemo(() => {
    const all = data?.reviews ?? [];
    let list = all;
    if (showOnly !== "ALL") {
      list = list.filter(r => {
        const s = (r.sentiment || "NEUTRAL").toUpperCase();
        if (showOnly === "POS") return s.startsWith("POS");
        if (showOnly === "NEG") return s.startsWith("NEG");
        return s === "NEUTRAL";
      });
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(r => (r.review_text || "").toLowerCase().includes(q));
    }
    return list;
  }, [data, showOnly, query]);

  const pagedReviews = useMemo<ReviewSentiment[]>(() => {
    const start = (page - 1) * pageSize;
    return filteredReviews.slice(start, start + pageSize);
  }, [filteredReviews, page]);

  function sentimentClass(s?: string) {
    if (!s) return "neutral";
    const up = s.toUpperCase();
    if (up.startsWith("POS")) return "positive";
    if (up.startsWith("NEG")) return "negative";
    return "neutral";
  }

  function exportCSV() {
    if (!data) return;
    const rows = [["review_text","sentiment","score","aspects"]];
    data.reviews.forEach(r => {
      rows.push([`"${(r.review_text||"").replace(/"/g,'""')}"`, r.sentiment || "", String(r.score ?? ""), (r.aspects||[]).join("|")]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = urlBlob;
    a.download = "sentio_reviews.csv";
    a.click();
    URL.revokeObjectURL(urlBlob);
  }

  const totalReviews = data?.summary?.total_reviews ?? 0;
  const canNext = (page * pageSize) < (filteredReviews?.length || 0);

  // normalize recommendation to avoid null access
  const rec: Recommendation | null = (data?.recommendation ?? null) as Recommendation | null;

  // --- new local computed fields for clearer buy/do-not-buy UI ---
  const decision = (rec?.decision || "INSUFFICIENT_DATA").toUpperCase();
  let decisionLabel = "No recommendation";
  let decisionMessage = rec?.explanation ?? "Not enough data to recommend.";
  let showCTA = false;
  let ctaLabel = "";
  if (decision === "BUY") {
    decisionLabel = "BUY — Recommended";
    decisionMessage = decisionMessage || "Majority of reviews are positive.";
    showCTA = Boolean(url);
    ctaLabel = "Buy on Amazon";
  } else if (decision === "AVOID") {
    decisionLabel = "DO NOT BUY";
    decisionMessage = decisionMessage || "Significant negative feedback detected.";
    showCTA = false;
  } else if (decision === "NEUTRAL") {
    decisionLabel = "NEUTRAL";
    decisionMessage = decisionMessage || "Most reviews are neutral.";
    showCTA = false;
  } else if (decision === "CONSIDER") {
    decisionLabel = "CONSIDER";
    decisionMessage = decisionMessage || "Mixed reviews — read sample reviews.";
    showCTA = Boolean(url);
    ctaLabel = "Open product page";
  } else {
    decisionLabel = rec?.decision ?? "No recommendation";
  }
  // --- end computed fields ---

  // --- changed code: normalize and aggregate aspects for better, generic labels ---
  function normalizeAspectKey(key: string): string {
    const k = (key || "").toLowerCase();
    if (k.includes("battery")) return "Battery";
    if (k.includes("screen") || k.includes("display") || k.includes("resolution")) return "Display";
    if (k.includes("sound") || k.includes("speaker") || k.includes("audio")) return "Sound";
    if (k.includes("camera") || k.includes("photo") || k.includes("video")) return "Camera";
    if (k.includes("fit") || k.includes("size") || k.includes("sizing") || k.includes("comfort")) return "Fit & Comfort";
    if (k.includes("material") || k.includes("fabric") || k.includes("leather") || k.includes("cloth")) return "Material";
    if (k.includes("quality") || k.includes("build") || k.includes("durability") || k.includes("sturdy")) return "Quality & Durability";
    if (k.includes("price") || k.includes("value") || k.includes("cost") || k.includes("worth")) return "Price & Value";
    if (k.includes("shipping") || k.includes("delivery") || k.includes("packaging") || k.includes("arrival")) return "Shipping & Packaging";
    if (k.includes("design") || k.includes("style") || k.includes("appearance") || k.includes("look")) return "Design & Looks";
    if (k.includes("performance") || k.includes("speed") || k.includes("power")) return "Performance";
    // fallback: title-case cleaned token
    return key.split(/[_\-\s\/]+/).map(s => s ? (s[0].toUpperCase() + s.slice(1)) : "").join(" ");
  }

  function aggregateAspects(aspectSummary: Record<string, any> | null | undefined) {
    if (!aspectSummary) return [];
    const map: Record<string, { total: number; positive: number; negative: number; examples: string[] }> = {};
    for (const [raw, stats] of Object.entries(aspectSummary as Record<string, any>)) {
      const label = normalizeAspectKey(raw);
      if (!map[label]) map[label] = { total: 0, positive: 0, negative: 0, examples: [] };
      map[label].total += stats.total || 0;
      map[label].positive += stats.positive || 0;
      map[label].negative += stats.negative || 0;
      if (map[label].examples.length < 3) map[label].examples.push(raw);
    }
    return Object.entries(map)
      .map(([label, st]) => ({ label, ...st, positive_ratio: st.total ? st.positive / st.total : 0 }))
      .sort((a, b) => b.total - a.total);
  }
  // --- end changed code ---

  return (
    <div className="dashboard flat">
      <header className="topbar flat-top">
        <div className="brand">
          <h1>Sentio</h1>
          <div className="tag">Amazon review intelligence</div>
        </div>

        <form className="search" onSubmit={handleAnalyze}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Amazon product page URL (amazon.com / amazon.in / ...)"
            type="url"
            aria-label="product url"
            className="url-input"
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        <div className="actions">
          <button onClick={exportCSV} disabled={!data} className="btn-ghost">Export CSV</button>
        </div>
      </header>

      <div className="notice">This deployment supports Amazon product pages only.</div>

      {error && <div className="alert error">{error}</div>}

      {!data && !loading && (
        <section className="hero-card flat-card">
          <h2>Analyze Amazon product reviews</h2>
          <p className="muted">Paste an Amazon product page and get sentiment, aspects and a clear buy/avoid recommendation.</p>
        </section>
      )}

      {data && (
        <main className="grid">
          <aside className="left">
            <div className="card recommendation flat-card">
              <div>
                <h3>Recommendation</h3>
                <div className={`decision ${String(decision).toLowerCase()}`} style={{ marginTop: 8 }}>
                  {decisionLabel}
                </div>
                <div className="explain" style={{ marginTop: 8 }}>{decisionMessage}</div>

                {rec?.top_positive_aspects && rec.top_positive_aspects.length ? (
                  <div style={{ marginTop: 8, color: "#067f7a", fontSize: 13 }}>
                    Positives: {rec.top_positive_aspects.join(", ")}
                  </div>
                ) : null}
                {rec?.top_negative_aspects && rec.top_negative_aspects.length ? (
                  <div style={{ marginTop: 6, color: "#b91c1c", fontSize: 13 }}>
                    Concerns: {rec.top_negative_aspects.join(", ")}
                  </div>
                ) : null}
              </div>

              <div className="rec-right">
                <div className="small">Positive</div>
                <div className="big">{Math.round((data.summary.positive_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%</div>
                <div className="small">Negative</div>
                <div className="big neg">{Math.round((data.summary.negative_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%</div>

                {showCTA ? (
                  <div style={{ marginTop: 10 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary"
                      style={{ display: "inline-block", padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#fff" }}
                      aria-label={ctaLabel}
                    >Overall
                      {ctaLabel}Overall
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="card chart flat-card overall-sentiment">
              <h4>Overall sentiment</h4>
              <div className="overall-grid">
                <div className="donut-wrapper" aria-hidden>
                  <SentimentChart summary={data.summary} aspectSummary={data.aspect_summary} />
                </div>

                <div className="overall-stats" role="group" aria-label="Sentiment breakdown">
                  <div className="sentiment-row">
                    <div className="label">Positive</div>
                    <div className="value pos">
                      {Math.round((data.summary.positive_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%
                    </div>
                  </div>

                  <div className="sentiment-row">
                    <div className="label">Neutral</div>
                    <div className="value neu">
                      {Math.round(((data.summary.total_reviews - (data.summary.positive_reviews + data.summary.negative_reviews)) / Math.max(1, data.summary.total_reviews)) * 100)}%
                    </div>
                  </div>

                  <div className="sentiment-row">
                    <div className="label">Negative</div>
                    <div className="value neg">
                      {Math.round((data.summary.negative_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%
                    </div>
                  </div>

                  <div className="trend muted small" style={{ marginTop: 10 }}>
                    {data.summary.total_reviews} reviews analyzed · Avg score: {((data.summary as any).avg_score != null) ? Number((data.summary as any).avg_score).toFixed(2) : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="card aspects flat-card">
              <h4>Top aspects</h4>

              <div className="aspect-grid">
                {(() => {
                  const ag = aggregateAspects(data.aspect_summary);
                  if (!ag || !ag.length) return <div className="muted">No aspect data</div>;
                  return ag.map((a) => (
                    <div key={a.label} className="aspect-card">
                      <div className="aspect-head">
                        <div className="aspect-title">{a.label}</div>
                        <div className="aspect-count small">{a.total} reviews</div>
                      </div>

                      <div className="aspect-bar" aria-hidden>
                        <div
                          className="aspect-bar-fill"
                          style={{ width: `${Math.round(a.positive_ratio * 100)}%`, background: a.positive_ratio >= 0.6 ? "linear-gradient(90deg,#34d399,#059669)" : a.positive_ratio >= 0.35 ? "linear-gradient(90deg,#f59e0b,#d97706)" : "linear-gradient(90deg,#fda4af,#dc2626)" }}
                        />
                      </div>

                      <div className="aspect-meta-row">
                        <div className="meta-pos">+{a.positive}</div>
                        <div className="meta-examples muted">{a.examples.join(", ")}</div>
                        <div className="meta-neg">-{a.negative}</div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </aside>

          <section className="right">
            <div className="controls">
              <div className="filters">
                <button className={showOnly === "ALL" ? "active" : ""} onClick={() => { setShowOnly("ALL"); setPage(1); }}>All</button>
                <button className={showOnly === "POS" ? "active" : ""} onClick={() => { setShowOnly("POS"); setPage(1); }}>Positive</button>
                <button className={showOnly === "NEU" ? "active" : ""} onClick={() => { setShowOnly("NEU"); setPage(1); }}>Neutral</button>
                <button className={showOnly === "NEG" ? "active" : ""} onClick={() => { setShowOnly("NEG"); setPage(1); }}>Negative</button>
              </div>
              <div className="search-inline">
                <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search reviews…" />
              </div>
            </div>

            <div className="results">
              <div className="meta">Showing {filteredReviews.length} reviews — page {page}</div>

              <div className="cards">
                {pagedReviews.map((r, i) => (
                  <article key={i} className={`review-card ${sentimentClass(r.sentiment)}`}>
                    <div className="rc-head">
                      <div className={`badge ${sentimentClass(r.sentiment)}`}>{r.sentiment}</div>
                      <div className="score">{r.score != null ? Number(r.score).toFixed(2) : "-"}</div>
                    </div>
                    <p className="rc-body">{r.review_text}</p>
                    <div className="rc-aspects">
                      {(r.aspects || []).map((a, idx) => <span key={idx} className="chip">{a}</span>)}
                    </div>
                  </article>
                ))}
              </div>

              <div className="pager">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Prev</button>
                <div>Page {page}</div>
                <button onClick={() => setPage(page + 1)} disabled={!canNext}>Next</button>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}