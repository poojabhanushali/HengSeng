import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Seed data (JSON fallbacks used only for initial database seeding)
import ASSET_UNIVERSE from '../data/assets.json';
import POST_SEEDS from '../data/socialPosts.json';
import NEWS_SEEDS from '../data/news.json';
import {
  Asset, ExchangeCode, PriceBar, SocialPost, NewsArticle,
  SystemSettings, IngestionJob, AgentExecutionState, ExecutiveReport,
} from '../../src/types';
import { generateHistoricalBars } from './../data/marketGenerators';
import { analyzeMultilingualSentiment, computeEngagementScore, createPostHash } from './../data/sentiment';

const DB_PATH = path.resolve(process.cwd(), 'hengseng.db');

export type Json = string;

function toJson(value: unknown): string {
  return JSON.stringify(value);
}
function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Database connection & schema
// ---------------------------------------------------------------------------

export class AppDatabase {
  readonly db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.initSchema();
    this.seedIfEmpty();
  }

  private initSchema() {
    const db = this.db;
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assets (
        ticker TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_local TEXT,
        exchange TEXT NOT NULL,
        sector TEXT,
        currency TEXT,
        base_price REAL,
        high52w REAL,
        low52w REAL,
        avg_volume INTEGER,
        current_price REAL,
        previous_close REAL,
        price_change REAL,
        price_change_percent REAL,
        price_timestamp TEXT,
        overall_sentiment REAL,
        sentiment_direction TEXT,
        sentiment_confidence REAL,
        social_mentions INTEGER,
        news_mentions INTEGER,
        engagement_weighted_sentiment REAL,
        position_signal TEXT,
        market_trend TEXT,
        pivot_point REAL,
        risk_classification TEXT,
        predicted_price REAL,
        predicted_change_percent REAL,
        prediction_direction TEXT,
        prediction_confidence REAL,
        last_updated TEXT,
        support_levels TEXT,
        resistance_levels TEXT
      );

      CREATE TABLE IF NOT EXISTS price_bars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume INTEGER,
        sma5 REAL,
        sma10 REAL,
        rsi14 REAL,
        rsi_period INTEGER,
        macd REAL,
        macd_signal REAL,
        UNIQUE(ticker, timestamp)
      );

      CREATE INDEX IF NOT EXISTS idx_price_bars_ticker ON price_bars(ticker);
      CREATE INDEX IF NOT EXISTS idx_price_bars_ts ON price_bars(ticker, timestamp);

      CREATE TABLE IF NOT EXISTS social_posts (
        id TEXT PRIMARY KEY,
        exchange TEXT NOT NULL,
        ticker TEXT NOT NULL,
        asset_name TEXT,
        platform TEXT NOT NULL,
        url TEXT,
        author TEXT,
        author_followers INTEGER,
        author_influence_score REAL,
        text TEXT,
        text_en TEXT,
        original_language TEXT,
        published_at TEXT NOT NULL,
        collected_at TEXT,
        likes INTEGER,
        comments INTEGER,
        shares INTEGER,
        views INTEGER,
        engagement_score REAL,
        sentiment_score REAL,
        sentiment_label TEXT,
        confidence REAL,
        extracted_phrases TEXT,
        expressed_position TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_social_posts_ticker ON social_posts(ticker);
      CREATE INDEX IF NOT EXISTS idx_social_posts_exchange ON social_posts(exchange);
      CREATE INDEX IF NOT EXISTS idx_social_posts_published ON social_posts(published_at);

      CREATE TABLE IF NOT EXISTS news_articles (
        id TEXT PRIMARY KEY,
        ticker TEXT NOT NULL,
        asset_name TEXT,
        exchange TEXT NOT NULL,
        title TEXT,
        title_en TEXT,
        url TEXT,
        publisher TEXT,
        published_at TEXT NOT NULL,
        retrieved_at TEXT,
        search_query TEXT,
        relevance_score REAL,
        summary TEXT,
        summary_en TEXT,
        sentiment_score REAL,
        sentiment_label TEXT,
        confidence REAL,
        key_themes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_news_articles_ticker ON news_articles(ticker);
      CREATE INDEX IF NOT EXISTS idx_news_articles_exchange ON news_articles(exchange);
      CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles(published_at);

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        title TEXT,
        exchange TEXT,
        created_at TEXT,
        payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingestion_jobs (
        id TEXT PRIMARY KEY,
        agent_id TEXT,
        name TEXT,
        status TEXT,
        start_time TEXT,
        end_time TEXT,
        duration_ms INTEGER,
        records_processed INTEGER,
        error TEXT,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS agent_states (
        agent_number INTEGER PRIMARY KEY,
        agent_name TEXT,
        role TEXT,
        status TEXT,
        last_run_time TEXT,
        duration_ms INTEGER,
        items_processed INTEGER,
        quality_score INTEGER,
        message TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id TEXT,
        action TEXT NOT NULL,
        entity TEXT,
        entity_id TEXT,
        meta TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  private seedIfEmpty() {
    const db = this.db;
    const assetCount = this.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM assets')!.c;
    if (assetCount === 0) {
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
      const tx = db.transaction(() => {
        for (const info of ASSET_UNIVERSE) {
          const bars = generateHistoricalBars(info.ticker, info.basePrice, 14);
          const latestBar = bars[bars.length - 1];
          const prevBar = bars.length > 1 ? bars[bars.length - 2] : latestBar;
          const priceChange = Number((latestBar.close - prevBar.close).toFixed(2));
          const priceChangePercent = Number(((priceChange / prevBar.close) * 100).toFixed(2));
          const now = new Date().toISOString();
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
            supportLevels: [], resistanceLevels: [], pivotPoint: 0,
            riskClassification: 'Low',
            predictedPrice: latestBar.close,
            predictedChangePercent: 0,
            predictionDirection: 'Neutral',
            predictionConfidence: 0.82,
            lastUpdated: now,
          };
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

    const postCount = this.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM social_posts')!.c;
    if (postCount === 0) {
      const insertPost = db.prepare(`
        INSERT OR IGNORE INTO social_posts (
          id,exchange,ticker,asset_name,platform,url,author,author_followers,author_influence_score,
          text,text_en,original_language,published_at,collected_at,likes,comments,shares,views,
          engagement_score,sentiment_score,sentiment_label,confidence,extracted_phrases,expressed_position
        ) VALUES (
          @id,@exchange,@ticker,@assetName,@platform,@url,@author,@authorFollowers,@authorInfluenceScore,
          @text,@textEn,@originalLanguage,@publishedAt,@collectedAt,@likes,@comments,@shares,@views,
          @engagementScore,@sentimentScore,@sentimentLabel,@confidence,@extractedPhrases,@expressedPosition
        );
      `);
      const tx = db.transaction(() => {
        const now = new Date();
        for (const seed of POST_SEEDS) {
          const pubDate = new Date(now.getTime() - seed.daysAgo * 24 * 60 * 60 * 1000);
          const sentiment = analyzeMultilingualSentiment(seed.text);
          const engagement = computeEngagementScore(seed.likes, seed.comments, seed.shares, seed.views);
          const hash = createPostHash(seed.platform, seed.author, seed.text);
          const id = `post_${hash}`;
          const platform = seed.platform as 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo';
          let url = seed.platform === 'LIHKG'
            ? `https://lihkg.com/thread/381${Math.floor(Math.random() * 9000 + 1000)}`
            : seed.platform === 'Naver Finance'
            ? `https://finance.naver.com/item/board_read.naver?code=${seed.ticker.split('.')[0]}&nid=${Math.floor(Math.random() * 900000 + 100000)}`
            : `https://t.me/hkstocknews/${Math.floor(Math.random() * 5000 + 100)}`;
          insertPost.run({
            id, exchange: seed.exchange, ticker: seed.ticker, assetName: seed.assetName, platform, url,
            author: seed.author, authorFollowers: seed.followers,
            authorInfluenceScore: Number(Math.min(1.0, 0.3 + (seed.followers / 25000) * 0.7).toFixed(2)),
            text: seed.text, textEn: seed.textEn ?? null, originalLanguage: sentiment.detectedLanguage,
            publishedAt: pubDate.toISOString(), collectedAt: new Date().toISOString(),
            likes: seed.likes, comments: seed.comments, shares: seed.shares, views: seed.views,
            engagementScore: engagement, sentimentScore: sentiment.sentimentScore,
            sentimentLabel: sentiment.sentimentLabel, confidence: sentiment.confidence,
            extractedPhrases: toJson(sentiment.extractedPhrases),
            expressedPosition: sentiment.expressedPosition ?? null,
          });
        }
      });
      tx();
    }

    const newsCount = this.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM news_articles')!.c;
    if (newsCount === 0) {
      const insertNews = db.prepare(`
        INSERT OR IGNORE INTO news_articles (
          id,ticker,asset_name,exchange,title,title_en,url,publisher,published_at,retrieved_at,
          search_query,relevance_score,summary,summary_en,sentiment_score,sentiment_label,confidence,key_themes
        ) VALUES (
          @id,@ticker,@assetName,@exchange,@title,@titleEn,@url,@publisher,@publishedAt,@retrievedAt,
          @searchQuery,@relevanceScore,@summary,@summaryEn,@sentimentScore,@sentimentLabel,@confidence,@keyThemes
        );
      `);
      const tx = db.transaction(() => {
        const now = new Date();
        for (const [idx, n] of NEWS_SEEDS.entries()) {
          const pubDate = new Date(now.getTime() - n.daysAgo * 24 * 60 * 60 * 1000);
          const id = `news_${idx + 1}`;
          insertNews.run({
            id, ticker: n.ticker, assetName: n.assetName, exchange: n.exchange, title: n.title,
            titleEn: (n as any).titleEn ?? null, url: n.url, publisher: n.publisher,
            publishedAt: pubDate.toISOString(), retrievedAt: new Date().toISOString(),
            searchQuery: n.searchQuery, relevanceScore: n.relevanceScore, summary: n.summary,
            summaryEn: (n as any).summaryEn ?? null,
            sentimentScore: 0, sentimentLabel: 'Neutral', confidence: 0.5, keyThemes: toJson(n.keyThemes),
          });
        }
      });
      tx();
    }

    const userCount = this.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM users')!.c;
    if (userCount === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.prepare(`INSERT INTO users (id,username,email,password_hash,role,is_active,created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), 'admin', 'admin@hengseng.local', hash, 'admin', 1, new Date().toISOString());
      db.prepare(`INSERT INTO users (id,username,email,password_hash,role,is_active,created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), 'manager', 'manager@hengseng.local', hash, 'manager', 1, new Date().toISOString());
      db.prepare(`INSERT INTO users (id,username,email,password_hash,role,is_active,created_at) VALUES (?,?,?,?,?,?,?)`)
        .run(uuidv4(), 'viewer', 'viewer@hengseng.local', hash, 'viewer', 1, new Date().toISOString());
    }
  }

  // ------------------------------------------------------------------
  // Generic helpers
  // ------------------------------------------------------------------
  prepare(sql: string) { return this.db.prepare(sql); }
  exec(sql: string) { return this.db.exec(sql); }
  transaction<T>(fn: () => T): T { return this.db.transaction(fn)(); }

  public selectOne<T = any>(sql: string, ...params: any[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  public selectMany<T = any>(sql: string, ...params: any[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  close() { this.db.close(); }
}

// Singleton
export const appDb = new AppDatabase();

// ---------------------------------------------------------------------------
// Seed from JSON files for endpoints that read JSON directly (backwards compat)
// ---------------------------------------------------------------------------

export function seedAssetsJson(): Asset[] {
  return ASSET_UNIVERSE as unknown as Asset[];
}
export function seedPostsJson(): any[] { return POST_SEEDS as unknown as any[]; }
export function seedNewsJson(): any[] { return NEWS_SEEDS as unknown as any[]; }

// UUID helper (re-exported for route handlers)
export { uuidv4 };
