import { ExchangeCode, PositionSignal, SentimentDirection, SocialPost } from '../../src/types';
import POST_SEEDS from './socialPosts.json';
import {
  analyzeMultilingualSentiment,
  computeEngagementScore,
  createPostHash,
} from './sentiment';
import { appDb, uuidv4 } from '../db/sqlite';

const APIFY_BASE_URL = 'https://api.apify.com/v2';

interface ApifyActorConfig {
  platform: 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo';
  actorId: string;
}

function getApifyConfig(): { token: string | null; actorIds: Record<string, string> | null } {
  const token = process.env.APIFY_API_TOKEN || null;
  const raw = token ? {
    'LIHKG': process.env.APIFY_LIHKG_ACTOR_ID || '',
    'Telegram': process.env.APIFY_TELEGRAM_ACTOR_ID || '',
    'Naver Finance': process.env.APIFY_NAVER_ACTOR_ID || '',
    'Daum Finance': process.env.APIFY_DAUM_ACTOR_ID || '',
  } : null;
  const actorIds = raw && Object.values(raw).some((id): id is string => Boolean(id) && id.trim().length > 0)
    ? raw
    : null;
  return { token, actorIds };
}

async function runApifyActor(actorId: string, token: string, input: Record<string, any> = {}): Promise<any[]> {
  const runRes = await fetch(`${APIFY_BASE_URL}/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!runRes.ok) {
    throw new Error(`Apify actor run failed: HTTP ${runRes.status}`);
  }
  const run = await runRes.json();
  const runId = run.data?.id;
  const datasetId = run.data?.defaultDatasetId;
  if (!runId || !datasetId) {
    throw new Error('Apify actor run returned no runId or datasetId');
  }

  let attempts = 0;
  let runData: any = null;
  while (attempts < 30) {
    const statusRes = await fetch(`${APIFY_BASE_URL}/actor-runs/${runId}?token=${encodeURIComponent(token)}`);
    if (!statusRes.ok) throw new Error(`Apify run status check failed: HTTP ${statusRes.status}`);
    runData = await statusRes.json();
    if (runData.data?.status !== 'RUNNING' && runData.data?.status !== 'READY') break;
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  if (!runData || runData.data?.status !== 'SUCCEEDED') {
    throw new Error(`Apify actor run did not succeed: status=${runData?.data?.status ?? 'unknown'}`);
  }

  const itemsRes = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}`);
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset fetch failed: HTTP ${itemsRes.status}`);
  }
  return await itemsRes.json();
}

function normalizeApifyItem(item: any, platform: string, defaultExchange: ExchangeCode): SocialPost | null {
  if (!item || typeof item !== 'object') return null;
  const text = item.text || item.title || item.content || item.body || '';
  if (!text || text.trim().length === 0) return null;

  const author = item.author || item.user || item.username || 'unknown';
  const publishedAt = item.publishedAt || item.createdAt || item.timestamp || new Date().toISOString();
  const likes = Number(item.likes || item.upvotes || 0) || 0;
  const comments = Number(item.comments || 0) || 0;
  const shares = Number(item.shares || 0) || 0;
  const views = Number(item.views || 0) || 0;

  const sentiment = analyzeMultilingualSentiment(text);
  const engagement = computeEngagementScore(likes, comments, shares, views);
  const hash = createPostHash(platform, author, text);

  const tickerMatch = text.match(/\b(\d{4,5}\.(?:HK|KS))\b/);
  const ticker = tickerMatch ? tickerMatch[1] : defaultExchange === 'HKEX' ? '0700.HK' : '005930.KS';

  return {
    id: `apify_${hash}`,
    exchange: defaultExchange,
    ticker,
    assetName: '',
    platform: platform as 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo',
    url: item.url || `https://apify.com/actor-run/${platform.toLowerCase()}`,
    author,
    authorFollowers: item.authorFollowers || 0,
    authorInfluenceScore: 0.5,
    text,
    textEn: undefined,
    originalLanguage: sentiment.detectedLanguage,
    publishedAt,
    collectedAt: new Date().toISOString(),
    likes,
    comments,
    shares,
    views,
    engagementScore: engagement,
    sentimentScore: sentiment.sentimentScore,
    sentimentLabel: sentiment.sentimentLabel,
    confidence: sentiment.confidence,
    extractedPhrases: sentiment.extractedPhrases,
    expressedPosition: sentiment.expressedPosition,
  };
}

// ---------------------------------------------------------------------------
// SQLite-backed social posts repository
// ---------------------------------------------------------------------------

export class SocialScraperRepository {
  private posts: SocialPost[] = [];

  constructor() {
    this.loadFromDb();
  }

  private loadFromDb() {
    this.posts = [];
    const db = appDb.db;
    const count = appDb.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM social_posts')!.c;
    if (count === 0) {
      this.seedFromJson();
      return;
    }
    const rows = db.prepare('SELECT * FROM social_posts ORDER BY published_at DESC').all() as any[];
    for (const r of rows) {
      this.posts.push(this.rowToPost(r));
    }
  }

  private seedFromJson() {
    const db = appDb.db;
    const now = new Date();
    const tx = db.transaction(() => {
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
        const post: SocialPost = {
          id, exchange: seed.exchange as ExchangeCode, ticker: seed.ticker, assetName: seed.assetName, platform, url,
          author: seed.author, authorFollowers: seed.followers,
          authorInfluenceScore: Number(Math.min(1.0, 0.3 + (seed.followers / 25000) * 0.7).toFixed(2)),
          text: seed.text, textEn: seed.textEn ?? undefined, originalLanguage: sentiment.detectedLanguage,
          publishedAt: pubDate.toISOString(), collectedAt: new Date().toISOString(),
          likes: seed.likes, comments: seed.comments, shares: seed.shares, views: seed.views,
          engagementScore: engagement, sentimentScore: sentiment.sentimentScore,
          sentimentLabel: sentiment.sentimentLabel, confidence: sentiment.confidence,
          extractedPhrases: sentiment.extractedPhrases, expressedPosition: sentiment.expressedPosition,
        };
        this.posts.push(post);
        insertPost.run({
          id, exchange: seed.exchange, ticker: seed.ticker, assetName: seed.assetName, platform, url,
          author: seed.author, authorFollowers: seed.followers,
          authorInfluenceScore: post.authorInfluenceScore,
          text: seed.text, textEn: seed.textEn ?? null, originalLanguage: sentiment.detectedLanguage,
          publishedAt: pubDate.toISOString(), collectedAt: new Date().toISOString(),
          likes: seed.likes, comments: seed.comments, shares: seed.shares, views: seed.views,
          engagementScore: engagement, sentimentScore: sentiment.sentimentScore,
          sentimentLabel: sentiment.sentimentLabel, confidence: sentiment.confidence,
          extractedPhrases: JSON.stringify(sentiment.extractedPhrases),
          expressedPosition: sentiment.expressedPosition ?? null,
        });
      }
    });
    tx();
  }

  private rowToPost(r: any): SocialPost {
    return {
      id: r.id,
      exchange: r.exchange as ExchangeCode,
      ticker: r.ticker,
      assetName: r.asset_name,
      platform: r.platform as 'LIHKG' | 'Telegram' | 'Naver Finance' | 'Daum Finance' | 'Futu/Moomoo',
      url: r.url,
      author: r.author,
      authorFollowers: r.author_followers,
      authorInfluenceScore: r.author_influence_score,
      text: r.text,
      textEn: r.text_en ?? undefined,
      originalLanguage: r.original_language as 'zh-HK' | 'zh-CN' | 'ko' | 'en',
      publishedAt: r.published_at,
      collectedAt: r.collected_at,
      likes: r.likes,
      comments: r.comments,
      shares: r.shares,
      views: r.views,
      engagementScore: r.engagement_score,
      sentimentScore: r.sentiment_score,
      sentimentLabel: r.sentiment_label as SentimentDirection,
      confidence: r.confidence,
      extractedPhrases: JSON.parse(r.extracted_phrases || '[]'),
      expressedPosition: r.expressed_position as PositionSignal | undefined,
    };
  }

  public async ingestApifyPosts(): Promise<{ posted: number; errors: string[]; live: boolean }> {
    const errors: string[] = [];
    const { token, actorIds } = getApifyConfig();
    const posted: number[] = [];

    if (!token || !actorIds) {
      return { posted: 0, errors: [], live: false };
    }

    const actorEntries: ApifyActorConfig[] = [
      { platform: 'LIHKG', actorId: actorIds['LIHKG'] || '' },
      { platform: 'Telegram', actorId: actorIds['Telegram'] || '' },
      { platform: 'Naver Finance', actorId: actorIds['Naver Finance'] || '' },
      { platform: 'Daum Finance', actorId: actorIds['Daum Finance'] || '' },
    ];

    let anyLive = false;

    for (const actor of actorEntries) {
      if (!actor.actorId || actor.actorId.trim().length === 0) continue;
      try {
        const items = await runApifyActor(actor.actorId, token, { maxItems: 20 });
        let count = 0;
        for (const item of items) {
          const post = normalizeApifyItem(item, actor.platform, 'HKEX');
          if (post) {
            this.addPost(post);
            count++;
          }
        }
        posted.push(count);
        if (count > 0) anyLive = true;
      } catch (err: any) {
        errors.push(`${actor.platform} (${actor.actorId}): ${err?.message || err}`);
      }
    }

    return { posted: posted.reduce((a, b) => a + b, 0), errors, live: anyLive };
  }

  public getApifyStatus(): { configured: boolean; actorIds: Record<string, boolean> } {
    const { token, actorIds } = getApifyConfig();
    return {
      configured: Boolean(token && actorIds),
      actorIds: Object.fromEntries(
        Object.entries(actorIds ?? {}).map(([k, v]) => [k, Boolean(v && v.trim().length > 0)])
      ),
    };
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
      const db = appDb.db;
      db.prepare(`
        INSERT OR IGNORE INTO social_posts (
          id,exchange,ticker,asset_name,platform,url,author,author_followers,author_influence_score,
          text,text_en,original_language,published_at,collected_at,likes,comments,shares,views,
          engagement_score,sentiment_score,sentiment_label,confidence,extracted_phrases,expressed_position
        ) VALUES (
          @id,@exchange,@ticker,@assetName,@platform,@url,@author,@authorFollowers,@authorInfluenceScore,
          @text,@textEn,@originalLanguage,@publishedAt,@collectedAt,@likes,@comments,@shares,@views,
          @engagementScore,@sentimentScore,@sentimentLabel,@confidence,@extractedPhrases,@expressedPosition
        );
      `).run({
        id: post.id, exchange: post.exchange, ticker: post.ticker, assetName: post.assetName, platform: post.platform,
        url: post.url, author: post.author, authorFollowers: post.authorFollowers,
        authorInfluenceScore: post.authorInfluenceScore, text: post.text, textEn: post.textEn ?? null,
        originalLanguage: post.originalLanguage, publishedAt: post.publishedAt, collectedAt: post.collectedAt,
        likes: post.likes, comments: post.comments, shares: post.shares, views: post.views,
        engagementScore: post.engagementScore, sentimentScore: post.sentimentScore,
        sentimentLabel: post.sentimentLabel, confidence: post.confidence,
        extractedPhrases: JSON.stringify(post.extractedPhrases),
        expressedPosition: post.expressedPosition ?? null,
      });
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
