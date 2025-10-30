import React from "react";
import type { ReviewSummary } from "../types";

export default function SentimentChart({ summary, aspectSummary }: { summary: ReviewSummary, aspectSummary?: Record<string, any> }) {
    const total = Math.max(1, summary.total_reviews || 0);
    const pos = summary.positive_reviews || 0;
    const neg = summary.negative_reviews || 0;
    const neu = summary.neutral_reviews || 0;
    const posPct = Math.round((pos / total) * 100);
    const negPct = Math.round((neg / total) * 100);
    const neuPct = Math.max(0, 100 - posPct - negPct);

    const ring = (pct: number) => {
        const r = 36;
        const c = 2 * Math.PI * r;
        return { dash: (pct / 100) * c, circ: c };
    };

    // top 3 aspects by total mentions
    const topAspects = (aspectSummary && Object.entries(aspectSummary)
        .sort((a: any, b: any) => b[1].total - a[1].total).slice(0, 3).map((x: any) => `${x[0]} (${x[1].total})`)) || [];

    return (
        <div className="sentiment-chart">
            <div className="donut">
                <svg width="120" height="120" viewBox="0 0 120 120">
                    <g transform="translate(60,60)">
                        <circle r="36" fill="transparent" stroke="#0b1220" strokeWidth="14" />
                        {/* positive */}
                        <circle r="36" fill="transparent" stroke="#16a34a" strokeWidth="14"
                            strokeDasharray={`${ring(posPct).dash} ${ring(posPct).circ}`} strokeDashoffset={`-${ring(neuPct).dash}`} transform="rotate(-90)" strokeLinecap="round" />
                        {/* neutral */}
                        <circle r="36" fill="transparent" stroke="#94a3b8" strokeWidth="8"
                            strokeDasharray={`${ring(neuPct).dash} ${ring(neuPct).circ}`} strokeDashoffset={`-${ring(negPct).dash}`} transform="rotate(-90)" strokeLinecap="butt" opacity="0.9" />
                        {/* negative (inner thin) */}
                        <circle r="24" fill="transparent" stroke="#ef4444" strokeWidth="10"
                            strokeDasharray={`${ring(negPct).dash} ${ring(negPct).circ}`} transform="rotate(-90)" strokeLinecap="round" />
                        <text x="0" y="-4" textAnchor="middle" fontWeight={700} fontSize={16} fill="#e94949ff">{posPct}%</text>
                        <text x="0" y="14" textAnchor="middle" fontWeight={800} fontSize={10} fill="#000000ff">positive</text>
                    </g>
                </svg>
            </div>

            <div className="bars">
                <div className="bar-row"><div className="label">Positive</div><div className="bar"><div style={{ width: `${posPct}%` }} className="bar-fill pos" /></div><div className="num">{posPct}%</div></div>
                <div className="bar-row"><div className="label">Neutral</div><div className="bar"><div style={{ width: `${neuPct}%` }} className="bar-fill neu" /></div><div className="num">{neuPct}%</div></div>
                <div className="bar-row"><div className="label">Negative</div><div className="bar"><div style={{ width: `${negPct}%` }} className="bar-fill neg" /></div><div className="num">{negPct}%</div></div>
                {topAspects.length ? <div className="top-aspects"><strong>Top</strong>: {topAspects.join(", ")}</div> : null}
            </div>
        </div>
    );
}