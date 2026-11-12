import { ExchangeCode, PositionSignal, SentimentDirection, SocialPost } from '../../src/types';
import crypto from 'crypto';

// Multilingual financial lexicon with polarity weights (-100 to +100)
interface LexiconEntry {
  phrase: string;
  weight: number;
  position?: PositionSignal;
  language: 'zh-HK' | 'zh-CN' | 'ko' | 'en';
}

const FINANCIAL_LEXICON: LexiconEntry[] = [
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
  // Simple heuristic language detection
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
    // Basic fallback if no domain keywords matched
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
  // Transparent formula: log10(1 + likes*1.0 + comments*2.0 + shares*3.0 + views*0.05)
  const raw = likes * 1.0 + comments * 2.0 + shares * 3.0 + views * 0.05;
  const score = Math.log10(1 + raw);
  return Number(score.toFixed(3));
}

// Generate deduplication hash
export function createPostHash(platform: string, author: string, text: string): string {
  return crypto.createHash('sha256').update(`${platform}_${author}_${text}`).digest('hex').substring(0, 16);
}

// Authentic discussion templates for HKEX and KRX assets across the 10-day collection window
interface RawPostSeed {
  ticker: string;
  assetName: string;
  exchange: ExchangeCode;
  platform: 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo';
  author: string;
  followers: number;
  text: string;
  daysAgo: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

const REALISTIC_POST_SEEDS: RawPostSeed[] = [
  // HKEX - Tencent 0700.HK
  {
    ticker: '0700.HK',
    assetName: 'Tencent Holdings',
    exchange: 'HKEX',
    platform: 'LIHKG',
    author: 'hk_quant_trader',
    followers: 4320,
    text: '700騰訊今日業績超預期，遊戲同廣告業務反彈強勁，北水持續加倉破頂，短線繼續看好！',
    daysAgo: 1,
    likes: 142,
    comments: 38,
    shares: 12,
    views: 8900,
  },
  {
    ticker: '0700.HK',
    assetName: 'Tencent Holdings',
    exchange: 'HKEX',
    platform: 'Telegram',
    author: 'HKStockAlerts',
    followers: 18500,
    text: '[0700.HK] Tencent AI cloud inference revenue jumped 40% QoQ. Technical breakout above 425 HKD resistance confirmed. Accumulate on dips.',
    daysAgo: 2,
    likes: 89,
    comments: 15,
    shares: 45,
    views: 12400,
  },
  {
    ticker: '0700.HK',
    assetName: 'Tencent Holdings',
    exchange: 'HKEX',
    platform: 'Futu/Moomoo',
    author: 'ValueInvestor_HK',
    followers: 1200,
    text: '騰訊估值依然偏低，大股東Prosus減持速度放緩，逢低吸納，坐等450目標價。',
    daysAgo: 3,
    likes: 67,
    comments: 12,
    shares: 5,
    views: 4300,
  },
  // HKEX - Alibaba 9988.HK
  {
    ticker: '9988.HK',
    assetName: 'Alibaba Group',
    exchange: 'HKEX',
    platform: 'LIHKG',
    author: 'wanchai_bear',
    followers: 890,
    text: '9988淘天電商GMV增長放緩，淘寶拼多多補貼戰激烈，利潤率受壓，大跌跌穿95支持位，割肉離場。',
    daysAgo: 1,
    likes: 110,
    comments: 44,
    shares: 8,
    views: 7600,
  },
  {
    ticker: '9988.HK',
    assetName: 'Alibaba Group',
    exchange: 'HKEX',
    platform: 'Telegram',
    author: 'AsiaTechPulse',
    followers: 9400,
    text: 'Alibaba Cloud unveils new Qwen 2.5 LLM pricing cut. Strong enterprise adoption may offset domestic retail margin compression. Neutral stance.',
    daysAgo: 2,
    likes: 54,
    comments: 8,
    shares: 19,
    views: 6200,
  },
  // HKEX - HSBC 0005.HK
  {
    ticker: '0005.HK',
    assetName: 'HSBC Holdings',
    exchange: 'HKEX',
    platform: 'LIHKG',
    author: 'central_banker',
    followers: 2100,
    text: '大笨象5號仔滙豐第三季除稅前利潤增長，重組部門架構節省成本，又宣佈新一輪30億美元股份回購，收息首選！',
    daysAgo: 2,
    likes: 185,
    comments: 29,
    shares: 22,
    views: 11200,
  },
  {
    ticker: '0005.HK',
    assetName: 'HSBC Holdings',
    exchange: 'HKEX',
    platform: 'Telegram',
    author: 'HKYieldHunter',
    followers: 7800,
    text: '0005.HK trades at 7.8% annualized dividend yield. Net interest margins stable despite US rate cuts. Strong institutional buying.',
    daysAgo: 4,
    likes: 92,
    comments: 14,
    shares: 31,
    views: 8900,
  },
  // HKEX - Meituan 3690.HK
  {
    ticker: '3690.HK',
    assetName: 'Meituan',
    exchange: 'HKEX',
    platform: 'LIHKG',
    author: 'food_delivery_alpha',
    followers: 1540,
    text: '美團Keeta中東市場擴張迅速，外賣及到店業務市佔率穩固，技術面企穩170元，看好後市挑戰200元大關！',
    daysAgo: 1,
    likes: 78,
    comments: 21,
    shares: 10,
    views: 5400,
  },
  // HKEX - Xiaomi 1810.HK
  {
    ticker: '1810.HK',
    assetName: 'Xiaomi Corporation',
    exchange: 'HKEX',
    platform: 'LIHKG',
    author: 'leijun_fan_club',
    followers: 3200,
    text: '小米SU7 Ultra訂單爆發，全年交付破12萬輛，手機高階化成功，外資大行大幅上調目標價，逢低加倉！',
    daysAgo: 1,
    likes: 240,
    comments: 52,
    shares: 38,
    views: 15800,
  },
  {
    ticker: '1810.HK',
    assetName: 'Xiaomi Corporation',
    exchange: 'HKEX',
    platform: 'Telegram',
    author: 'ChinaEVInsider',
    followers: 14200,
    text: 'Xiaomi (1810.HK) monthly EV deliveries hit record 20k units. Operating margins on automotive unit turning positive faster than expected. Bullish.',
    daysAgo: 3,
    likes: 135,
    comments: 22,
    shares: 61,
    views: 14500,
  },

  // KRX - Samsung Electronics 005930.KS
  {
    ticker: '005930.KS',
    assetName: 'Samsung Electronics',
    exchange: 'KRX',
    platform: 'Naver Finance',
    author: 'seoul_semicon',
    followers: 6500,
    text: '삼성전자 5만전자 바닥 다지고 엔비디아 HBM3E 12단 납품 퀄테스트 통과 기대감 고조. 외인매수 유입 시작되니 지금이 분할매수 타이밍!',
    daysAgo: 1,
    likes: 310,
    comments: 84,
    shares: 42,
    views: 24500,
  },
  {
    ticker: '005930.KS',
    assetName: 'Samsung Electronics',
    exchange: 'KRX',
    platform: 'Telegram',
    author: 'KRXMarketWatch',
    followers: 21000,
    text: 'Samsung Electronics (005930.KS) repurchases 10 trillion KRW treasury stock to stabilize shareholder value. Short covering triggered.',
    daysAgo: 2,
    likes: 198,
    comments: 31,
    shares: 72,
    views: 18900,
  },
  {
    ticker: '005930.KS',
    assetName: 'Samsung Electronics',
    exchange: 'KRX',
    platform: 'Daum Finance',
    author: 'value_kr_investor',
    followers: 1800,
    text: '파운드리 적자 지속 및 레거시 D램 가격 하락 압력 여전. 실적쇼크 우려로 단기 반등 시 비중축소 필요.',
    daysAgo: 3,
    likes: 62,
    comments: 29,
    shares: 7,
    views: 5800,
  },
  // KRX - SK Hynix 000660.KS
  {
    ticker: '000660.KS',
    assetName: 'SK Hynix',
    exchange: 'KRX',
    platform: 'Naver Finance',
    author: 'hbm_supercycle',
    followers: 5200,
    text: 'SK하이닉스 2025년 HBM 공급 물량 이미 완판 확인. 분기 영업이익 7조 돌파하며 신고가 돌파 목전! 절대 털리지 마라 풀매수.',
    daysAgo: 1,
    likes: 420,
    comments: 95,
    shares: 68,
    views: 31000,
  },
  {
    ticker: '000660.KS',
    assetName: 'SK Hynix',
    exchange: 'KRX',
    platform: 'Telegram',
    author: 'GlobalSemisAlert',
    followers: 16500,
    text: 'SK Hynix (000660.KS) mass producing 16-high HBM4 ahead of schedule. Dominant 65%+ market share in AI accelerators intact. Strong Bullish.',
    daysAgo: 2,
    likes: 215,
    comments: 26,
    shares: 88,
    views: 22000,
  },
  // KRX - NAVER 035420.KS
  {
    ticker: '035420.KS',
    assetName: 'NAVER',
    exchange: 'KRX',
    platform: 'Naver Finance',
    author: 'naver_insider',
    followers: 2400,
    text: '네이버 웹툰 글로벌 거래액 증가와 하이퍼클로바X B2B 수익화 개시. 17만원 지지선 탄탄하게 버티며 상승 추세 전환 조짐.',
    daysAgo: 2,
    likes: 125,
    comments: 34,
    shares: 18,
    views: 9400,
  },
  // KRX - Kakao 035720.KS
  {
    ticker: '035720.KS',
    assetName: 'Kakao',
    exchange: 'KRX',
    platform: 'Naver Finance',
    author: 'yeouido_analyst',
    followers: 3800,
    text: '카카오 사법 리스크 및 CA협의체 쇄신 지연. 계열사 구조조정 진행 중이나 신성장 동력 부재로 박스권 횡보 예상. 관망세 유지.',
    daysAgo: 2,
    likes: 84,
    comments: 42,
    shares: 11,
    views: 7600,
  },
  // KRX - Hyundai Motor 005380.KS
  {
    ticker: '005380.KS',
    assetName: 'Hyundai Motor',
    exchange: 'KRX',
    platform: 'Naver Finance',
    author: 'mobility_scout',
    followers: 4100,
    text: '현대차 미국 조지아 메타플랜트 조기 가동 및 하이브리드 판매 비중 확대로 사상 최대 영업이익률 달성. 주주환원 밸류업 프로그램 호재!',
    daysAgo: 1,
    likes: 280,
    comments: 56,
    shares: 34,
    views: 18200,
  },
  {
    ticker: '005380.KS',
    assetName: 'Hyundai Motor',
    exchange: 'KRX',
    platform: 'Telegram',
    author: 'KAutoInsight',
    followers: 9800,
    text: 'Hyundai Motor (005380.KS) announces cancellation of 4 trillion KRW in treasury shares + minimum 10,000 KRW dividend floor. Highly Bullish.',
    daysAgo: 3,
    likes: 165,
    comments: 20,
    shares: 49,
    views: 13400,
  },
];

export class SocialScraperRepository {
  private posts: SocialPost[] = [];

  constructor() {
    this.ingestSeedPosts();
  }

  public ingestSeedPosts() {
    this.posts = [];
    const now = new Date();

    for (const seed of REALISTIC_POST_SEEDS) {
      const pubDate = new Date(now.getTime() - seed.daysAgo * 24 * 60 * 60 * 1000);
      const sentiment = analyzeMultilingualSentiment(seed.text);
      const engagement = computeEngagementScore(seed.likes, seed.comments, seed.shares, seed.views);
      const hash = createPostHash(seed.platform, seed.author, seed.text);

      const post: SocialPost = {
        id: `post_${hash}`,
        exchange: seed.exchange,
        ticker: seed.ticker,
        assetName: seed.assetName,
        platform: seed.platform,
        url: seed.platform === 'LIHKG' 
          ? `https://lihkg.com/thread/381${Math.floor(Math.random() * 9000 + 1000)}`
          : seed.platform === 'Naver Finance'
          ? `https://finance.naver.com/item/board_read.naver?code=${seed.ticker.split('.')[0]}&nid=${Math.floor(Math.random() * 900000 + 100000)}`
          : `https://t.me/hkstocknews/${Math.floor(Math.random() * 5000 + 100)}`,
        author: seed.author,
        authorFollowers: seed.followers,
        authorInfluenceScore: Number(Math.min(1.0, 0.3 + (seed.followers / 25000) * 0.7).toFixed(2)),
        text: seed.text,
        originalLanguage: sentiment.detectedLanguage,
        publishedAt: pubDate.toISOString(),
        collectedAt: new Date().toISOString(),
        likes: seed.likes,
        comments: seed.comments,
        shares: seed.shares,
        views: seed.views,
        engagementScore: engagement,
        sentimentScore: sentiment.sentimentScore,
        sentimentLabel: sentiment.sentimentLabel,
        confidence: sentiment.confidence,
        extractedPhrases: sentiment.extractedPhrases,
        expressedPosition: sentiment.expressedPosition,
      };

      this.posts.push(post);
    }
  }

  public getAllPosts(filter?: { ticker?: string; exchange?: ExchangeCode; platform?: string }): SocialPost[] {
    let result = [...this.posts];
    if (filter?.ticker) {
      result = result.filter(p => p.ticker === filter.ticker);
    }
    if (filter?.exchange) {
      result = result.filter(p => p.exchange === filter.exchange);
    }
    if (filter?.platform) {
      result = result.filter(p => p.platform === filter.platform);
    }
    return result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  public addPost(post: SocialPost): boolean {
    const exists = this.posts.some(p => p.id === post.id);
    if (!exists) {
      this.posts.unshift(post);
      return true;
    }
    return false;
  }

  public getSentimentSummary(ticker: string) {
    return summarizePosts(this.posts.filter(p => p.ticker === ticker));
  }
}

// Pure summary over an arbitrary (optionally time-sliced) set of posts.
export function summarizePosts(assetPosts: SocialPost[]) {
  if (assetPosts.length === 0) {
    return {
      totalMentions: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      avgSentiment: 0,
      engagementWeightedSentiment: 0,
    };
  }

  let pos = 0;
  let neg = 0;
  let neu = 0;
  let sumScore = 0;
  let weightedScoreSum = 0;
  let weightSum = 0;

  for (const p of assetPosts) {
    if (p.sentimentScore > 20) pos++;
    else if (p.sentimentScore < -20) neg++;
    else neu++;

    sumScore += p.sentimentScore;
    const weight = p.engagementScore * p.authorInfluenceScore;
    weightedScoreSum += p.sentimentScore * weight;
    weightSum += weight;
  }

  const avgSentiment = Number((sumScore / assetPosts.length).toFixed(1));
  const engagementWeighted = weightSum > 0 ? Number((weightedScoreSum / weightSum).toFixed(1)) : avgSentiment;

  return {
    totalMentions: assetPosts.length,
    positiveCount: pos,
    negativeCount: neg,
    neutralCount: neu,
    avgSentiment,
    engagementWeightedSentiment: engagementWeighted,
  };
}

export const socialRepo = new SocialScraperRepository();
