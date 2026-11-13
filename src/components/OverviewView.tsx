import React, { useState, useEffect } from 'react';
import { Asset, ExchangeCode, SentimentDirection } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Globe2,
  MessageSquare,
  Newspaper,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { TranslatedText } from './TranslatedText';
import { apiJson } from '../lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

interface OverviewViewProps {
  assets: Asset[];
  selectedExchange: ExchangeCode | 'ALL';
  onSelectAsset: (asset: Asset) => void;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  assets,
  selectedExchange,
  onSelectAsset,
  onNavigateTab,
}) => {
  const viewAssets = selectedExchange === 'ALL'
    ? assets
    : assets.filter(a => a.exchange === selectedExchange);

  const totalAssets = viewAssets.length;
  const totalMentions = viewAssets.reduce((sum, a) => sum + a.socialMentions, 0);
  const totalNews = viewAssets.reduce((sum, a) => sum + a.newsMentions, 0);
  const avgSentiment = Number((viewAssets.reduce((sum, a) => sum + a.overallSentiment, 0) / (totalAssets || 1)).toFixed(1));

  const bullishCount = viewAssets.filter(a => a.overallSentiment > 20).length;
  const bearishCount = viewAssets.filter(a => a.overallSentiment < -20).length;
  const neutralCount = totalAssets - bullishCount - bearishCount;

  // Live source status + model performance (never hardcoded)
  const [sourceStatus, setSourceStatus] = useState<any>(null);
  useEffect(() => {
    async function loadStatus() {
      try {
        setSourceStatus(await apiJson('/api/v1/sources/status'));
      } catch (err) {
        console.error('Failed to load source status:', err);
      }
    }
    loadStatus();
  }, []);

  const exaSource = sourceStatus?.sources?.find((s: any) => s.id === 'exa_news');
  const socialSource = sourceStatus?.sources?.find((s: any) => s.id === 'apify_social');
  const modelPerf = sourceStatus?.modelPerformance;
  const platformCount: number = socialSource?.platforms?.length || 0;

  const exchangeStats = (code: ExchangeCode) => {
    const subset = viewAssets.filter(a => a.exchange === code);
    const topBullish = [...subset].sort((a, b) => b.overallSentiment - a.overallSentiment)[0];
    return {
      count: subset.length,
      avgSentiment: Number((subset.reduce((s, a) => s + a.overallSentiment, 0) / (subset.length || 1)).toFixed(1)),
      socialVolume: subset.reduce((s, a) => s + a.socialMentions, 0),
      topBullish: topBullish ? topBullish.ticker : '-',
    };
  };
  const hkStats = exchangeStats('HKEX');
  const krStats = exchangeStats('KRX');

  // Chart data: Sentiment score per asset
  const sentimentDistributionData = viewAssets.map(a => ({
    ticker: a.ticker.split('.')[0],
    fullName: a.name,
    exchange: a.exchange,
    sentiment: a.overallSentiment,
    mentions: a.socialMentions,
  }));

  // Top trending assets by mentions
  const topTrending = [...viewAssets].sort((a, b) => b.socialMentions - a.socialMentions).slice(0, 5);

  // Top bullish forecast assets
  const topForecasts = [...viewAssets].sort((a, b) => b.predictedChangePercent - a.predictedChangePercent).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monitored Assets</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalAssets}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            HKEX ({viewAssets.filter(a => a.exchange === 'HKEX').length}) · KRX ({viewAssets.filter(a => a.exchange === 'KRX').length})
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Social Volume</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalMentions}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            {platformCount > 0 ? `${platformCount} Platform Feeds (Local Dataset)` : 'Platform feeds loading…'}
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">News Intel</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalNews}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            {exaSource ? (exaSource.mode === 'live' ? 'LIVE Exa API' : 'Curated Fallback Dataset') : 'Source status loading…'}
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Market Sentiment</div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono mt-1 tabular-nums ${
              avgSentiment > 20 ? 'text-emerald-500' : avgSentiment < -20 ? 'text-red-500' : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            {avgSentiment > 0 ? `+${avgSentiment}` : avgSentiment}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            {avgSentiment > 20 ? 'Bullish Bias (+20 Thresh)' : avgSentiment < -20 ? 'Bearish Bias (-20 Thresh)' : 'Neutral Bias'}
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Sentiment Breadth</div>
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1">
            <span className="font-mono text-[11px] sm:text-xs font-bold text-emerald-500">{bullishCount} Bull</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-400">{neutralCount} Neu</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-mono text-[11px] sm:text-xs font-bold text-red-500">{bearishCount} Bear</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">Cross-Exchange</div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider">Directional Acc.</div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-1 tabular-nums">
            {modelPerf ? `${modelPerf.directionalAccuracyPercent}%` : '-'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">
            {modelPerf
              ? `Walk-Fwd · ${modelPerf.totalOutOfSampleObservations} OOS obs`
              : 'Out-of-Sample Walk-Fwd'}
          </div>
        </div>
      </div>

      {/* Main Grid: Sentiment Chart & Top Predictions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Distribution Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Cross-Asset Sentiment Polarity (-100 to +100)
              </h2>
              <p className="text-[11px] text-slate-400">
                Engagement-weighted social sentiment combined with relevance-weighted financial news sentiment.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('social')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Explore Sentiment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                <XAxis dataKey="ticker" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis domain={[-100, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#0f172a',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val > 0 ? '+' : ''}${val}`, 'Sentiment Score']}
                />
                <Bar dataKey="sentiment" radius={[4, 4, 0, 0]}>
                  {sentimentDistributionData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.sentiment >= 20 ? '#10b981' : entry.sentiment <= -20 ? '#ef4444' : '#64748b'}
                    />
                  ))}
                </Bar>
                {/* Selected sentiment readout (always visible, high contrast) */}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">Sentiment Range</span>
              <span className="font-mono font-bold text-slate-900 dark:text-emerald-300 tabular-nums">
                {`${sentimentDistributionData.length > 0 ? Math.min(...sentimentDistributionData.map(d => d.sentiment)) : 0} to ${sentimentDistributionData.length > 0 ? Math.max(...sentimentDistributionData.map(d => d.sentiment)) : 0}`}
              </span>
            </div>
          </div>
        </div>

        {/* Prediction Highlights */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Next-Period (n+1) Forecast Leaders
              </h2>
              <button
                onClick={() => onNavigateTab('predictions')}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>View All 10</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Top predicted percentage drifts for the upcoming market session.
            </p>

            <div className="space-y-3">
              {topForecasts.map(asset => {
                const isPositive = asset.predictedChangePercent >= 0;
                return (
                  <div
                    key={asset.ticker}
                    onClick={() => onSelectAsset(asset)}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {asset.ticker}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {asset.name}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {asset.currency === 'KRW' ? `₩${asset.predictedPrice.toLocaleString()}` : `HK$${asset.predictedPrice.toFixed(2)}`}
                      </div>
                      <div
                        className={`font-mono text-[11px] font-semibold tabular-nums ${
                          isPositive ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {asset.predictedChangePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
            Validated via chronological Walk-Forward regression ensemble.
          </div>
        </div>
      </div>

      {/* Second Row: Top Trending Discussions & Exchange Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Trending Discussions */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Top Trending Assets by Discussion Volume
            </h2>
            <button
              onClick={() => onNavigateTab('assets')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Full Rankings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {topTrending.map((asset, idx) => (
              <div
                key={asset.ticker}
                onClick={() => onSelectAsset(asset)}
                className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
                  <span className="font-mono text-slate-400 w-4 shrink-0">{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                      {asset.ticker}
                      <TranslatedText
                        original={`(${asset.nameLocal})`}
                        translation={asset.name}
                        originalLang={asset.exchange === 'HKEX' ? 'zh-HK' : 'ko'}
                        className="text-[11px] text-slate-400 ml-1"
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{asset.exchange} · {asset.sector}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-6 text-right shrink-0">
                  <div className="hidden min-[420px]:block">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {asset.socialMentions} mentions
                    </div>
                    <div className="text-[10px] text-slate-400">{asset.newsMentions} news</div>
                  </div>

                  <div className="w-16 sm:w-24 text-right">
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        asset.overallSentiment > 20
                          ? 'text-emerald-500'
                          : asset.overallSentiment < -20
                          ? 'text-red-500'
                          : 'text-slate-400'
                      }`}
                    >
                      {asset.overallSentiment > 0 ? `+${asset.overallSentiment}` : asset.overallSentiment}
                    </span>
                    <div className="text-[10px] text-slate-500">{asset.sentimentDirection}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exchange Side-by-Side Summary */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Exchange Intelligence Comparison
            </h2>
            <button
              onClick={() => onNavigateTab('exchange')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
            >
              <span>Exchange Intel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* HKEX Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">HKEX</span>
                <span className="text-[11px] font-mono text-slate-400">Asia/Hong_Kong</span>
              </div>
              <div className="text-xs text-slate-500">
                Hong Kong Exchange (5 Monitored Assets)
              </div>
              <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Avg Sentiment</span>
                  <span
                    className={`font-semibold ${
                      hkStats.avgSentiment > 20 ? 'text-emerald-500' : hkStats.avgSentiment < -20 ? 'text-red-500' : 'text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {hkStats.avgSentiment > 0 ? `+${hkStats.avgSentiment}` : hkStats.avgSentiment}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Social Volume</span>
                  <span>{hkStats.socialVolume} posts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Top Bullish</span>
                  <span className="font-semibold text-emerald-500">{hkStats.topBullish}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sources</span>
                  <span className="text-[10px]">LIHKG · TG · Futu</span>
                </div>
              </div>
            </div>

            {/* KRX Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">KRX</span>
                <span className="text-[11px] font-mono text-slate-400">Asia/Seoul</span>
              </div>
              <div className="text-xs text-slate-500">
                Korea Exchange (5 Monitored Assets)
              </div>
              <div className="space-y-1.5 text-xs font-mono pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Avg Sentiment</span>
                  <span
                    className={`font-semibold ${
                      krStats.avgSentiment > 20 ? 'text-emerald-500' : krStats.avgSentiment < -20 ? 'text-red-500' : 'text-slate-500 dark:text-slate-300'
                    }`}
                  >
                    {krStats.avgSentiment > 0 ? `+${krStats.avgSentiment}` : krStats.avgSentiment}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Social Volume</span>
                  <span>{krStats.socialVolume} posts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Top Bullish</span>
                  <span className="font-semibold text-emerald-500">{krStats.topBullish}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sources</span>
                  <span className="text-[10px]">Naver · TG · Daum</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
