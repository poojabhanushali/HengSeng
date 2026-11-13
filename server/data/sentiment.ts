import crypto from 'crypto';
import {
  ExchangeCode, PositionSignal, SentimentDirection, SocialPost,
} from '../../src/types';

// Multilingual financial lexicon with polarity weights (-100 to +100)
interface LexiconEntry {
  phrase: string;
  weight: number;
  position?: PositionSignal;
  language: 'zh-HK' | 'zh-CN' | 'ko' | 'en';
}

export const FINANCIAL_LEXICON: LexiconEntry[] = [
  // Traditional Chinese / Hong Kong Cantonese financial slang
  { phrase: '看好', weight: 65, position: 'Long', language: 'zh-HK' },
  { phrase: '破頂', weight: 80, position: 'Long', language: 'zh-HK' },
  { phrase: '大升', weight: 85, position: 'Long', language: 'zh-HK' },
  { phrase: '突破', weight: 70, position: 'Long', language: 'zh-HK' },
  { phrase: '買入', weight: 75, position: 'Long', language: 'zh-HK' },
  { phrase: '逢低吸納', weight: 60, position: 'Accumulating', language: 'zh-HK' },
  { phrase: '撈底', weight: 65, position: 'Accumulating', language: 'zh-HK' },
  { phrase: '加倉', weight: 70, position: 'Accumulating', language: 'zh-HK' },
  { phrase: '業績超預期', weight: 90, position: 'Long', language: 'zh-HK' },
  { phrase: '好消息', weight: 55, language: 'zh-HK' },
  { phrase: '看淡', weight: -65, position: 'Short', language: 'zh-HK' },
  { phrase: '大跌', weight: -85, position: 'Short', language: 'zh-HK' },
  { phrase: '破底', weight: -80, position: 'Short', language: 'zh-HK' },
  { phrase: '割肉', weight: -75, position: 'Stop-loss', language: 'zh-HK' },
  { phrase: '止蝕', weight: -60, position: 'Stop-loss', language: 'zh-HK' },
  { phrase: '止賺', weight: 30, position: 'Taking Profit', language: 'zh-HK' },
  { phrase: '沽空', weight: -85, position: 'Short', language: 'zh-HK' },
  { phrase: '被套', weight: -50, position: 'Holding', language: 'zh-HK' },
  { phrase: '高估', weight: -60, language: 'zh-HK' },
  { phrase: '橫行', weight: 0, position: 'Neutral', language: 'zh-HK' },

  // Korean financial terms & stock community jargon
  { phrase: '풀매수', weight: 90, position: 'Long', language: 'ko' },
  { phrase: '급등', weight: 85, position: 'Long', language: 'ko' },
  { phrase: '상승장', weight: 75, position: 'Long', language: 'ko' },
  { phrase: '신고가', weight: 85, position: 'Long', language: 'ko' },
  { phrase: '외인매수', weight: 70, position: 'Accumulating', language: 'ko' },
  { phrase: '실적호조', weight: 85, language: 'ko' },
  { phrase: '저평가', weight: 60, position: 'Accumulating', language: 'ko' },
  { phrase: '목표가 상향', weight: 75, language: 'ko' },
  { phrase: '떡상', weight: 85, position: 'Long', language: 'ko' },
  { phrase: '존버', weight: 15, position: 'Holding', language: 'ko' },
  { phrase: '급락', weight: -85, position: 'Short', language: 'ko' },
  { phrase: '폭락', weight: -90, position: 'Short', language: 'ko' },
  { phrase: '신저가', weight: -85, position: 'Short', language: 'ko' },
  { phrase: '손절', weight: -75, position: 'Stop-loss', language: 'ko' },
  { phrase: '익절', weight: 35, position: 'Taking Profit', language: 'ko' },
  { phrase: '개미털기', weight: -40, language: 'ko' },
  { phrase: '실적쇼크', weight: -85, language: 'ko' },
  { phrase: '공매도', weight: -70, position: 'Short', language: 'ko' },
  { phrase: '물렸다', weight: -60, position: 'Holding', language: 'ko' },
  { phrase: '떡락', weight: -85, position: 'Short', language: 'ko' },
  { phrase: '관망', weight: 0, position: 'Neutral', language: 'ko' },

  // English financial terms
  { phrase: 'bullish', weight: 75, position: 'Long', language: 'en' },
  { phrase: 'breakout', weight: 80, position: 'Long', language: 'en' },
  { phrase: 'accumulate', weight: 65, position: 'Accumulating', language: 'en' },
  { phrase: 'buy the dip', weight: 70, position: 'Accumulating', language: 'en' },
  { phrase: 'earnings beat', weight: 85, language: 'en' },
  { phrase: 'upgrade', weight: 70, language: 'en' },
  { phrase: 'target price raise', weight: 75, language: 'en' },
  { phrase: 'undervalued', weight: 60, position: 'Accumulating', language: 'en' },
  { phrase: 'rally', weight: 65, position: 'Long', language: 'en' },
  { phrase: 'bearish', weight: -75, position: 'Short', language: 'en' },
  { phrase: 'sell-off', weight: -80, position: 'Short', language: 'en' },
  { phrase: 'downgrade', weight: -75, language: 'en' },
  { phrase: 'earnings miss', weight: -85, language: 'en' },
  { phrase: 'overvalued', weight: -60, position: 'Short', language: 'en' },
  { phrase: 'stop loss hit', weight: -70, position: 'Stop-loss', language: 'en' },
  { phrase: 'taking profit', weight: 25, position: 'Taking Profit', language: 'en' },
  { phrase: 'short squeeze', weight: 65, position: 'Long', language: 'en' },
  { phrase: 'neutral outlook', weight: 0, position: 'Neutral', language: 'en' },
];

export function analyzeMultilingualSentiment(text: string): {
  sentimentScore: number;
  sentimentLabel: SentimentDirection;
  confidence: number;
  extractedPhrases: string[];
  detectedLanguage: 'zh-HK' | 'zh-CN' | 'ko' | 'en';
  expressedPosition?: PositionSignal;
} {
  const hasKorean = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);
  const detectedLanguage = hasKorean ? 'ko' : hasChinese ? 'zh-HK' : 'en';

  const lower = text.toLowerCase();
  const matchedPhrases: string[] = [];
  let scoreSum = 0;
  let matchesCount = 0;
  let detectedPos: PositionSignal | undefined;

  for (const item of FINANCIAL_LEXICON) {
    if (text.includes(item.phrase) || lower.includes(item.phrase.toLowerCase())) {
      matchedPhrases.push(item.phrase);
      scoreSum += item.weight;
      matchesCount++;
      if (item.position && !detectedPos) {
        detectedPos = item.position;
      }
    }
  }

  let finalScore = 0;
  let confidence = 0.5;

  if (matchesCount > 0) {
    finalScore = Math.max(-100, Math.min(100, Math.round(scoreSum / matchesCount)));
    confidence = Math.min(0.95, 0.6 + matchesCount * 0.08);
  } else {
    finalScore = 0;
    confidence = 0.4;
  }

  let sentimentLabel: SentimentDirection = 'Neutral';
  if (finalScore >= 60) sentimentLabel = 'Strong Bullish';
  else if (finalScore >= 20) sentimentLabel = 'Bullish';
  else if (finalScore <= -60) sentimentLabel = 'Strong Bearish';
  else if (finalScore <= -20) sentimentLabel = 'Bearish';

  return {
    sentimentScore: finalScore,
    sentimentLabel,
    confidence: Number(confidence.toFixed(2)),
    extractedPhrases: matchedPhrases,
    detectedLanguage,
    expressedPosition: detectedPos,
  };
}

export function computeEngagementScore(likes: number, comments: number, shares: number, views: number): number {
  const raw = likes * 1.0 + comments * 2.0 + shares * 3.0 + views * 0.05;
  const score = Math.log10(1 + raw);
  return Number(score.toFixed(3));
}

export function createPostHash(platform: string, author: string, text: string): string {
  return crypto.createHash('sha256').update(`${platform}_${author}_${text}`).digest('hex').substring(0, 16);
}
