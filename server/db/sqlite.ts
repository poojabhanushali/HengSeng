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

      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id TEXT PRIMARY KEY,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        label TEXT,
        description TEXT,
        UNIQUE(resource, action)
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL,
        permission_id TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
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

    // Seed RBAC roles, permissions, and default role grants
    const permCount = this.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM permissions')!.c;
    if (permCount === 0) {
      const DEFAULT_PERMISSIONS: { id: string; resource: string; action: string; label: string; description: string }[] = [
        { id: 'perm_assets_view', resource: 'assets', action: 'view', label: 'View Assets', description: 'View asset listings and details' },
        { id: 'perm_assets_create', resource: 'assets', action: 'create', label: 'Create Assets', description: 'Create new assets' },
        { id: 'perm_assets_edit', resource: 'assets', action: 'edit', label: 'Edit Assets', description: 'Edit asset details' },
        { id: 'perm_assets_delete', resource: 'assets', action: 'delete', label: 'Delete Assets', description: 'Delete assets' },
        { id: 'perm_exchanges_view', resource: 'exchanges', action: 'view', label: 'View Exchanges', description: 'View exchange information' },
        { id: 'perm_social_view', resource: 'social', action: 'view', label: 'View Social Sentiment', description: 'View social media sentiment data' },
        { id: 'perm_news_view', resource: 'news', action: 'view', label: 'View News', description: 'View news intelligence' },
        { id: 'perm_predictions_view', resource: 'predictions', action: 'view', label: 'View Predictions', description: 'View price predictions' },
        { id: 'perm_predictions_run', resource: 'predictions', action: 'run', label: 'Run Predictions', description: 'Regenerate price predictions' },
        { id: 'perm_pipeline_view', resource: 'pipeline', action: 'view', label: 'View Pipeline', description: 'View pipeline status and agent states' },
        { id: 'perm_pipeline_run', resource: 'pipeline', action: 'run', label: 'Run Pipeline', description: 'Execute the full data pipeline' },
        { id: 'perm_reports_view', resource: 'reports', action: 'view', label: 'View Reports', description: 'View executive reports' },
        { id: 'perm_reports_create', resource: 'reports', action: 'create', label: 'Create Reports', description: 'Generate new reports' },
        { id: 'perm_reports_approve', resource: 'reports', action: 'approve', label: 'Approve Reports', description: 'Approve/publish reports' },
        { id: 'perm_settings_view', resource: 'settings', action: 'view', label: 'View Settings', description: 'View system settings' },
        { id: 'perm_settings_edit', resource: 'settings', action: 'edit', label: 'Edit Settings', description: 'Edit system settings' },
        { id: 'perm_users_view', resource: 'users', action: 'view', label: 'View Users', description: 'View user accounts' },
        { id: 'perm_users_create', resource: 'users', action: 'create', label: 'Create Users', description: 'Create new user accounts' },
        { id: 'perm_users_edit', resource: 'users', action: 'edit', label: 'Edit Users', description: 'Edit user accounts' },
        { id: 'perm_users_delete', resource: 'users', action: 'delete', label: 'Delete Users', description: 'Delete user accounts' },
        { id: 'perm_roles_view', resource: 'roles', action: 'view', label: 'View Roles', description: 'View roles and permissions' },
        { id: 'perm_roles_edit', resource: 'roles', action: 'edit', label: 'Edit Roles', description: 'Edit role permissions' },
        { id: 'perm_permissions_view', resource: 'permissions', action: 'view', label: 'View Permissions', description: 'View available permissions' },
      ];

      const DEFAULT_ROLES: { id: string; name: string; description: string }[] = [
        { id: 'role_admin', name: 'admin', description: 'Full system access' },
        { id: 'role_manager', name: 'manager', description: 'Operational access without user/role management' },
        { id: 'role_viewer', name: 'viewer', description: 'Read-only access' },
      ];

      const ROLE_PERMISSIONS: Record<string, string[]> = {
        role_admin: DEFAULT_PERMISSIONS.map(p => p.id),
        role_manager: [
          'perm_assets_view', 'perm_exchanges_view', 'perm_social_view', 'perm_news_view',
          'perm_predictions_view', 'perm_predictions_run', 'perm_pipeline_view', 'perm_pipeline_run',
          'perm_reports_view', 'perm_reports_create', 'perm_reports_approve',
          'perm_settings_view', 'perm_settings_edit',
        ],
        role_viewer: [
          'perm_assets_view', 'perm_exchanges_view', 'perm_social_view', 'perm_news_view',
          'perm_predictions_view', 'perm_pipeline_view', 'perm_reports_view', 'perm_settings_view',
        ],
      };

      const now = new Date().toISOString();
      const insertPerm = db.prepare(`INSERT OR IGNORE INTO permissions (id,resource,action,label,description) VALUES (@id,@resource,@action,@label,@description)`);
      const insertRole = db.prepare(`INSERT OR IGNORE INTO roles (id,name,description,is_system,created_at) VALUES (@id,@name,@description,1,@now)`);
      const insertRolePerm = db.prepare(`INSERT OR IGNORE INTO role_permissions (role_id,permission_id,granted) VALUES (@roleId,@permId,1)`);

      const tx = db.transaction(() => {
        for (const p of DEFAULT_PERMISSIONS) insertPerm.run(p);
        for (const r of DEFAULT_ROLES) insertRole.run({ ...r, now });
        for (const [roleId, permIds] of Object.entries(ROLE_PERMISSIONS)) {
          for (const permId of permIds) {
            insertRolePerm.run({ roleId, permId });
          }
        }
      });
      tx();
    }

    // Link users to roles via role column (already seeded). Ensure user_permissions table is empty by default (no overrides).
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
