export type ExchangeCode = 'HKEX' | 'KRX';

export type SentimentDirection = 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';

export type PositionSignal = 'Long' | 'Short' | 'Accumulating' | 'Taking Profit' | 'Stop-loss' | 'Holding' | 'Neutral';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface Asset {
  ticker: string;
  name: string;
  nameLocal: string;
  exchange: ExchangeCode;
  sector: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  priceChange: number;
  priceChangePercent: number;
  priceTimestamp: string;
  high52w: number;
  low52w: number;
  volume: number;
  // Sentiment metrics
  overallSentiment: number; // -100 to +100
  sentimentDirection: SentimentDirection;
  sentimentConfidence: number; // 0 to 1
  socialMentions: number;
  newsMentions: number;
  engagementWeightedSentiment: number;
  // Position & Technicals
  positionSignal: PositionSignal;
  marketTrend: 'Uptrend' | 'Downtrend' | 'Consolidation';
  supportLevels: number[];
  resistanceLevels: number[];
  pivotPoint: number;
  riskClassification: RiskLevel;
  // Prediction
  predictedPrice: number;
  predictedChangePercent: number;
  predictionDirection: SentimentDirection;
  predictionConfidence: number;
  lastUpdated: string;
}

export interface PriceBar {
  timestamp: string; // ISO UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma5?: number;
  sma10?: number;
  rsi14?: number;
  rsiPeriod?: number;
  macd?: number;
  macdSignal?: number;
}

export interface SocialPost {
  id: string;
  exchange: ExchangeCode;
  ticker: string;
  assetName: string;
  platform: 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo';
  url: string;
  author: string;
  authorFollowers?: number;
  authorInfluenceScore: number; // 0 to 1
  text: string;
  textEn?: string; // English translation (shown underneath for non-English posts)
  originalLanguage: 'zh-HK' | 'zh-CN' | 'ko' | 'en';
  publishedAt: string; // ISO UTC
  collectedAt: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementScore: number;
  sentimentScore: number; // -100 to +100
  sentimentLabel: SentimentDirection;
  confidence: number;
  extractedPhrases: string[];
  expressedPosition?: PositionSignal;
}

export interface NewsArticle {
  id: string;
  ticker: string;
  assetName: string;
  exchange: ExchangeCode;
  title: string;
  titleEn?: string; // English translation
  url: string;
  publisher: string;
  publishedAt: string;
  retrievedAt: string;
  searchQuery: string;
  relevanceScore: number; // 0 to 1
  summary: string;
  summaryEn?: string; // English translation
  sentimentScore: number; // -100 to +100
  sentimentLabel: SentimentDirection;
  confidence: number;
  keyThemes: string[];
}

export interface PredictionDetail {
  ticker: string;
  assetName: string;
  exchange: ExchangeCode;
  currentPrice: number;
  predictedPrice: number;
  predictedChange: number;
  predictedChangePercent: number;
  direction: SentimentDirection;
  predictionHorizon: 'Next Trading Day (n+1)' | 'Next Session';
  generatedAt: string;
  targetDate: string;
  modelName: string;
  confidenceInterval: {
    lower95: number;
    upper95: number;
  };
  featureImportance: {
    feature: string;
    importance: number;
    value: number | string;
    impact: 'Positive' | 'Negative' | 'Neutral';
  }[];
  validationMetrics: {
    mae: number;
    rmse: number;
    directionalAccuracy: number;
    baselineImprovementPercent: number;
  };
}

export interface ModelPerformance {
  modelName: string;
  description: string;
  mae: number;
  rmse: number;
  mape: number;
  directionalAccuracy: number; // 0-100%
  r2Score: number;
  baselineImprovement: number;
  sampleCount: number;
  lastTrained: string;
  isChampion: boolean;
}

export interface BacktestPoint {
  date: string;
  actualPrice: number;
  predictedPrice: number;
  directionMatch: boolean;
  absoluteError: number;
  sentimentScore: number;
}

export interface IngestionJob {
  id: string;
  agentId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  startTime: string;
  endTime?: string;
  durationMs: number;
  recordsProcessed: number;
  error?: string;
  details: string;
}

export interface AgentExecutionState {
  agentNumber: number;
  agentName: string;
  role: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRunTime: string;
  durationMs: number;
  itemsProcessed: number;
  qualityScore: number; // 0-100
  message: string;
}

export interface SystemSettings {
  apifyApiToken: string;
  apifyLihkgActorId: string;
  apifyTelegramActorId: string;
  apifyNaverActorId: string;
  apifyDaumActorId: string;
  exaApiKey: string;
  marketDataProvider: 'Local Deterministic OHLCV (Curated Fallback)' | 'Yahoo Finance (Direct)' | 'Alpha Vantage' | 'Twelve Data';
  marketDataApiKey: string;
  bullishThreshold: number; // e.g. 20
  bearishThreshold: number; // e.g. -20
  predictionHorizonDays: number; // default 1 (n+1)
  dataRetentionDays: number;
  enableAutomatedOrchestration: boolean;
  orchestrationIntervalHours: number;
  languagePrefs?: LanguagePrefs;
}

export type LanguageCode = 'en' | 'zh-HK' | 'ko';

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  user: User;
}

export interface LanguagePrefs {
  en: boolean;
  'zh-HK': boolean;
  ko: boolean;
}

export interface ExecutiveReport {
  id: string;
  title: string;
  createdAt: string;
  exchange: ExchangeCode | 'ALL';
  topBullishAsset: string;
  topBearishAsset: string;
  averageSentiment: number;
  totalMentions: number;
  totalNews: number;
  modelDirectionalAccuracy: number;
  summaryProse: string;
  assetsRanked: Asset[];
  modelName: string;
  modelVersion: string;
  evaluationPeriod: string;
  sampleSize: number;
  mae: number;
  mape: number;
  rmse: number;
  r2Score: number;
  baselineImprovementPercent: number;
  limitations: string[];
}
