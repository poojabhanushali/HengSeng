import { ExchangeCode, NewsArticle, SentimentDirection } from '../../src/types';
import { analyzeMultilingualSentiment } from './socialScraper';
import NEWS_SEEDS from './news.json';

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
    this.ingestSeedNews();
  }

  public setApiKey(key: string) {
    this.exaApiKey = key;
  }

  public getApiKey(): string {
    return this.exaApiKey;
  }

  // Observability for LIVE vs fallback classification in the sources status endpoint
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

  public ingestSeedNews() {
    const now = new Date();
    // Local curated fallback dataset replaces any previously served live Exa records
    this.liveArticleCount = 0;
    this.liveSearchInvoked = false;
    this.lastLiveSearchAt = null;
    const rawNews = NEWS_SEEDS;

    this.articles = rawNews.map((n, idx) => {
      const pubDate = new Date(now.getTime() - n.daysAgo * 24 * 60 * 60 * 1000);
      const sentiment = analyzeMultilingualSentiment(`${n.title}. ${n.summary}`);

      return {
        id: `news_${idx + 1}`,
        ticker: n.ticker,
        assetName: n.assetName,
        exchange: n.exchange as ExchangeCode,
        title: n.title,
        url: n.url,
        publisher: n.publisher,
        publishedAt: pubDate.toISOString(),
        retrievedAt: new Date().toISOString(),
        searchQuery: n.searchQuery,
        relevanceScore: n.relevanceScore,
        summary: n.summary,
        sentimentScore: sentiment.sentimentScore,
        sentimentLabel: sentiment.sentimentLabel,
        confidence: sentiment.confidence,
        keyThemes: n.keyThemes,
      };
    });
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

  // Live Exa API search integration
  public async searchWithExa(query: string, ticker: string, assetName: string, exchange: ExchangeCode): Promise<NewsArticle[]> {
    if (!this.exaApiKey) {
      // Return existing matched news for this ticker if no API key is configured
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
          contents: {
            text: true,
            summary: true,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`Exa API returned ${res.status}: ${res.statusText}`);
        return this.getAllNews({ ticker });
      }

      const data = await res.json();
      const results: NewsArticle[] = [];

      if (data.results && Array.isArray(data.results)) {
        for (const item of data.results) {
          const sentiment = analyzeMultilingualSentiment(`${item.title || ''}. ${item.summary || item.text || ''}`);
          const article: NewsArticle = {
            id: `exa_${item.id || Math.random().toString(36).substring(2, 9)}`,
            ticker,
            assetName,
            exchange,
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

          // Deduplicate by URL
          if (!this.articles.some(a => a.url === article.url)) {
            this.articles.unshift(article);
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
