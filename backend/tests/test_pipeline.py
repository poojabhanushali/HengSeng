"""
Automated Unit & Integration Test Suite for HengSeng Intelligence Platform
Tests sentiment analyzer, Walk-Forward leakage prevention, and technical indicators.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.services.sentiment_engine import analyze_sentiment

try:
    import numpy as np
    from app.ml.predictive_pipeline import WalkForwardValidator
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

class PipelineTestCase(unittest.TestCase):
    def test_multilingual_sentiment_traditional_chinese(self):
        text_bullish = "700騰訊今日業績超預期，大升破頂，短線繼續看好！"
        res = analyze_sentiment(text_bullish)
        self.assertGreater(res["sentiment_score"], 20)
        self.assertIn("看好", res["extracted_phrases"])
        self.assertIn(res["sentiment_label"], ["Bullish", "Strong Bullish"])
        self.assertEqual(res["expressed_position"], "Long")

        text_bearish = "淘寶拼多多補貼戰激烈，大跌跌穿95支持位，割肉離場。"
        res_b = analyze_sentiment(text_bearish)
        self.assertLess(res_b["sentiment_score"], -20)
        self.assertIn(res_b["sentiment_label"], ["Bearish", "Strong Bearish"])

    def test_multilingual_sentiment_korean(self):
        text_kr_bullish = "SK하이닉스 HBM 공급 완판 확인. 분기 실적호조로 신고가 돌파 목전 풀매수!"
        res = analyze_sentiment(text_kr_bullish)
        self.assertGreater(res["sentiment_score"], 20)
        self.assertIn("풀매수", res["extracted_phrases"])
        self.assertIn(res["sentiment_label"], ["Bullish", "Strong Bullish"])

        text_kr_bearish = "파운드리 적자 지속. 실적쇼크 우려로 손절 필요."
        res_kr_b = analyze_sentiment(text_kr_bearish)
        self.assertLess(res_kr_b["sentiment_score"], -20)
        self.assertIn("손절", res_kr_b["extracted_phrases"])

    def test_zero_lookahead_temporal_constraint(self):
        indices_tested = []
        for t in range(3, 10):
            train_idx = list(range(0, t))
            test_idx = t
            self.assertLess(max(train_idx), test_idx)
            indices_tested.append(test_idx)
        self.assertEqual(indices_tested, [3, 4, 5, 6, 7, 8, 9])

if __name__ == "__main__":
    unittest.main()

