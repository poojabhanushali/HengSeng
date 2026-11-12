"""
SQLAlchemy PostgreSQL Database Entities for HengSeng Platform
Normalized tables for assets, price bars, social posts, news articles, engineered features, and predictions.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class AssetModel(Base):
    __tablename__ = "assets"

    ticker = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    name_local = Column(String(100), nullable=False)
    exchange = Column(String(10), nullable=False, index=True) # HKEX or KRX
    sector = Column(String(100), nullable=False)
    currency = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    price_bars = relationship("PriceBarModel", back_populates="asset", cascade="all, delete-orphan")
    social_posts = relationship("SocialPostModel", back_populates="asset", cascade="all, delete-orphan")
    news_articles = relationship("NewsArticleModel", back_populates="asset", cascade="all, delete-orphan")
    predictions = relationship("PredictionModel", back_populates="asset", cascade="all, delete-orphan")

class PriceBarModel(Base):
    __tablename__ = "price_bars"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True) # UTC timestamp
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    sma_5 = Column(Float, nullable=True)
    sma_10 = Column(Float, nullable=True)
    rsi_14 = Column(Float, nullable=True)
    macd = Column(Float, nullable=True)

    asset = relationship("AssetModel", back_populates="price_bars")

class SocialPostModel(Base):
    __tablename__ = "social_posts"

    id = Column(String(64), primary_key=True, index=True) # SHA-256 deduplication hash
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False, index=True)
    exchange = Column(String(10), nullable=False)
    platform = Column(String(50), nullable=False, index=True) # LIHKG, Telegram, Naver, Daum
    url = Column(String(500), nullable=True)
    author = Column(String(100), nullable=False)
    author_followers = Column(Integer, default=0)
    text = Column(Text, nullable=False)
    language = Column(String(10), nullable=False)
    published_at = Column(DateTime, nullable=False, index=True) # UTC
    collected_at = Column(DateTime, default=datetime.datetime.utcnow)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    views = Column(Integer, default=0)
    engagement_score = Column(Float, default=0.0)
    sentiment_score = Column(Float, nullable=False) # -100 to +100
    sentiment_label = Column(String(20), nullable=False)
    confidence = Column(Float, default=0.5)
    extracted_phrases = Column(JSON, default=list)

    asset = relationship("AssetModel", back_populates="social_posts")

class NewsArticleModel(Base):
    __tablename__ = "news_articles"

    id = Column(String(64), primary_key=True, index=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False, index=True)
    title = Column(String(300), nullable=False)
    url = Column(String(500), unique=True, nullable=False)
    publisher = Column(String(100), nullable=False)
    published_at = Column(DateTime, nullable=False, index=True)
    retrieved_at = Column(DateTime, default=datetime.datetime.utcnow)
    relevance_score = Column(Float, default=0.0)
    summary = Column(Text, nullable=True)
    sentiment_score = Column(Float, nullable=False)
    sentiment_label = Column(String(20), nullable=False)

    asset = relationship("AssetModel", back_populates="news_articles")

class PredictionModel(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String(20), ForeignKey("assets.ticker"), nullable=False, index=True)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    target_date = Column(DateTime, nullable=False)
    observed_price = Column(Float, nullable=False)
    predicted_price = Column(Float, nullable=False)
    predicted_change_pct = Column(Float, nullable=False)
    direction = Column(String(20), nullable=False)
    model_name = Column(String(100), nullable=False)
    lower_95_ci = Column(Float, nullable=False)
    upper_95_ci = Column(Float, nullable=False)
    directional_accuracy = Column(Float, nullable=False)
    baseline_improvement_pct = Column(Float, nullable=False)
    feature_attributions = Column(JSON, default=list)

    asset = relationship("AssetModel", back_populates="predictions")
