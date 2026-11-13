import { ExchangeCode, NewsArticle, SentimentDirection } from '../../src/types';
import { analyzeMultilingualSentiment } from './sentiment';
import NEWS_SEEDS from './news.json';
import { appDb, uuidv4 } from '../db/sqlite';

export interface ExaSearchOptions {
  query: string;
  numResults?: number;
  contents?: {
    text?: boolean;
    highlights?: boolean;
    summary?: boolean;
  };
}

export class NewsIntelligenceRepository {
  private articles: NewsArticle[] = [];
  private exaApiKey: string = process.env.EXA_API_KEY || '';
  private liveSearchInvoked = false;
  private lastLiveSearchAt: string | null = null;
  private liveArticleCount = 0;

  constructor() {
    this.loadFromDb();
  }

  public setApiKey(key: string) {
    this.exaApiKey = key;
  }

  public getApiKey(): string {
    return this.exaApiKey;
  }

  public getLiveIntegrationStats(): {
    credentialConfigured: boolean;
    liveSearchInvoked: boolean;
    lastLiveSearchAt: string | null;
    liveArticleCount: number;
  } {
    return {
      credentialConfigured: Boolean(this.exaApiKey),
      liveSearchInvoked: this.liveSearchInvoked,
      lastLiveSearchAt: this.lastLiveSearchAt,
      liveArticleCount: this.liveArticleCount,
    };
  }

  private loadFromDb() {
    const db = appDb.db;
    const count = appDb.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM news_articles')!.c;
    if (count === 0) {
      this.ingestSeedNews();
      return;
    }
    const rows = db.prepare('SELECT * FROM news_articles ORDER BY published_at DESC').all() as any[];
    this.articles = rows.map(r => this.rowToArticle(r));
    // Recompute + persist sentiment so stored values match the curated text
    const upsert = db.prepare(`
      UPDATE news_articles SET sentiment_score=@sentimentScore, sentiment_label=@sentimentLabel, confidence=@confidence WHERE id=@id
    `);
    for (const a of this.articles) {
      const s = analyzeMultilingualSentiment(`${a.title}. ${a.summary}`);
      a.sentimentScore = s.sentimentScore;
      a.sentimentLabel = s.sentimentLabel;
      a.confidence = s.confidence;
      upsert.run({ id: a.id, sentimentScore: a.sentimentScore, sentimentLabel: a.sentimentLabel, confidence: a.confidence });
    }
  }

  public ingestSeedNews() {
    const now = new Date();
    this.liveArticleCount = 0;
    this.liveSearchInvoked = false;
    this.lastLiveSearchAt = null;
    const rawNews = NEWS_SEEDS;

    const db = appDb.db;
    const tx = db.transaction(() => {
      const insertNews = db.prepare(`
        INSERT OR IGNORE INTO news_articles (
          id,ticker,asset_name,exchange,title,title_en,url,publisher,published_at,retrieved_at,
          search_query,relevance_score,summary,summary_en,sentiment_score,sentiment_label,confidence,key_themes
        ) VALUES (
          @id,@ticker,@assetName,@exchange,@title,@titleEn,@url,@publisher,@publishedAt,@retrievedAt,
          @searchQuery,@relevanceScore,@summary,@summaryEn,@sentimentScore,@sentimentLabel,@confidence,@keyThemes
        );
      `);
      for (const [idx, n] of rawNews.entries()) {
        const pubDate = new Date(now.getTime() - n.daysAgo * 24 * 60 * 60 * 1000);
        const id = `news_${idx + 1}`;
        const sentiment = analyzeMultilingualSentiment(`${n.title}. ${n.summary}`);
        const article: NewsArticle = {
          id, ticker: n.ticker, assetName: n.assetName, exchange: n.exchange as ExchangeCode,
          title: n.title, url: n.url, publisher: n.publisher, publishedAt: pubDate.toISOString(),
          retrievedAt: new Date().toISOString(), searchQuery: n.searchQuery, relevanceScore: n.relevanceScore,
          summary: n.summary, sentimentScore: sentiment.sentimentScore, sentimentLabel: sentiment.sentimentLabel,
          confidence: sentiment.confidence, keyThemes: n.keyThemes,
        };
        this.articles.push(article);
        insertNews.run({
          id, ticker: n.ticker, assetName: n.assetName, exchange: n.exchange, title: n.title,
          titleEn: (n as any).titleEn ?? null, url: n.url, publisher: n.publisher,
          publishedAt: pubDate.toISOString(), retrievedAt: new Date().toISOString(),
          searchQuery: n.searchQuery, relevanceScore: n.relevanceScore, summary: n.summary,
          summaryEn: (n as any).summaryEn ?? null, sentimentScore: sentiment.sentimentScore,
          sentimentLabel: sentiment.sentimentLabel, confidence: sentiment.confidence,
          keyThemes: JSON.stringify(n.keyThemes),
        });
      }
    });
    tx();

    this.articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  public getAllNews(filter?: { ticker?: string; exchange?: ExchangeCode }): NewsArticle[] {
    let result = [...this.articles];
    if (filter?.ticker) {
      result = result.filter(n => n.ticker === filter.ticker);
    }
    if (filter?.exchange) {
      result = result.filter(n => n.exchange === filter.exchange);
    }
    return result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }

  public getArticleById(id: string): NewsArticle | undefined {
    return this.articles.find(a => a.id === id);
  }

  public async searchWithExa(query: string, ticker: string, assetName: string, exchange: ExchangeCode): Promise<NewsArticle[]> {
    if (!this.exaApiKey) {
      return this.getAllNews({ ticker });
    }

    try {
      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.exaApiKey,
        },
        body: JSON.stringify({
          query: `${query} financial news earnings stock`,
          numResults: 5,
          useAutoprompt: true,
          contents: { text: true, summary: true },
        }),
      });

      if (!res.ok) {
        console.warn(`Exa API returned ${res.status}: ${res.statusText}`);
        return this.getAllNews({ ticker });
      }

      const data = await res.json();
      const results: NewsArticle[] = [];

      if (data.results && Array.isArray(data.results)) {
        const db = appDb.db;
        const insertNews = db.prepare(`
          INSERT OR IGNORE INTO news_articles (
            id,ticker,asset_name,exchange,title,title_en,url,publisher,published_at,retrieved_at,
            search_query,relevance_score,summary,summary_en,sentiment_score,sentiment_label,confidence,key_themes
          ) VALUES (
            @id,@ticker,@assetName,@exchange,@title,@titleEn,@url,@publisher,@publishedAt,@retrievedAt,
            @searchQuery,@relevanceScore,@summary,@summaryEn,@sentimentScore,@sentimentLabel,@confidence,@keyThemes
          );
        `);
        for (const item of data.results) {
          const sentiment = analyzeMultilingualSentiment(`${item.title || ''}. ${item.summary || item.text || ''}`);
          const article: NewsArticle = {
            id: `exa_${item.id || Math.random().toString(36).substring(2, 9)}`,
            ticker, assetName, exchange,
            title: item.title || 'Financial Intelligence Update',
            url: item.url || '#',
            publisher: new URL(item.url || 'https://news.google.com').hostname.replace('www.', ''),
            publishedAt: item.publishedDate || new Date().toISOString(),
            retrievedAt: new Date().toISOString(),
            searchQuery: query,
            relevanceScore: Number((item.score || 0.9).toFixed(2)),
            summary: item.summary || (item.text ? item.text.substring(0, 240) + '...' : 'Recent market development.'),
            sentimentScore: sentiment.sentimentScore,
            sentimentLabel: sentiment.sentimentLabel,
            confidence: sentiment.confidence,
            keyThemes: ['Exa Discovery', 'Market Insight'],
          };

          if (!this.articles.some(a => a.url === article.url)) {
            this.articles.unshift(article);
            insertNews.run({
              id: article.id, ticker, assetName, exchange, title: article.title,
              titleEn: article.titleEn ?? null, url: article.url, publisher: article.publisher,
              publishedAt: article.publishedAt, retrievedAt: article.retrievedAt,
              searchQuery: query, relevanceScore: article.relevanceScore, summary: article.summary,
              summaryEn: article.summaryEn ?? null, sentimentScore: article.sentimentScore,
              sentimentLabel: article.sentimentLabel, confidence: article.confidence,
              keyThemes: JSON.stringify(article.keyThemes),
            });
          }
          results.push(article);
        }
      }

      if (results.length > 0) {
        this.liveSearchInvoked = true;
        this.lastLiveSearchAt = new Date().toISOString();
        this.liveArticleCount = this.articles.filter(a => a.id.startsWith('exa_')).length;
      }

      return results.length > 0 ? results : this.getAllNews({ ticker });
    } catch (err) {
      console.error('Error invoking Exa API:', err);
      return this.getAllNews({ ticker });
    }
  }

  public getNewsSentimentSummary(ticker: string) {
    return summarizeNewsArticles(this.articles.filter(a => a.ticker === ticker));
  }

  private rowToArticle(r: any): NewsArticle {
    return {
      id: r.id,
      ticker: r.ticker,
      assetName: r.asset_name,
      exchange: r.exchange as ExchangeCode,
      title: r.title,
      titleEn: r.title_en ?? undefined,
      url: r.url,
      publisher: r.publisher,
      publishedAt: r.published_at,
      retrievedAt: r.retrieved_at,
      searchQuery: r.search_query,
      relevanceScore: r.relevance_score,
      summary: r.summary,
      summaryEn: r.summary_en ?? undefined,
      sentimentScore: r.sentiment_score,
      sentimentLabel: r.sentiment_label as SentimentDirection,
      confidence: r.confidence,
      keyThemes: JSON.parse(r.key_themes || '[]'),
    };
  }
}

// Pure summary over an arbitrary (optionally time-sliced) set of articles.
export function summarizeNewsArticles(assetNews: NewsArticle[]) {
  if (assetNews.length === 0) {
    return {
      totalNews: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      neutralRatio: 0,
      avgNewsSentiment: 0,
      relevanceWeightedSentiment: 0,
    };
  }

  let pos = 0;
  let neg = 0;
  let neu = 0;
  let scoreSum = 0;
  let weightedSum = 0;
  let weightSum = 0;

  for (const n of assetNews) {
    if (n.sentimentScore > 20) pos++;
    else if (n.sentimentScore < -20) neg++;
    else neu++;

    scoreSum += n.sentimentScore;
    const weight = n.relevanceScore;
    weightedSum += n.sentimentScore * weight;
    weightSum += weight;
  }

  const avg = Number((scoreSum / assetNews.length).toFixed(1));
  const relWeighted = weightSum > 0 ? Number((weightedSum / weightSum).toFixed(1)) : avg;

  return {
    totalNews: assetNews.length,
    positiveRatio: Number((pos / assetNews.length).toFixed(2)),
    negativeRatio: Number((neg / assetNews.length).toFixed(2)),
    neutralRatio: Number((neu / assetNews.length).toFixed(2)),
    avgNewsSentiment: avg,
    relevanceWeightedSentiment: relWeighted,
  };
}

export const newsRepo = new NewsIntelligenceRepository();
