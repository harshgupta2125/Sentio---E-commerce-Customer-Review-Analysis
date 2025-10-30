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
    decisionLabel = "BUY — Good to buy";
    decisionMessage = decisionMessage || "Majority of reviews are positive. Recommended to buy.";
    showCTA = Boolean(url);
    ctaLabel = "Buy on site";
  } else if (decision === "AVOID") {
    decisionLabel = "DO NOT BUY";
    decisionMessage = decisionMessage || "High negative signal — avoid purchasing.";
    showCTA = false;
  } else if (decision === "NEUTRAL") {
    decisionLabel = "NEUTRAL";
    decisionMessage = decisionMessage || "Most reviews are neutral — neither recommend nor discourage buying.";
    showCTA = false;
  } else if (decision === "CONSIDER") {
    decisionLabel = "CONSIDER";
    decisionMessage = decisionMessage || "Mixed reviews — consider carefully after reading sample reviews.";
    showCTA = Boolean(url);
    ctaLabel = "View product";
  } else {
    decisionLabel = rec?.decision ?? "No recommendation";
  }
  // --- end computed fields ---

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <h1>Sentio</h1>
          <div className="tag">E‑commerce Review Intelligence</div>
        </div>

        <form className="search" onSubmit={handleAnalyze}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste product/reviews URL (Flipkart, Amazon...)"
            type="url"
            aria-label="product url"
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        <div className="actions">
          <button onClick={exportCSV} disabled={!data}>Export CSV</button>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      {!data && !loading && (
        <section className="hero-card">
          <h2>Paste a product link to get sentiment & aspect insights</h2>
          <p className="muted">Sentio extracts customer reviews, summarizes sentiment and highlights product strengths & issues.</p>
        </section>
      )}

      {data && (
        <main className="grid">
          <aside className="left">
            <div className="card recommendation">
              <div>
                <h3>Recommendation</h3>
                <div className={`decision ${String(decision).toLowerCase()}`} style={{ marginTop: 8 }}>
                  {decisionLabel}
                </div>
                <div className="explain" style={{ marginTop: 8 }}>{decisionMessage}</div>

                {rec?.top_positive_aspects && rec.top_positive_aspects.length ? (
                  <div style={{ marginTop: 8, color: "#059669", fontSize: 13 }}>
                    Positives: {rec.top_positive_aspects.join(", ")}
                  </div>
                ) : null}
                {rec?.top_negative_aspects && rec.top_negative_aspects.length ? (
                  <div style={{ marginTop: 6, color: "#dc2626", fontSize: 13 }}>
                    Concerns: {rec.top_negative_aspects.join(", ")}
                  </div>
                ) : null}
              </div>

              <div className="rec-right">
                <div className="small">Pos</div>
                <div className="big">{Math.round((data.summary.positive_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%</div>
                <div className="small">Neg</div>
                <div className="big neg">{Math.round((data.summary.negative_reviews / Math.max(1, data.summary.total_reviews)) * 100)}%</div>

                {/* CTA button: only show when it's BUY or CONSIDER and url present */}
                {showCTA ? (
                  <div style={{ marginTop: 10 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary"
                      style={{ display: "inline-block", padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#fff" }}
                      aria-label={ctaLabel}
                    >
                      {ctaLabel}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="card chart">
              <h4>Overall sentiment</h4>
              <SentimentChart summary={data.summary} aspectSummary={data.aspect_summary} />
            </div>

            <div className="card aspects">
              <h4>Top aspects</h4>
              <div className="aspect-list">
                {data.aspect_summary && Object.entries(data.aspect_summary).length ? (
                  Object.entries(data.aspect_summary).map(([k, v]: any) => (
                    <div key={k} className={`aspect-item ${v.positive > v.negative ? "pos" : v.negative > v.positive ? "neg" : "neu"}`}>
                      <div className="aspect-name">{k}</div>
                      <div className="aspect-meta">
                        <span className="count">{v.total}</span>
                        <span className="pos">+{v.positive}</span>
                        <span className="neg">-{v.negative}</span>
                      </div>
                    </div>
                  ))
                ) : <div className="muted">No aspect data</div>}
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