import React, { useState, useEffect } from 'react';
import { NewsArticle, ExchangeCode } from '../types';
import { Newspaper, Search, ExternalLink, ArrowRight, Sparkles } from 'lucide-react';
import { TranslatedText } from './TranslatedText';

export const NewsIntelligenceView: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeCode | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [newsSourceMode, setNewsSourceMode] = useState<'live' | 'local-fallback' | null>(null);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      try {
        const [res, statusRes] = await Promise.all([
          fetch('/api/v1/news'),
          fetch('/api/v1/sources/status'),
        ]);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.news || []);
        }
        if (statusRes.ok) {
          const status = await statusRes.json();
          const exa = (status.sources || []).find((s: any) => s.id === 'exa_news');
          setNewsSourceMode(exa?.mode === 'live' ? 'live' : 'local-fallback');
        }
      } catch (err) {
        console.error('Failed to load news articles:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNews();
  }, []);

  const filtered = articles.filter(art => {
    const matchEx = selectedExchange === 'ALL' || art.exchange === selectedExchange;
    const matchSearch =
      art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.publisher.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchTerm.toLowerCase());
    return matchEx && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            News Intelligence Discovery
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Recent financial news, earnings disclosures, and analyst revisions.{' '}
            {newsSourceMode === 'live'
              ? 'Source: LIVE Exa API.'
              : newsSourceMode === 'local-fallback'
                ? 'Source: curated local fallback dataset (EXA_API_KEY not configured).'
                : 'Checking news source status...'}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search news by ticker, title, headline, or publisher..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
            <button
              key={ex}
              onClick={() => setSelectedExchange(ex)}
              className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-colors shrink-0 ${
                selectedExchange === ex
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {ex === 'ALL' ? 'All Exchanges' : ex}
            </button>
          ))}
        </div>
      </div>

      {/* News Articles Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading news repository...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">No articles found matching filters.</div>
        ) : (
          filtered.map(art => {
            const isPos = art.sentimentScore > 20;
            const isNeg = art.sentimentScore < -20;

            return (
              <div
                key={art.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {art.ticker}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{art.assetName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {art.publisher}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {art.publishedAt.split('T')[0]}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-slate-400">
                      Relevance: <span className="font-semibold text-emerald-500">{(art.relevanceScore * 100).toFixed(0)}%</span>
                    </span>
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        isPos ? 'text-emerald-500' : isNeg ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {art.sentimentScore > 0 ? `+${art.sentimentScore}` : art.sentimentScore} ({art.sentimentLabel})
                    </span>
                    <a
                      href={art.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Open Original Source"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  <TranslatedText
                    original={art.title}
                    translation={art.titleEn}
                    originalLang="en"
                    className="text-sm font-semibold text-slate-900 dark:text-white"
                  />
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  <TranslatedText
                    original={art.summary}
                    translation={art.summaryEn}
                    originalLang="en"
                    className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans"
                  />
                </p>

                {art.keyThemes && art.keyThemes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                    <span className="font-medium">Identified Catalyst Themes:</span>
                    {art.keyThemes.map((theme, i) => (
                      <span
                        key={i}
                        className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
