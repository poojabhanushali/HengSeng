import { Asset, ExchangeCode, PriceBar, SentimentDirection, RiskLevel } from '../../src/types';
import ASSET_UNIVERSE from './assets.json';
import {
  computeTechnicalIndicators,
  calculatePivotLevels,
  generateHistoricalBars,
} from './marketGenerators';
import { appDb } from '../db/sqlite';

// ---------------------------------------------------------------------------
// In-memory market data repository backed by SQLite persistence
// ---------------------------------------------------------------------------

export class MarketDataRepository {
  private barsMap: Map<string, PriceBar[]> = new Map();
  private assetsMap: Map<string, Asset> = new Map();

  constructor() {
    this.initializeData();
  }

  public initializeData() {
    this.barsMap.clear();
    this.assetsMap.clear();
    this.loadFromDb();
  }

  private loadFromDb() {
    const db = appDb.db;
    const rows = db.prepare('SELECT * FROM assets').all() as any[];
    for (const r of rows) {
      const asset: Asset = {
        ticker: r.ticker,
        name: r.name,
        nameLocal: r.name_local,
        exchange: r.exchange as ExchangeCode,
        sector: r.sector,
        currency: r.currency,
        currentPrice: r.current_price,
        previousClose: r.previous_close,
        priceChange: r.price_change,
        priceChangePercent: r.price_change_percent,
        priceTimestamp: r.price_timestamp,
        high52w: r.high52w,
        low52w: r.low52w,
        volume: r.avg_volume,
        overallSentiment: r.overall_sentiment,
        sentimentDirection: r.sentiment_direction as SentimentDirection,
        sentimentConfidence: r.sentiment_confidence,
        socialMentions: r.social_mentions,
        newsMentions: r.news_mentions,
        engagementWeightedSentiment: r.engagement_weighted_sentiment,
        positionSignal: r.position_signal as any,
        marketTrend: r.market_trend as any,
        supportLevels: fromJsonArray(r.support_levels),
        resistanceLevels: fromJsonArray(r.resistance_levels),
        pivotPoint: r.pivot_point,
        riskClassification: r.risk_classification as RiskLevel,
        predictedPrice: r.predicted_price,
        predictedChangePercent: r.predicted_change_percent,
        predictionDirection: r.prediction_direction as SentimentDirection,
        predictionConfidence: r.prediction_confidence,
        lastUpdated: r.last_updated,
      };
      this.assetsMap.set(r.ticker, asset);
    }

    const barRows = db.prepare('SELECT * FROM price_bars ORDER BY ticker, timestamp').all() as any[];
    const byTicker = new Map<string, any[]>();
    for (const r of barRows) {
      if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
      byTicker.get(r.ticker)!.push(r);
    }
    for (const [ticker, rows] of byTicker) {
      this.barsMap.set(ticker, rows.map(r => ({
        timestamp: r.timestamp,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
        sma5: r.sma5 ?? undefined,
        sma10: r.sma10 ?? undefined,
        rsi14: r.rsi14 ?? undefined,
        rsiPeriod: r.rsi_period ?? undefined,
        macd: r.macd ?? undefined,
        macdSignal: r.macd_signal ?? undefined,
      })));
    }

    // If DB is empty (fresh), seed from JSON + deterministic generator
    if (this.assetsMap.size === 0) {
      this.seedFromJson();
    }
  }

  private seedFromJson() {
    const db = appDb.db;
    const tx = db.transaction(() => {
      const insertAsset = db.prepare(`
        INSERT OR IGNORE INTO assets (
          ticker,name,name_local,exchange,sector,currency,base_price,high52w,low52w,avg_volume,
          current_price,previous_close,price_change,price_change_percent,price_timestamp,
          overall_sentiment,sentiment_direction,sentiment_confidence,social_mentions,news_mentions,
          engagement_weighted_sentiment,position_signal,market_trend,pivot_point,risk_classification,
          predicted_price,predicted_change_percent,prediction_direction,prediction_confidence,last_updated,
          support_levels,resistance_levels
        ) VALUES (
          @ticker,@name,@nameLocal,@exchange,@sector,@currency,@basePrice,@high52w,@low52w,@avgVolume,
          @currentPrice,@previousClose,@priceChange,@priceChangePercent,@priceTimestamp,
          @overallSentiment,@sentimentDirection,@sentimentConfidence,@socialMentions,@newsMentions,
          @engagementWeightedSentiment,@positionSignal,@marketTrend,@pivotPoint,@riskClassification,
          @predictedPrice,@predictedChangePercent,@predictionDirection,@predictionConfidence,@lastUpdated,
          @supportLevels,@resistanceLevels
        );
      `);
      const insertBar = db.prepare(`
        INSERT OR IGNORE INTO price_bars (
          ticker,timestamp,open,high,low,close,volume,sma5,sma10,rsi14,rsi_period,macd,macd_signal
        ) VALUES (@ticker,@timestamp,@open,@high,@low,@close,@volume,@sma5,@sma10,@rsi14,@rsiPeriod,@macd,@macdSignal);
      `);
      for (const info of ASSET_UNIVERSE) {
        const bars = generateHistoricalBars(info.ticker, info.basePrice, 14);
        const latestBar = bars[bars.length - 1];
        const prevBar = bars.length > 1 ? bars[bars.length - 2] : latestBar;
        const priceChange = Number((latestBar.close - prevBar.close).toFixed(2));
        const priceChangePercent = Number(((priceChange / prevBar.close) * 100).toFixed(2));
        const now = new Date().toISOString();
        const pivots = calculatePivotLevels(bars);
        const asset: Asset = {
          ticker: info.ticker,
          name: info.name,
          nameLocal: info.nameLocal,
          exchange: info.exchange as ExchangeCode,
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
          lastUpdated: now,
        };
        this.assetsMap.set(info.ticker, asset);
        insertAsset.run({
          ...asset,
          basePrice: info.basePrice,
          high52w: info.high52w,
          low52w: info.low52w,
          avgVolume: info.avgVolume,
          nameLocal: asset.nameLocal,
          supportLevels: toJson(asset.supportLevels),
          resistanceLevels: toJson(asset.resistanceLevels),
        });
        for (const bar of bars) {
          this.barsMap.set(info.ticker, bars);
          insertBar.run({
            ticker: info.ticker,
            timestamp: bar.timestamp,
            open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume,
            sma5: bar.sma5 ?? null, sma10: bar.sma10 ?? null, rsi14: bar.rsi14 ?? null,
            rsiPeriod: bar.rsiPeriod ?? null, macd: bar.macd ?? null, macdSignal: bar.macdSignal ?? null,
          });
        }
      }
    });
    tx();
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
    const db = appDb.db;
    db.prepare(`
      UPDATE assets SET
        name=@name,name_local=@nameLocal,exchange=@exchange,sector=@sector,currency=@currency,
        current_price=@currentPrice,previous_close=@previousClose,price_change=@priceChange,
        price_change_percent=@priceChangePercent,price_timestamp=@priceTimestamp,
        overall_sentiment=@overallSentiment,sentiment_direction=@sentimentDirection,
        sentiment_confidence=@sentimentConfidence,social_mentions=@socialMentions,
        news_mentions=@newsMentions,engagement_weighted_sentiment=@engagementWeightedSentiment,
        position_signal=@positionSignal,market_trend=@marketTrend,pivot_point=@pivotPoint,
        risk_classification=@riskClassification,predicted_price=@predictedPrice,
        predicted_change_percent=@predictedChangePercent,prediction_direction=@predictionDirection,
        prediction_confidence=@predictionConfidence,last_updated=@lastUpdated,
        support_levels=@supportLevels,resistance_levels=@resistanceLevels
      WHERE ticker=@ticker
    `).run({
      ...asset,
      nameLocal: asset.nameLocal,
      supportLevels: toJson(asset.supportLevels),
      resistanceLevels: toJson(asset.resistanceLevels),
    });
  }
}

export const marketRepo = new MarketDataRepository();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function fromJsonArray(value: string | null): number[] {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}
