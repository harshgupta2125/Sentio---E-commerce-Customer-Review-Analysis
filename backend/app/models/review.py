from sqlalchemy import Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Review(Base):
    __tablename__ = 'reviews'

    id = Column(Integer, primary_key=True, index=True)
    review_text = Column(String, nullable=False)
    sentiment = Column(Float, nullable=False)
    product_id = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)  # Consider using DateTime for actual timestamps

    def __repr__(self):
        return f"<Review(id={self.id}, product_id={self.product_id}, sentiment={self.sentiment})>"