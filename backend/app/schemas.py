"""
Pydantic Schemas for Request/Response Validation
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class AssetSchema(BaseModel):
    ticker: str
    name: str
    name_local: str
    exchange: str
    sector: str
    currency: str
    current_price: float
    price_change_pct: float
    overall_sentiment: float
    sentiment_direction: str
    predicted_price: float
    predicted_change_pct: float
    prediction_direction: str

class SocialPostSchema(BaseModel):
    id: str
    ticker: str
    platform: str
    author: str
    text: str
    published_at: datetime
    likes: int
    comments: int
    engagement_score: float
    sentiment_score: float
    sentiment_label: str
    extracted_phrases: List[str] = []

class NewsArticleSchema(BaseModel):
    id: str
    ticker: str
    title: str
    url: str
    publisher: str
    published_at: datetime
    relevance_score: float
    summary: str
    sentiment_score: float
    sentiment_label: str

class PredictionDetailSchema(BaseModel):
    ticker: str
    observed_price: float
    predicted_price: float
    predicted_change_pct: float
    direction: str
    target_date: str
    model_name: str
    lower_95_ci: float
    upper_95_ci: float
    directional_accuracy: float
    baseline_improvement_pct: float
