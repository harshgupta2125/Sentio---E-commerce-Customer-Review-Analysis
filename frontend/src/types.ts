export type ReviewSentiment = {
  review_text: string;
  sentiment: string;
  score?: number | null;
  aspects?: string[] | null;
};

export type ReviewSummary = {
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  neutral_reviews: number;
  average_sentiment: number;
};

export type AspectSummaryItem = {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  average_score?: number | null;
};

export type Recommendation = {
  decision: "BUY" | "AVOID" | "CONSIDER" | "NEUTRAL" | "INSUFFICIENT_DATA" | string;
  explanation: string;
  positive_ratio?: number | null;
  negative_ratio?: number | null;
  top_positive_aspects?: string[] | null;
  top_negative_aspects?: string[] | null;
};

export type ReviewResponse = {
  reviews: ReviewSentiment[];
  summary: ReviewSummary;
  aspect_summary?: Record<string, AspectSummaryItem>;
  recommendation?: Recommendation | null;
};