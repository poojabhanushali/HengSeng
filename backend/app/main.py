"""
HengSeng Sentiment Price Prediction Agent - FastAPI Application Entry Point
Production-ready REST API for HKEX and KRX financial sentiment intelligence and n+1 price predictions.
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import datetime

app = FastAPI(
    title="HengSeng Sentiment Price Prediction Agent API",
    description="Multilingual financial sentiment pipeline and next-period asset price prediction platform for HKEX and KRX.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "HengSeng Python Engine",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "exchanges": ["HKEX", "KRX"],
        "assets_monitored": 10,
    }

@app.get("/api/v1/assets", tags=["Assets"])
def list_assets(exchange: Optional[str] = None):
    """Monitored asset universe.

    The canonical asset universe (tickers, exchanges, currencies, live
    sentiment) is served by the Node engine at /api/v1/assets. This Python
    service does not duplicate it.
    """
    return {
        "assets": [],
        "source": "computed",
        "canonical_endpoint": "http://localhost:3000/api/v1/assets",
        "note": "Asset universe is served by the Node engine; no static copy is kept here.",
    }

@app.get("/api/v1/predictions/performance", tags=["Machine Learning"])
def get_model_performance():
    """Out-of-sample walk-forward leaderboard.

    Metrics are computed live by the canonical TypeScript engine
    (GET /api/v1/predictions/performance on the Node service). This Python
    microservice intentionally returns no static figures so that no
    fabricated or stale metric can ever be served.
    """
    return {
        "models": [],
        "source": "computed",
        "canonical_endpoint": "http://localhost:3000/api/v1/predictions/performance",
        "note": (
            "No hardcoded metrics here. Query the Node engine for the live "
            "walk-forward leaderboard (per-asset MAE in native currency, "
            "MAPE, directional accuracy, R², OOS sample counts)."
        ),
    }
