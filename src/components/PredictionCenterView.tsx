import React, { useState } from 'react';
import { Asset, PredictionDetail, SentimentDirection } from '../types';
import { TrendingUp, TrendingDown, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';

interface PredictionCenterViewProps {
  assets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onRefreshPredictions: () => void;
}

export const PredictionCenterView: React.FC<PredictionCenterViewProps> = ({
  assets,
  onSelectAsset,
  onRefreshPredictions,
}) => {
  const [retraining, setRetraining] = useState(false);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      await fetch('/api/v1/predictions/run', { method: 'POST' });
      onRefreshPredictions();
    } catch (err) {
      console.error('Failed to trigger prediction run:', err);
    } finally {
      setTimeout(() => setRetraining(false), 500);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Next-Period (n+1) Price Prediction Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Machine learning forecast targets trained on historical price action, engagement-weighted social sentiment, and relevance-weighted news sentiment.
          </p>
        </div>

        <button
          onClick={handleRetrain}
          disabled={retraining}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
          <span>{retraining ? 'Retraining Ensemble...' : 'Retrain All 10 Models'}</span>
        </button>
      </div>

      {/* Forecast Cards Grid for all 10 assets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assets.map(asset => {
          const isPos = asset.predictedChangePercent >= 0;

          return (
            <div
              key={asset.ticker}
              onClick={() => onSelectAsset(asset)}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                      {asset.ticker}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                      {asset.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">{asset.exchange}</span>
                </div>

                {/* Price vs Prediction Comparison */}
                <div className="grid grid-cols-2 gap-3 p-3 my-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Observed Price</div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {asset.currency === 'KRW' ? `₩${asset.currentPrice.toLocaleString()}` : `HK$${asset.currentPrice.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Forecast Target (n+1)</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {asset.currency === 'KRW' ? `₩${asset.predictedPrice.toLocaleString()}` : `HK$${asset.predictedPrice.toFixed(2)}`}
                    </div>
                  </div>
                </div>

                {/* Forecast Direction and Percent */}
                <div className="flex items-center justify-between py-2 border-y border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500">Predicted Drift</span>
                  <div
                    className={`flex items-center gap-1 font-mono font-bold tabular-nums ${
                      isPos ? 'text-emerald-500' : 'text-red-500'
                    }`}
                  >
                    {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>
                      {isPos ? '+' : ''}
                      {asset.predictedChangePercent.toFixed(2)}% ({asset.predictionDirection})
                    </span>
                  </div>
                </div>

                {/* Directional Accuracy and Sentiment Factor */}
                <div className="space-y-1.5 py-2.5 text-xs font-mono text-slate-500">
                  <div className="flex justify-between">
                    <span>Validation Accuracy:</span>
                    <span className="text-emerald-500 font-semibold">
                      {(asset.predictionConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sentiment Influence:</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {asset.overallSentiment > 0 ? `+${asset.overallSentiment}` : asset.overallSentiment} pts
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span>Model: Multi-Factor Quant</span>
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Deep-Dive</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
