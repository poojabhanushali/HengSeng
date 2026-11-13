import React, { useState, useEffect } from 'react';
import { Asset, BacktestPoint } from '../types';
import { History, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { apiJson } from '../lib/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface BacktestingViewProps {
  assets: Asset[];
}

export const BacktestingView: React.FC<BacktestingViewProps> = ({ assets }) => {
  const [selectedTicker, setSelectedTicker] = useState('0700.HK');
  const [points, setPoints] = useState<BacktestPoint[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBacktest() {
      setLoading(true);
      try {
        const data = await apiJson(`/api/v1/predictions/backtesting?ticker=${selectedTicker}`);
        setPoints(data.backtestPoints || []);
        setSummary(data.summary || null);
      } catch (err) {
        console.error('Failed to load backtest points:', err);
        setPoints([]);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }
    loadBacktest();
  }, [selectedTicker]);

  const selectedAsset = assets.find(a => a.ticker === selectedTicker);
  const totalFolds = points.length;
  const matchCount = points.filter(p => p.directionMatch).length;
  // Computed from the evaluation service; never a hardcoded placeholder
  const directionalRate = summary ? summary.directionalAccuracyPercent : totalFolds > 0 ? Number(((matchCount / totalFolds) * 100).toFixed(1)) : null;
  const avgError = summary ? summary.meanAbsoluteError : totalFolds > 0 ? Number((points.reduce((s, p) => s + p.absoluteError, 0) / totalFolds).toFixed(2)) : null;
  const baselineImprovement = summary?.baselineImprovementPercent ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Historical Backtesting Lab
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Chronological Walk-Forward simulated predictions vs actual observed market closing prices.
          </p>
        </div>

        {/* Ticker Selector */}
        <select
          value={selectedTicker}
          onChange={e => setSelectedTicker(e.target.value)}
          aria-label="Select asset for backtesting"
          className="text-xs font-mono font-medium py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
        >
          {assets.map(a => (
            <option key={a.ticker} value={a.ticker}>
              {a.ticker} - {a.name} ({a.exchange})
            </option>
          ))}
        </select>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Evaluation Folds</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalFolds} Bars
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Expanding Out-of-Sample Window</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Directional Hit Rate</div>
          <div className="text-2xl font-bold font-mono text-emerald-500 mt-1 tabular-nums">
            {directionalRate !== null ? `${directionalRate}%` : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {directionalRate !== null ? `${summary?.hitCount ?? matchCount} of ${summary?.folds ?? totalFolds} session trends correctly called` : 'Awaiting evaluation data'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Mean Absolute Error</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
            {avgError !== null
              ? selectedAsset?.currency === 'KRW'
                ? `₩${avgError.toLocaleString()}`
                : `HK$${avgError}`
              : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {avgError !== null ? `Avg forecast distance in ${selectedAsset?.currency || ''} · MAPE ${summary?.mapePercent ?? '-'}%` : 'Awaiting evaluation data'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Baseline Outperformance</div>
          <div
            className={`text-2xl font-bold font-mono mt-1 tabular-nums ${
              baselineImprovement === null ? 'text-slate-400' : baselineImprovement >= 0 ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            {baselineImprovement !== null ? `${baselineImprovement >= 0 ? '+' : ''}${baselineImprovement}%` : '-'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {summary?.persistenceMae != null
              ? `Production MAE ${summary.meanAbsoluteError} vs persistence MAE ${summary.persistenceMae} (${selectedAsset?.currency || ''})`
              : 'Over persistence baseline MAE'}
          </div>
        </div>
      </div>

      {/* Actual vs Predicted Chart */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Actual vs Predicted Price Progression ({selectedTicker})
            </h2>
            <p className="text-[11px] text-slate-400">
              Visualizing prediction alignment against realized out-of-sample trading session closes.
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading simulation points...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="actualPrice" name="Actual Realized Close" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="predictedPrice" name="Model Predicted Target" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Historical Point by Point Inspection Table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3">Evaluation Date (UTC)</th>
              <th className="py-3 px-3 text-right">Actual Realized Price</th>
              <th className="py-3 px-3 text-right">Model Predicted Price</th>
              <th className="py-3 px-3 text-right">Absolute Error</th>
              <th className="py-3 px-3 text-center">Direction Hit</th>
              <th className="py-3 px-3 text-right">Social Sentiment Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {points.map((pt, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{pt.date}</td>
                <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-white tabular-nums">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.actualPrice.toLocaleString()}` : `HK$${pt.actualPrice.toFixed(2)}`}
                </td>
                <td className="py-3 px-3 text-right font-medium text-slate-900 dark:text-white tabular-nums">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.predictedPrice.toLocaleString()}` : `HK$${pt.predictedPrice.toFixed(2)}`}
                </td>
                <td className="py-3 px-3 text-right text-slate-500 tabular-nums">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.absoluteError.toLocaleString()}` : `HK$${pt.absoluteError}`}
                </td>
                <td className="py-3 px-3 text-center">
                  {pt.directionMatch ? (
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold text-[10px]">
                      <CheckCircle className="w-3 h-3" /> Hit
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-[10px]">
                      <XCircle className="w-3 h-3" /> Miss
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                  {pt.sentimentScore > 0 ? `+${pt.sentimentScore}` : pt.sentimentScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards (no horizontal scroll) */}
      <div className="block lg:hidden space-y-3 pt-2">
        {points.map((pt, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
          >
            <div className="flex items-center justify-between text-[10px] mb-1.5">
              <span className="font-medium text-slate-900 dark:text-slate-100">{pt.date}</span>
              <span className={`font-mono font-semibold ${pt.directionMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                {pt.directionMatch ? 'Hit' : 'Miss'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-700 dark:text-slate-300">
              <div>
                <div className="text-[9px] text-slate-400">Actual Realized Price</div>
                <div className="font-mono text-slate-900 dark:text-slate-100">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.actualPrice.toLocaleString()}` : `HK$${pt.actualPrice.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">Model Predicted Price</div>
                <div className="font-mono text-slate-900 dark:text-slate-100">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.predictedPrice.toLocaleString()}` : `HK$${pt.predictedPrice.toFixed(2)}`}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">Absolute Error</div>
                <div className="font-mono text-slate-500">
                  {selectedAsset?.currency === 'KRW' ? `₩${pt.absoluteError.toLocaleString()}` : `HK$${pt.absoluteError}`}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400">Social Sentiment</div>
                <div className="font-mono">
                  {pt.sentimentScore > 0 ? `+${pt.sentimentScore}` : pt.sentimentScore}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
