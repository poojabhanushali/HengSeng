"""
Multilingual Financial Sentiment Engine (Traditional Chinese, Korean, English)
Standardized score output: -100 to +100.
"""

import re
from typing import Dict, Any, List

FINANCIAL_LEXICON = {
    # Traditional Chinese (HK Cantonese finance slang)
    "看好": (65, "Long"),
    "破頂": (80, "Long"),
    "大升": (85, "Long"),
    "突破": (70, "Long"),
    "買入": (75, "Long"),
    "逢低吸納": (60, "Accumulating"),
    "撈底": (65, "Accumulating"),
    "業績超預期": (90, "Long"),
    "看淡": (-65, "Short"),
    "大跌": (-85, "Short"),
    "破底": (-80, "Short"),
    "割肉": (-75, "Stop-loss"),
    "止蝕": (-60, "Stop-loss"),
    "沽空": (-85, "Short"),

    # Korean (Stock community & Naver Finance slang)
    "풀매수": (90, "Long"),
    "급등": (85, "Long"),
    "상승장": (75, "Long"),
    "신고가": (85, "Long"),
    "외인매수": (70, "Accumulating"),
    "실적호조": (85, "Long"),
    "저평가": (60, "Accumulating"),
    "떡상": (85, "Long"),
    "급락": (-85, "Short"),
    "폭락": (-90, "Short"),
    "신저가": (-85, "Short"),
    "손절": (-75, "Stop-loss"),
    "실적쇼크": (-85, "Short"),
    "공매도": (-70, "Short"),
    "떡락": (-85, "Short"),

    # English
    "bullish": (75, "Long"),
    "breakout": (80, "Long"),
    "accumulate": (65, "Accumulating"),
    "earnings beat": (85, "Long"),
    "undervalued": (60, "Accumulating"),
    "bearish": (-75, "Short"),
    "sell-off": (-80, "Short"),
    "downgrade": (-75, "Short"),
    "earnings miss": (-85, "Short"),
    "overvalued": (-60, "Short"),
}

def analyze_sentiment(text: str) -> Dict[str, Any]:
    matched = []
    scores = []
    positions = []

    text_lower = text.lower()
    for phrase, (score, pos) in FINANCIAL_LEXICON.items():
        if phrase in text or phrase.lower() in text_lower:
            matched.append(phrase)
            scores.append(score)
            if pos:
                positions.append(pos)

    if scores:
        final_score = int(sum(scores) / len(scores))
        confidence = min(0.95, 0.6 + len(scores) * 0.08)
    else:
        final_score = 0
        confidence = 0.4

    final_score = max(-100, min(100, final_score))

    if final_score >= 60:
        label = "Strong Bullish"
    elif final_score >= 20:
        label = "Bullish"
    elif final_score <= -60:
        label = "Strong Bearish"
    elif final_score <= -20:
        label = "Bearish"
    else:
        label = "Neutral"

    return {
        "sentiment_score": final_score,
        "sentiment_label": label,
        "confidence": round(confidence, 2),
        "extracted_phrases": matched,
        "expressed_position": positions[0] if positions else "Neutral",
    }
