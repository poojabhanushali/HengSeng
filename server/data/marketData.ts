import { Asset, ExchangeCode, PriceBar, SentimentDirection, RiskLevel } from '../../src/types';

// The 10 monitored assets across HKEX and KRX
export const INITIAL_ASSET_UNIVERSE = [
  // Hong Kong Exchange (HKEX) - Asia/Hong_Kong - Currency HKD
  {
    ticker: '0700.HK',
    name: 'Tencent Holdings',
    nameLocal: '騰訊控股',
    exchange: 'HKEX' as ExchangeCode,
    sector: 'Internet & Interactive Media',
    currency: 'HKD',
    basePrice: 428.60,
    high52w: 482.00,
    low52w: 260.20,
    avgVolume: 24500000,
  },
  {
    ticker: '9988.HK',
    name: 'Alibaba Group',
    nameLocal: '阿里巴巴-SW',
    exchange: 'HKEX' as ExchangeCode,
    sector: 'E-commerce & Cloud Computing',
    currency: 'HKD',
    basePrice: 94.85,
    high52w: 118.50,
    low52w: 64.60,
    avgVolume: 48200000,
  },
  {
    ticker: '0005.HK',
    name: 'HSBC Holdings',
    nameLocal: '滙豐控股',
    exchange: 'HKEX' as ExchangeCode,
    sector: 'Banking & Financial Services',
    currency: 'HKD',
    basePrice: 71.30,
    high52w: 74.20,
    low52w: 57.10,
    avgVolume: 18400000,
  },
  {
    ticker: '3690.HK',
    name: 'Meituan',
    nameLocal: '美團-W',
    exchange: 'HKEX' as ExchangeCode,
    sector: 'Consumer Services & Delivery',
    currency: 'HKD',
    basePrice: 172.40,
    high52w: 215.00,
    low52w: 61.10,
    avgVolume: 32100000,
  },
  {
    ticker: '1810.HK',
    name: 'Xiaomi Corporation',
    nameLocal: '小米集團-W',
    exchange: 'HKEX' as ExchangeCode,
    sector: 'Consumer Electronics & EVs',
    currency: 'HKD',
    basePrice: 28.15,
    high52w: 30.45,
    low52w: 11.80,
    avgVolume: 65400000,
  },
  // Korea Exchange (KRX) - Asia/Seoul - Currency KRW
  {
    ticker: '005930.KS',
    name: 'Samsung Electronics',
    nameLocal: '삼성전자',
    exchange: 'KRX' as ExchangeCode,
    sector: 'Semiconductors & Electronics',
    currency: 'KRW',
    basePrice: 57800,
    high52w: 88800,
    low52w: 52000,
    avgVolume: 16800000,
  },
  {
    ticker: '000660.KS',
    name: 'SK Hynix',
    nameLocal: 'SK하이닉스',
    exchange: 'KRX' as ExchangeCode,
    sector: 'Memory Semiconductors (HBM)',
    currency: 'KRW',
    basePrice: 196500,
    high52w: 248500,
    low52w: 115000,
    avgVolume: 4200000,
  },
  {
    ticker: '035420.KS',
    name: 'NAVER',
    nameLocal: '네이버',
    exchange: 'KRX' as ExchangeCode,
    sector: 'Internet Search & AI Services',
    currency: 'KRW',
    basePrice: 178200,
    high52w: 228000,
    low52w: 151100,
    avgVolume: 740000,
  },
  {
    ticker: '035720.KS',
    name: 'Kakao',
    nameLocal: '카카오',
    exchange: 'KRX' as ExchangeCode,
    sector: 'Messaging & Fintech Platform',
    currency: 'KRW',
    basePrice: 38450,
    high52w: 61900,
    low52w: 33450,
    avgVolume: 1120000,
  },
  {
    ticker: '005380.KS',
    name: 'Hyundai Motor',
    nameLocal: '현대자동차',
    exchange: 'KRX' as ExchangeCode,
    sector: 'Automotive & Mobility Solutions',
    currency: 'KRW',
    basePrice: 218500,
    high52w: 298000,
    low52w: 172000,
    avgVolume: 890000,
  },
];

// Helper to calculate technical indicators on PriceBar series
export function computeTechnicalIndicators(bars: PriceBar[]): PriceBar[] {
  const result = [...bars];

  // 1. Calculate SMA-5 and SMA-10
  for (let i = 0; i < result.length; i++) {
    if (i >= 4) {
      const slice5 = result.slice(i - 4, i + 1);
      result[i].sma5 = Number((slice5.reduce((sum, b) => sum + b.close, 0) / 5).toFixed(2));
    }
    if (i >= 9) {
      const slice10 = result.slice(i - 9, i + 1);
      result[i].sma10 = Number((slice10.reduce((sum, b) => sum + b.close, 0) / 10).toFixed(2));
    }
  }

  // 2. Calculate RSI (14 periods) - Wilder's RSI.
  // When fewer than 14 changes are available, use an adaptive shorter period and
  // record it on the bar so the UI never labels a 9-period value as a 14-period RSI.
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < result.length; i++) {
    const change = result[i].close - result[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    if (i === 1) {
      avgGain = gain;
      avgLoss = loss;
    } else if (i <= 14) {
      avgGain += gain;
      avgLoss += loss;
    } else {
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
    }

    if (i >= 2) {
      const period = Math.min(14, i);
      const avgG = avgGain / period;
      const avgL = avgLoss / period;
      const rs = avgL === 0 ? 100 : avgG / avgL;
      result[i].rsi14 = Number((100 - (100 / (1 + rs))).toFixed(2));
      result[i].rsiPeriod = period;
      if (i === 14) {
        avgGain = avgG;
        avgLoss = avgL;
      }
    }
  }

  // 3. Calculate MACD (12, 26, 9)
  const ema12 = calculateEMA(result.map(b => b.close), 12);
  const ema26 = calculateEMA(result.map(b => b.close), 26);
  const macdLine = ema12.map((val, idx) => Number((val - ema26[idx]).toFixed(2)));
  const signalLine = calculateEMA(macdLine, 9);

  for (let i = 0; i < result.length; i++) {
    result[i].macd = macdLine[i];
    result[i].macdSignal = signalLine[i];
  }

  return result;
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prevEma = values[0];
  ema.push(prevEma);

  for (let i = 1; i < values.length; i++) {
    const currentEma = values[i] * k + prevEma * (1 - k);
    ema.push(Number(currentEma.toFixed(2)));
    prevEma = currentEma;
  }
  return ema;
}

// Support and Resistance calculation using Classic Floor Trader Pivot Points & Swing Highs/Lows
export function calculatePivotLevels(bars: PriceBar[]) {
  if (bars.length === 0) return { pivot: 0, s1: 0, s2: 0, r1: 0, r2: 0, swingHigh: 0, swingLow: 0 };
  
  const lastBar = bars[bars.length - 1];
  const high = lastBar.high;
  const low = lastBar.low;
  const close = lastBar.close;

  const pivot = Number(((high + low + close) / 3).toFixed(2));
  const r1 = Number((2 * pivot - low).toFixed(2));
  const s1 = Number((2 * pivot - high).toFixed(2));
  const r2 = Number((pivot + (high - low)).toFixed(2));
  const s2 = Number((pivot - (high - low)).toFixed(2));

  // 10-day rolling swing highs & lows
  const swingHigh = Math.max(...bars.map(b => b.high));
  const swingLow = Math.min(...bars.map(b => b.low));

  return {
    pivot,
    s1,
    s2,
    r1,
    r2,
    swingHigh: Number(swingHigh.toFixed(2)),
    swingLow: Number(swingLow.toFixed(2)),
  };
}

// Generate realistic 10-day historical daily bars for an asset
export function generateHistoricalBars(ticker: string, basePrice: number, days = 10): PriceBar[] {
  const bars: PriceBar[] = [];
  const now = new Date();
  
  // Seed deterministically based on ticker characters for consistency
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i);

  function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  let currentClose = basePrice;
  const dateCursor = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  for (let d = 0; d < days; d++) {
    dateCursor.setDate(dateCursor.getDate() + 1);
    
    // Skip weekends
    const dayOfWeek = dateCursor.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const volatility = 0.018; // ~1.8% daily volatility
    const changePct = (seededRandom() - 0.48) * 2 * volatility;
    const open = Number((currentClose * (1 + (seededRandom() - 0.5) * 0.005)).toFixed(2));
    const close = Number((currentClose * (1 + changePct)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + seededRandom() * 0.012)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - seededRandom() * 0.012)).toFixed(2));
    const volume = Math.floor(1000000 + seededRandom() * 15000000);

    bars.push({
      timestamp: dateCursor.toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });

    currentClose = close;
  }

  return computeTechnicalIndicators(bars);
}

// In-memory store of market data for 10 assets
export class MarketDataRepository {
  private barsMap: Map<string, PriceBar[]> = new Map();
  private assetsMap: Map<string, Asset> = new Map();

  constructor() {
    this.initializeData();
  }

  public initializeData() {
    for (const info of INITIAL_ASSET_UNIVERSE) {
      const bars = generateHistoricalBars(info.ticker, info.basePrice, 14);
      this.barsMap.set(info.ticker, bars);

      const latestBar = bars[bars.length - 1];
      const prevBar = bars.length > 1 ? bars[bars.length - 2] : latestBar;
      const priceChange = Number((latestBar.close - prevBar.close).toFixed(2));
      const priceChangePercent = Number(((priceChange / prevBar.close) * 100).toFixed(2));
      const pivots = calculatePivotLevels(bars);

      const asset: Asset = {
        ticker: info.ticker,
        name: info.name,
        nameLocal: info.nameLocal,
        exchange: info.exchange,
        sector: info.sector,
        currency: info.currency,
        currentPrice: latestBar.close,
        previousClose: prevBar.close,
        priceChange,
        priceChangePercent,
        priceTimestamp: latestBar.timestamp,
        high52w: info.high52w,
        low52w: info.low52w,
        volume: latestBar.volume,
        overallSentiment: 0,
        sentimentDirection: 'Neutral',
        sentimentConfidence: 0.75,
        socialMentions: 0,
        newsMentions: 0,
        engagementWeightedSentiment: 0,
        positionSignal: priceChangePercent > 1.2 ? 'Long' : priceChangePercent < -1.2 ? 'Short' : 'Holding',
        marketTrend: priceChangePercent > 0.5 ? 'Uptrend' : priceChangePercent < -0.5 ? 'Downtrend' : 'Consolidation',
        supportLevels: [pivots.s1, pivots.s2, pivots.swingLow],
        resistanceLevels: [pivots.r1, pivots.r2, pivots.swingHigh],
        pivotPoint: pivots.pivot,
        riskClassification: Math.abs(priceChangePercent) > 2.5 ? 'High' : Math.abs(priceChangePercent) > 1.0 ? 'Medium' : 'Low',
        predictedPrice: latestBar.close,
        predictedChangePercent: 0,
        predictionDirection: 'Neutral',
        predictionConfidence: 0.82,
        lastUpdated: new Date().toISOString(),
      };

      this.assetsMap.set(info.ticker, asset);
    }
  }

  public getAllAssets(): Asset[] {
    return Array.from(this.assetsMap.values());
  }

  public getAsset(ticker: string): Asset | undefined {
    return this.assetsMap.get(ticker);
  }

  public getBars(ticker: string): PriceBar[] {
    return this.barsMap.get(ticker) || [];
  }

  public updateAsset(asset: Asset) {
    this.assetsMap.set(asset.ticker, asset);
  }
}

export const marketRepo = new MarketDataRepository();
