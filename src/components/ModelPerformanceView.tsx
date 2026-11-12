import React, { useState, useEffect } from 'react';
import { ModelPerformance } from '../types';
import { Cpu, CheckCircle2, ShieldCheck, ArrowRight, BarChart2 } from 'lucide-react';
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

export const ModelPerformanceView: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPerformance() {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/predictions/performance');
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setMeta(data);
        }
      } catch (err) {
        console.error('Failed to load model performance:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPerformance();
  }, []);

  // Model-derived contribution shares returned by the backend (standardized ridge coefficients)
  const featureImportanceData = (meta?.featureImportance || []).map((f: any) => ({
    name: f.feature.length > 26 ? `${f.feature.slice(0, 24)}…` : f.feature,
    importance: Math.round(f.importance * 100),
    fullName: f.feature,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Model Validation & Benchmark Leaderboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Strict chronological Walk-Forward Out-of-Sample cross-validation comparing predictive models against naive benchmarks.
          </p>
        </div>
      </div>

      {/* Methodology Explainer Callout */}
      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 text-xs text-slate-700 dark:text-slate-300 space-y-1">
        <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4" />
          <span>Zero Lookahead Leakage Guarantee (Chronological Walk-Forward)</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Every evaluation observation represents an unseen next trading session. Data is partitioned sequentially without random shuffling or future information leakage. Models are measured against the industry gold standard: the Naive Persistence Baseline ($P_{'{'}n+1{'}'} = P_n$).
        </p>
        {meta?.methodology && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
            {meta.methodology.assetsEvaluated} assets × {meta.methodology.foldsPerAsset} folds = {meta.methodology.totalOutOfSampleObservations} out-of-sample observations.
            MAE for HKEX is reported in HKD and KRX in KRW; use MAPE (%) to compare across currencies.
          </p>
        )}
      </div>

      {/* Model Leaderboard Table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3">Model Architecture</th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-right">Directional Acc.</th>
              <th className="py-3 px-3 text-right">MAPE %</th>
              <th className="py-3 px-3 text-right">MAE (HKEX · HKD)</th>
              <th className="py-3 px-3 text-right">MAE (KRX · KRW)</th>
              <th className="py-3 px-3 text-right">Out-of-Sample R²</th>
              <th className="py-3 px-3 text-right">OOS N</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {leaderboard.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  {loading ? 'Loading benchmark leaderboard...' : 'No benchmark data available.'}
                </td>
              </tr>
            ) : (
              leaderboard.map((m, idx) => (
                <tr key={m.modelName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 font-sans font-medium text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span>{m.modelName}</span>
                      {m.champion && (
                        <span className="font-mono text-[9px] text-emerald-500 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                          PRODUCTION
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-[9px] text-slate-500">
                      {m.champion ? 'Deployed Production Model' : 'Benchmark / Challenger'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-500 font-bold tabular-nums">
                    {m.averageDirectionalAccuracy}%
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.averageMapePercent}%
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.hkexAverageMae !== null && m.hkexAverageMae !== undefined ? `HK$${m.hkexAverageMae}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.krxAverageMae !== null && m.krxAverageMae !== undefined ? `₩${m.krxAverageMae.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums">
                    {m.averageR2}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 tabular-nums">
                    {m.totalOutOfSampleSamples}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards (no horizontal scroll) */}
      <div className="block lg:hidden space-y-3 pt-2">
        {leaderboard.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-xs">
            {loading ? 'Loading benchmark leaderboard...' : 'No benchmark data available.'}
          </div>
        ) : (
          leaderboard.map((m, idx) => (
            <div
              key={m.modelName}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans font-medium text-slate-900 dark:text-white text-sm truncate">
                  {m.modelName}
                </span>
                {m.champion && (
                  <span className="font-mono text-[9px] text-emerald-500 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                    PRODUCTION
                  </span>
                )}
              </div>
              <div className="text-[9px] text-slate-500 mb-2.5">
                {m.champion ? 'Deployed Production Model' : 'Benchmark / Challenger'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <div className="text-[9px] text-slate-400">Directional Acc.</div>
                  <div className="font-mono font-bold text-emerald-500">{m.averageDirectionalAccuracy}%</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400">MAPE %</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">{m.averageMapePercent}%</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400">MAE HKEX (HKD)</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {m.hkexAverageMae !== null && m.hkexAverageMae !== undefined ? `HK$${m.hkexAverageMae}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400">MAE KRX (KRW)</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">
                    {m.krxAverageMae !== null && m.krxAverageMae !== undefined ? `₩${m.krxAverageMae.toLocaleString()}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400">Out-of-Sample R²</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300">{m.averageR2}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400">OOS N</div>
                  <div className="font-mono text-slate-500">{m.totalOutOfSampleSamples}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Feature Importance Chart */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          Global Feature Contribution Distribution (%)
        </h2>
        <p className="text-[11px] text-slate-400 mb-4">
          Average share of |standardized ridge coefficient| per factor family across all 10 production models (model-derived, not assigned weights).
        </p>

        <div className="h-60 w-full">
          {featureImportanceData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              {loading ? 'Loading feature contributions...' : 'No feature contribution data available.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportanceData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} horizontal={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={140} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, _name: any, item: any) => [`${val}%`, item?.payload?.fullName || 'Relative Weight']}
                />
                <Bar dataKey="importance" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
