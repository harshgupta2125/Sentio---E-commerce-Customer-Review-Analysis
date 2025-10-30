export interface Review {
    id: string;
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    createdAt: string;
}

export interface SentimentAnalysisResult {
    positive: number;
    negative: number;
    neutral: number;
}

export interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
}

export type ReviewSentiment = {
  review_text: string;
  sentiment: string;
  score?: number;
};

export type ReviewSummary = {
  total_reviews: number;
  positive_reviews: number;
  negative_reviews: number;
  neutral_reviews: number;
  average_sentiment: number;
};

export type ReviewResponse = {
  reviews: ReviewSentiment[];
  summary: ReviewSummary;
};