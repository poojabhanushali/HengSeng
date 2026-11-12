import React from 'react';
import { Asset, ExchangeCode } from '../types';
import { Globe2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface ExchangeViewProps {
  assets: Asset[];
  selectedExchange: ExchangeCode | 'ALL';
  setSelectedExchange: (ex: ExchangeCode | 'ALL') => void;
  onSelectAsset: (asset: Asset) => void;
}

export const ExchangeView: React.FC<ExchangeViewProps> = ({ assets, selectedExchange, setSelectedExchange, onSelectAsset }) => {
  const viewAssets = selectedExchange === 'ALL'
    ? assets
    : assets.filter(a => a.exchange === selectedExchange);
  const selectedEx: ExchangeCode | 'ALL' = selectedExchange;

  const exchangeAssets = viewAssets;
  const avgSentiment = Number(
    (exchangeAssets.reduce((sum, a) => sum + a.overallSentiment, 0) / (exchangeAssets.length || 1)).toFixed(1)
  );
  const totalSocial = exchangeAssets.reduce((sum, a) => sum + a.socialMentions, 0);
  const totalNews = exchangeAssets.reduce((sum, a) => sum + a.newsMentions, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Exchange Intelligence Terminal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deep-dive cross-sectional analysis across Hong Kong Exchange (HKEX) and Korea Exchange (KRX).
          </p>
        </div>

        {/* Exchange Selector */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
            <button
              key={ex}
              onClick={() => setSelectedExchange(ex)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedExchange === ex
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {ex === 'ALL' ? 'All Exchanges (10)' : ex === 'HKEX' ? 'Hong Kong Exchange (HKEX)' : 'Korea Exchange (KRX)'}
            </button>
          ))}
        </div>
      </div>

      {/* Exchange Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Trading Currency</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {selectedEx === 'HKEX' ? 'HKD (Hong Kong Dollar)' : 'KRW (South Korean Won)'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Timezone: {selectedEx === 'HKEX' ? 'Asia/Hong_Kong (UTC+8)' : 'Asia/Seoul (UTC+9)'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Average Sentiment</div>
          <div className="text-xl font-bold font-mono text-emerald-500 mt-1 tabular-nums">
            +{avgSentiment}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Standardized Range (-100 to +100)</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Social Volume</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalSocial} posts
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across 10-day UTC window</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Configured Sources</div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {selectedEx === 'HKEX' ? 'LIHKG · Telegram · Futu' : 'Naver Finance · Telegram · Daum'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Independent Ingestion Feeds</div>
        </div>
      </div>

      {/* Monitored Assets Cards Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">
          Monitored {selectedExchange === 'ALL' ? 'All' : selectedExchange} Assets ({exchangeAssets.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {exchangeAssets.map(asset => {
            const isPos = asset.priceChangePercent >= 0;
            const isPredPos = asset.predictedChangePercent >= 0;

            return (
              <div
                key={asset.ticker}
                onClick={() => onSelectAsset(asset)}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                      {asset.ticker}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {asset.nameLocal}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {asset.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mb-4">
                    {asset.sector}
                  </div>

                  {/* Price & Change */}
                  <div className="flex items-baseline justify-between py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-500">Current Price</span>
                    <div className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {asset.currency === 'KRW' ? `₩${asset.currentPrice.toLocaleString()}` : `HK$${asset.currentPrice.toFixed(2)}`}
                      <span className={`ml-2 text-[11px] ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPos ? '+' : ''}{asset.priceChangePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* Sentiment & Mentions */}
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-500">Sentiment Score</span>
                    <span className={`font-mono font-semibold tabular-nums ${asset.overallSentiment > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {asset.overallSentiment > 0 ? `+${asset.overallSentiment}` : asset.overallSentiment} ({asset.sentimentDirection})
                    </span>
                  </div>

                  {/* Prediction (n+1) */}
                  <div className="flex items-center justify-between py-2 text-xs">
                    <span className="text-slate-500">Predicted (n+1)</span>
                    <div className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {asset.currency === 'KRW' ? `₩${asset.predictedPrice.toLocaleString()}` : `HK$${asset.predictedPrice.toFixed(2)}`}
                      <span className={`ml-2 text-[11px] ${isPredPos ? 'text-emerald-500' : 'text-red-500'}`}>
                        {isPredPos ? '+' : ''}{asset.predictedChangePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Pivot: {asset.pivotPoint}</span>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
