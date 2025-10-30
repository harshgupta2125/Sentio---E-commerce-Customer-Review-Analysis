from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ReviewBase(BaseModel):
    review_text: Optional[str] = None
    sentiment: Optional[str] = None

# replace the old ReviewCreate with a request schema that has url
class ReviewCreate(BaseModel):
    url: str

class Review(ReviewBase):
    id: int

    class Config:
        # pydantic v2 uses 'from_attributes'; avoids the orm_mode warning
        from_attributes = True

class ReviewSummary(BaseModel):
    total_reviews: int
    positive_reviews: int
    negative_reviews: int
    neutral_reviews: int
    average_sentiment: float

class ReviewList(BaseModel):
    reviews: List[Review]

class ReviewSentiment(BaseModel):
    review_text: str
    sentiment: str
    score: Optional[float] = None
    aspects: Optional[List[str]] = None  # new: list of matched aspects

class Recommendation(BaseModel):
    decision: str  # BUY | AVOID | CONSIDER | INSUFFICIENT_DATA
    explanation: str
    positive_ratio: Optional[float] = None
    negative_ratio: Optional[float] = None
    top_positive_aspects: Optional[List[str]] = None
    top_negative_aspects: Optional[List[str]] = None

class ReviewResponse(BaseModel):
    reviews: List[ReviewSentiment]
    summary: ReviewSummary
    aspect_summary: Optional[Dict[str, Any]] = None
    recommendation: Optional[Recommendation] = None  # new field