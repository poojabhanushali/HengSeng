import { ExchangeCode, NewsArticle, SentimentDirection } from '../../src/types';
import { analyzeMultilingualSentiment } from './socialScraper';

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
    const rawNews = [
      // HKEX
      {
        ticker: '0700.HK',
        assetName: 'Tencent Holdings',
        exchange: 'HKEX' as ExchangeCode,
        title: 'Tencent Reports 8% Q3 Revenue Beat Driven by High-Margin Gaming & Cloud AI',
        url: 'https://www.reuters.com/technology/tencent-q3-results-2024-11',
        publisher: 'Reuters',
        daysAgo: 1,
        searchQuery: 'Tencent 0700.HK earnings AI gaming cloud revenue',
        relevanceScore: 0.96,
        summary: 'Tencent Holdings posted third-quarter revenue growth surpassing analyst estimates, powered by evergreen domestic titles, international gaming resilience, and expanding enterprise adoption of its Hunyuan generative AI models.',
        keyThemes: ['Earnings Beat', 'Gaming Revenue', 'Enterprise AI', 'Cloud Expansion'],
      },
      {
        ticker: '9988.HK',
        assetName: 'Alibaba Group',
        exchange: 'HKEX' as ExchangeCode,
        title: 'Alibaba Expands Global Infrastructure Footprint While Domestic E-Commerce Pressured',
        url: 'https://www.bloomberg.com/news/articles/alibaba-cloud-datacenter-expansion',
        publisher: 'Bloomberg',
        daysAgo: 2,
        searchQuery: 'Alibaba 9988.HK Taobao Cloud data centers margin',
        relevanceScore: 0.89,
        summary: 'Alibaba Group announced multi-region cloud data center investments across Southeast Asia and Latin America to capture generative AI workload demand, while domestic merchants navigate competitive pricing pressures.',
        keyThemes: ['Global Infrastructure', 'Cloud Capex', 'E-Commerce Competition'],
      },
      {
        ticker: '0005.HK',
        assetName: 'HSBC Holdings',
        exchange: 'HKEX' as ExchangeCode,
        title: 'HSBC CEO Unveils Multi-Tier Bank Reorganization and Announces $3 Billion Share Buyback',
        url: 'https://www.ft.com/content/hsbc-strategic-overhaul-buyback',
        publisher: 'Financial Times',
        daysAgo: 2,
        searchQuery: 'HSBC 0005.HK reorganization buyback net interest income',
        relevanceScore: 0.94,
        summary: 'HSBC Holdings announced a streamlined four-unit operating structure separating Eastern and Western commercial banking hubs, accompanied by a $3bn buyback and robust capital distribution plans.',
        keyThemes: ['Corporate Restructuring', 'Share Buyback', 'Capital Adequacy', 'Dividend Yield'],
      },
      {
        ticker: '3690.HK',
        assetName: 'Meituan',
        exchange: 'HKEX' as ExchangeCode,
        title: 'Meituan Keeta App Climbs App Store Rankings in Middle East Launch',
        url: 'https://www.scmp.com/business/china-business/meituan-middle-east-expansion',
        publisher: 'South China Morning Post',
        daysAgo: 3,
        searchQuery: 'Meituan 3690.HK Keeta international delivery market share',
        relevanceScore: 0.88,
        summary: 'Meituan expanded its overseas food delivery footprint with rapid adoption of its Keeta service in Riyadh, confirming management commitment to international revenue diversification.',
        keyThemes: ['Overseas Expansion', 'Food Delivery', 'Market Share'],
      },
      {
        ticker: '1810.HK',
        assetName: 'Xiaomi Corporation',
        exchange: 'HKEX' as ExchangeCode,
        title: 'Xiaomi Monthly EV Output Exceeds 20,000 Units as SU7 Ultra Pre-orders Surge',
        url: 'https://www.caixinglobal.com/business/xiaomi-ev-delivery-milestone',
        publisher: 'Caixin Global',
        daysAgo: 1,
        searchQuery: 'Xiaomi 1810.HK SU7 EV production gross margin',
        relevanceScore: 0.98,
        summary: 'Xiaomi Corporation confirmed monthly manufacturing throughput for its SU7 electric sedan crossed 20,000 units, with executive guidance projecting profitability in the automotive division ahead of schedule.',
        keyThemes: ['EV Deliveries', 'SU7 Ultra', 'Operating Margin', 'Smart Hardware'],
      },

      // KRX
      {
        ticker: '005930.KS',
        assetName: 'Samsung Electronics',
        exchange: 'KRX' as ExchangeCode,
        title: 'Samsung Electronics Outlines 10 Trillion Won Share Repurchase Plan to Bolster Valuation',
        url: 'https://en.yna.co.kr/view/AEN20241115008800320',
        publisher: 'Yonhap News Agency',
        daysAgo: 1,
        searchQuery: 'Samsung Electronics 005930.KS treasury share buyback HBM3E',
        relevanceScore: 0.95,
        summary: 'Samsung Electronics revealed an unprecedented 10 trillion won ($7.2 billion) treasury stock buyback over the next year to lift shareholder returns, as supply verification for advanced HBM3E memory enters final validation.',
        keyThemes: ['Share Repurchase', 'HBM3E Qualification', 'Semiconductor Capex'],
      },
      {
        ticker: '000660.KS',
        assetName: 'SK Hynix',
        exchange: 'KRX' as ExchangeCode,
        title: 'SK Hynix Solidifies AI Memory Monopoly as 2025 HBM Production Completely Sold Out',
        url: 'https://www.koreaherald.com/view.php?ud=20241112000542',
        publisher: 'The Korea Herald',
        daysAgo: 2,
        searchQuery: 'SK Hynix 000660.KS HBM3E HBM4 Nvidia supply contract',
        relevanceScore: 0.97,
        summary: 'SK Hynix CEO stated during an industry keynote that its complete production output of high-bandwidth memory (HBM) for 2025 has been secured through binding long-term contracts with major AI hyperscalers and GPU designers.',
        keyThemes: ['HBM Market Leader', 'Nvidia Supplier', 'Operating Profit Record'],
      },
      {
        ticker: '035420.KS',
        assetName: 'NAVER',
        exchange: 'KRX' as ExchangeCode,
        title: 'Naver Accelerates B2B Monetization with HyperCLOVA X Enterprise Deployments',
        url: 'https://koreajoongangdaily.joins.com/business/tech/naver-ai-hyperclovax',
        publisher: 'Korea JoongAng Daily',
        daysAgo: 3,
        searchQuery: 'NAVER 035420.KS HyperCLOVA X enterprise AI cloud webtoon',
        relevanceScore: 0.91,
        summary: 'South Korea portal giant Naver secured multiple enterprise contracts with major financial conglomerates for sovereign AI deployment, alongside steady revenue contributions from its global Webtoon unit.',
        keyThemes: ['Generative AI', 'Sovereign LLM', 'Webtoon Revenue'],
      },
      {
        ticker: '035720.KS',
        assetName: 'Kakao',
        exchange: 'KRX' as ExchangeCode,
        title: 'Kakao Restructures Core Business Units to Focus on Next-Gen KakaoTalk AI Assistant',
        url: 'https://www.pulsenews.co.kr/view.php?year=2024&no=845210',
        publisher: 'Pulse News Korea',
        daysAgo: 2,
        searchQuery: 'Kakao 035720.KS Kanana AI assistant governance restructuring',
        relevanceScore: 0.87,
        summary: 'Kakao announced a consolidation of non-core affiliates to streamline operating costs and focus development on Kanana, its integrated AI companion within the ubiquitous KakaoTalk messaging ecosystem.',
        keyThemes: ['Governance Overhaul', 'KakaoTalk AI', 'Cost Optimization'],
      },
      {
        ticker: '005380.KS',
        assetName: 'Hyundai Motor',
        exchange: 'KRX' as ExchangeCode,
        title: 'Hyundai Motor Sets Record Quarterly Operating Margin on Hybrid Strength and Shareholder Return Push',
        url: 'https://www.reuters.com/business/autos-transportation/hyundai-motor-earnings-q3',
        publisher: 'Reuters',
        daysAgo: 1,
        searchQuery: 'Hyundai Motor 005380.KS Georgia Metaplant hybrid sales dividend',
        relevanceScore: 0.96,
        summary: 'Hyundai Motor delivered industry-leading operating profit margins, propelled by strong hybrid SUV demand in North America and preparations to begin assembly at its state-of-the-art Georgia Metaplant.',
        keyThemes: ['Hybrid Sales Boom', 'Metaplant Operation', 'Value-Up Program'],
      },
    ];

    this.articles = rawNews.map((n, idx) => {
      const pubDate = new Date(now.getTime() - n.daysAgo * 24 * 60 * 60 * 1000);
      const sentiment = analyzeMultilingualSentiment(`${n.title}. ${n.summary}`);

      return {
        id: `news_${idx + 1}`,
        ticker: n.ticker,
        assetName: n.assetName,
        exchange: n.exchange,
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
