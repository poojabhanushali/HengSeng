import React, { useState, useEffect } from 'react';
import { ExecutiveReport, ExchangeCode } from '../types';
import { FileSpreadsheet, Download, Printer, Plus, Sparkles, CheckCircle2 } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<ExecutiveReport[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeCode | 'ALL'>('ALL');

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch('/api/v1/reports');
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports || []);
        }
      } catch (err) {
        console.error('Failed to load reports:', err);
      }
    }
    loadReports();
  }, []);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: selectedExchange }),
      });
      if (res.ok) {
        const newRep = await res.json();
        setReports(prev => [newRep, ...prev]);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Executive Quantitative Intelligence Briefings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exchange-level consolidated analytical reports synthesizing multi-source social momentum and walk-forward prediction scores.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
              <button
                key={ex}
                onClick={() => setSelectedExchange(ex)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedExchange === ex
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{generating ? 'Compiling Briefing...' : 'Generate New Briefing'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-6">
        {reports.map(report => (
          <div
            key={report.id}
            className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4"
          >
            {/* Report Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    {report.exchange} BRIEFING
                  </span>
                  <span className="text-xs text-slate-400">·</span>
                  <span className="font-mono text-xs text-slate-500">{report.createdAt.split('T')[0]} (UTC)</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {report.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/v1/reports/${report.id}/download?format=csv`}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-emerald-500 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800"
                >
                  <Download className="w-3 h-3" />
                  <span>Download CSV</span>
                </a>
              </div>
            </div>

            {/* Key Metric Highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase">Top Bullish Asset</div>
                <div className="font-bold text-emerald-500 mt-0.5 truncate">{report.topBullishAsset}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase">Top Bearish / Cautious</div>
                <div className="font-bold text-red-500 mt-0.5 truncate">{report.topBearishAsset}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase">Average Sentiment</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">+{report.averageSentiment} pts</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div className="text-[10px] text-slate-400 uppercase">Model Directional Acc.</div>
                <div className="font-bold text-emerald-500 mt-0.5">{report.modelDirectionalAccuracy}%</div>
              </div>
            </div>

            {/* Synthesis Prose */}
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              {report.summaryProse}
            </p>

            {/* Asset Rankings Mini Table */}
            <div className="hidden lg:block overflow-x-auto pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-semibold text-slate-400">
                    <th className="py-2 px-3">Ticker</th>
                    <th className="py-2 px-3">Asset</th>
                    <th className="py-2 px-3 text-right">Current Price</th>
                    <th className="py-2 px-3 text-right">Sentiment Score</th>
                    <th className="py-2 px-3 text-right">Predicted Price (n+1)</th>
                    <th className="py-2 px-3 text-right">Predicted Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  {report.assetsRanked.map(a => (
                    <tr key={a.ticker}>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{a.ticker}</td>
                      <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">{a.name}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {a.currency === 'KRW' ? `₩${a.currentPrice.toLocaleString()}` : `HK$${a.currentPrice.toFixed(2)}`}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-bold tabular-nums ${
                          a.overallSentiment > 0 ? 'text-emerald-500' : a.overallSentiment < 0 ? 'text-red-500' : 'text-slate-400'
                        }`}
                      >
                        {a.overallSentiment > 0 ? `+${a.overallSentiment}` : a.overallSentiment}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {a.currency === 'KRW' ? `₩${a.predictedPrice.toLocaleString()}` : `HK$${a.predictedPrice.toFixed(2)}`}
                      </td>
                      <td className={`py-2 px-3 text-right tabular-nums ${a.predictedChangePercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {a.predictedChangePercent >= 0 ? '+' : ''}{a.predictedChangePercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards (no horizontal scroll) */}
            <div className="block lg:hidden pt-2 space-y-2">
              {report.assetsRanked.map(a => {
                const isPos = a.priceChangePercent >= 0;
                const isPredPos = a.predictedChangePercent >= 0;
                return (
                  <div
                    key={a.ticker}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {a.ticker}
                      </span>
                      <span className="text-[9px] text-slate-400">{a.exchange}</span>
                    </div>
                    <div className="text-[9px] text-slate-500 truncate mb-1.5">{a.name}</div>
                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div>
                        <div className="text-[8px] text-slate-400">Current Price</div>
                        <div className="font-mono text-slate-900 dark:text-slate-100">
                          {a.currency === 'KRW' ? `₩${a.currentPrice.toLocaleString()}` : `HK$${a.currentPrice.toFixed(2)}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-400">Sentiment</div>
                        <div className={`font-mono font-medium ${a.overallSentiment > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {a.overallSentiment > 0 ? '+' : ''}{a.overallSentiment}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-400">Predicted Price</div>
                        <div className="font-mono text-slate-900 dark:text-slate-100">
                          {a.currency === 'KRW' ? `₩${a.predictedPrice.toLocaleString()}` : `HK$${a.predictedPrice.toFixed(2)}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8px] text-slate-400">Predicted Change</div>
                        <div className={`font-mono font-medium ${isPredPos ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPredPos ? '+' : ''}{a.predictedChangePercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
