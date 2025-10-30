import React from 'react';
import { ReviewSentiment } from '../types';

export default function ReviewList({ reviews }: { reviews: ReviewSentiment[] }) {
  if (!reviews.length) return <div>No reviews found.</div>;

  return (
    <div className="review-list">
      <h2>Example Reviews</h2>
      <ul>
        {reviews.map((r, i) => (
          <li key={i} className={`review ${r.sentiment.toLowerCase()}`}>
            <div className="score">{r.score ? r.score.toFixed(2) : '-'}</div>
            <div className="text">{r.review_text}</div>
            <div className="label">{r.sentiment}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}