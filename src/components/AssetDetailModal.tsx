import React, { useState, useEffect } from 'react';
import { Asset, PriceBar, SocialPost, NewsArticle, PredictionDetail } from '../types';
import {
  X,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Compass,
  ArrowRight,
  ExternalLink,
  Activity,
  Sliders,
  Layers,
  BarChart3,
  PieChart,
  BarChart,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
} from 'recharts';
import { TranslatedText } from './TranslatedText';
import { NestedTabs } from './DropdownMenu';
import { apiJson } from '../lib/api';

interface AssetDetailModalProps {
  asset: Asset;
  onClose: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({ asset, onClose }) => {
  const [bars, setBars] = useState<PriceBar[]>([]);
  const [prediction, setPrediction] = useState<PredictionDetail | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [activeTab, setActiveTab] = useState<'technicals' | 'sentiment' | 'prediction' | 'sources'>('technicals');
  const [predictionSubTab, setPredictionSubTab] = useState<'forecast' | 'features' | 'confidence'>('forecast');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [pData, prData, sData] = await Promise.all([
          apiJson(`/api/v1/assets/${asset.ticker}/prices`),
          apiJson(`/api/v1/assets/${asset.ticker}/predictions`),
          apiJson(`/api/v1/assets/${asset.ticker}/sentiment`),
        ]);
        setBars(pData.bars || []);
        setPrediction(prData.predictionDetail || null);
        setSocialPosts(sData.recentPosts || []);
        setNews(sData.recentNews || []);
      } catch (err) {
        console.error('Failed to load asset details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [asset.ticker]);

  const formattedChartData = bars.map(b => ({
    date: b.timestamp.split('T')[0].substring(5),
    price: b.close,
    open: b.open,
    high: b.high,
    low: b.low,
    sma5: b.sma5,
    sma10: b.sma10,
    rsi: b.rsi14,
    volume: b.volume / 1000000,
  }));

  const isPos = asset.priceChangePercent >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0d121c] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-[#0d121c]/95 backdrop-blur-md z-10 gap-3">
          <div className="flex items-start justify-between w-full sm:w-auto">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {asset.ticker}
                </span>
                <span className="text-sm text-slate-400">·</span>
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                  {asset.name}
                </span>
                <TranslatedText
                  original={`(${asset.nameLocal})`}
                  translation={asset.name}
                  originalLang={asset.exchange === 'HKEX' ? 'zh-HK' : 'ko'}
                  className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] sm:text-xs text-slate-500">
                <span>{asset.exchange}</span>
                <span>·</span>
                <span>{asset.sector}</span>
                <span>·</span>
                <span>Currency: {asset.currency}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
            <div className="text-left sm:text-right">
              <div className="font-mono text-lg sm:text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {asset.currency === 'KRW'
                  ? `₩${asset.currentPrice.toLocaleString()}`
                  : `HK$${asset.currentPrice.toFixed(2)}`}
              </div>
              <div
                className={`flex items-center gap-1 font-mono text-xs tabular-nums ${
                  isPos ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {isPos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {isPos ? '+' : ''}
                  {asset.priceChange.toFixed(2)} ({isPos ? '+' : ''}
                  {asset.priceChangePercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="hidden sm:block p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 px-3 sm:px-6 pt-4 border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs font-medium">
          {[
            { id: 'technicals', label: 'Price & Technicals' },
            { id: 'prediction', label: 'ML Price Forecast (n+1)' },
            { id: 'sentiment', label: 'Multi-Source Sentiment' },
            { id: 'sources', label: 'Discussions & News' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`pb-2 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              } px-2 sm:px-2.5 py-1.5`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 space-y-6 flex-1">
          {/* TAB 1: Technicals & Price Action */}
          {activeTab === 'technicals' && (
            <div className="space-y-6">
              {/* Price Chart */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    10-DAY DAILY CLOSING & SMA TREND ({asset.currency})
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-emerald-500"></span> Close
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-blue-500"></span> SMA 5
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        domain={['dataMin - 1', 'dataMax + 1']}
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={v => (asset.currency === 'KRW' ? `${Math.round(v / 1000)}k` : v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px',
                        }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorClose)" />
                      <Line type="monotone" dataKey="sma5" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Technical Levels & Pivots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium mb-2">SUPPORT LEVELS</div>
                  <div className="space-y-1.5 font-mono text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Support 1 (S1)</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.supportLevels[0] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Support 2 (S2)</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.supportLevels[1] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">10-Day Swing Low</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.supportLevels[2] || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium mb-2">FLOOR TRADER PIVOT</div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                    {asset.pivotPoint}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2">
                    Pivot = (High + Low + Close) / 3 calculated from previous market session.
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium mb-2">RESISTANCE LEVELS</div>
                  <div className="space-y-1.5 font-mono text-xs tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resistance 1 (R1)</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.resistanceLevels[0] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Resistance 2 (R2)</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.resistanceLevels[1] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">10-Day Swing High</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.resistanceLevels[2] || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ML Price Forecast (n+1) */}
          {activeTab === 'prediction' && (
            <div className="space-y-6">
              {/* Nested Sub-tabs */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <NestedTabs
                  tabs={[
                    { id: 'forecast', label: 'Forecast Target', icon: <TrendingUp className="w-3 h-3" /> },
                    { id: 'features', label: 'Feature Breakdown', icon: <PieChart className="w-3 h-3" /> },
                    { id: 'confidence', label: 'Confidence Intervals', icon: <BarChart className="w-3 h-3" /> },
                  ]}
                  activeId={predictionSubTab}
                  onSelect={(id: string) => setPredictionSubTab(id as any)}
                  compact
                />
              </div>

              {/* Sub-tab 1: Forecast Target */}
              {predictionSubTab === 'forecast' && prediction ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Forecast Card */}
                    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                        Next-Period Predicted Target (n+1)
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {asset.currency === 'KRW'
                            ? `₩${prediction.predictedPrice.toLocaleString()}`
                            : `HK$${prediction.predictedPrice.toFixed(2)}`}
                        </span>
                        <span
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            prediction.predictedChangePercent >= 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {prediction.predictedChangePercent >= 0 ? '+' : ''}
                          {prediction.predictedChangePercent}% ({prediction.direction})
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">
                        Target Session: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{prediction.targetDate}</span> · Model:{' '}
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{prediction.modelName}</span>
                      </div>
                    </div>

                    {/* Confidence & Out-of-Sample Accuracy */}
                    <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                        95% Prediction Interval (±1.96 × OOS RMSE)
                      </div>
                      <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                        Range: [{prediction.confidenceInterval.lower95} - {prediction.confidenceInterval.upper95}]
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-mono">
                        <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                          <div className="text-[10px] text-slate-400">Directional Accuracy</div>
                          <div className="font-bold text-emerald-500">{prediction.validationMetrics.directionalAccuracy}%</div>
                        </div>
                        <div className="p-2 rounded bg-slate-100 dark:bg-slate-800">
                          <div className="text-[10px] text-slate-400">Baseline Improvement</div>
                          <div
                            className={`font-bold ${
                              prediction.validationMetrics.baselineImprovementPercent >= 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}
                          >
                            {prediction.validationMetrics.baselineImprovementPercent >= 0 ? '+' : ''}
                            {prediction.validationMetrics.baselineImprovementPercent}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading prediction model details...
                </div>
              )}

              {/* Sub-tab 2: Feature Breakdown */}
              {predictionSubTab === 'features' && prediction ? (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
                    MODEL FEATURE CONTRIBUTION
                  </div>
                  <div className="text-[10px] text-slate-400 mb-4">
                    Standardized ridge coefficient share across the 7 feature families (not SHAP values).
                  </div>
                  <div className="space-y-3">
                    {prediction.featureImportance.map(feat => (
                      <div key={feat.feature} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{feat.feature}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-500">Value: {feat.value}</span>
                            <span className="text-emerald-500 font-semibold">{(feat.importance * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${feat.importance * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : predictionSubTab === 'features' ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading feature breakdown...
                </div>
              ) : null}

              {/* Sub-tab 3: Confidence Intervals */}
              {predictionSubTab === 'confidence' && prediction ? (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
                    PREDICTION CONFIDENCE METRICS
                  </div>
                  <div className="text-[10px] text-slate-400 mb-4">
                    Statistical measures derived from walk-forward out-of-sample evaluation.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Predicted Price</div>
                      <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        {asset.currency === 'KRW'
                          ? `₩${prediction.predictedPrice.toLocaleString()}`
                          : `HK$${prediction.predictedPrice.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Lower 95% CI</div>
                      <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        {asset.currency === 'KRW'
                          ? `₩${prediction.confidenceInterval.lower95.toLocaleString()}`
                          : `HK$${prediction.confidenceInterval.lower95.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Upper 95% CI</div>
                      <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                        {asset.currency === 'KRW'
                          ? `₩${prediction.confidenceInterval.upper95.toLocaleString()}`
                          : `HK$${prediction.confidenceInterval.upper95.toFixed(2)}`}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-400 uppercase">Directional Accuracy</div>
                      <div className="font-mono text-xl font-bold text-emerald-500 mt-1 tabular-nums">
                        {prediction.validationMetrics.directionalAccuracy}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                    <Info className="w-3 h-3 text-slate-400 mr-1.5" />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Confidence interval computed as ±1.96 × out-of-sample RMSE. All metrics derived from live walk-forward evaluation, not hardcoded.
                    </span>
                  </div>
                </div>
              ) : predictionSubTab === 'confidence' ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading confidence metrics...
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: Multi-Source Sentiment */}
          {activeTab === 'sentiment' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium">OVERALL SENTIMENT SCORE</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {asset.overallSentiment > 0 ? `+${asset.overallSentiment}` : asset.overallSentiment}
                  </div>
                  <div className="text-xs text-emerald-500 mt-1">{asset.sentimentDirection}</div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium">ENGAGEMENT-WEIGHTED</div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                    {asset.engagementWeightedSentiment > 0 ? `+${asset.engagementWeightedSentiment}` : asset.engagementWeightedSentiment}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Likes + Comments + Shares Log Weight</div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-xs text-slate-500 font-medium">EXPRESSED POSITION SIGNAL</div>
                  <div className="text-2xl font-bold font-mono text-emerald-500 mt-1">
                    {asset.positionSignal}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">From trader discussion phrasing</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Discussions & News */}
          {activeTab === 'sources' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Recent Social Media Discussions ({socialPosts.length})
                </h3>
                <div className="space-y-3">
                  {socialPosts.map(post => (
                    <div
                      key={post.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {post.platform}
                          </span>
                          <span>·</span>
                          <span>@{post.author}</span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{post.publishedAt.split('T')[0]}</span>
                        </div>
                        <span className="font-mono font-semibold text-emerald-500">
                          {post.sentimentScore > 0 ? `+${post.sentimentScore}` : post.sentimentScore} ({post.sentimentLabel})
                        </span>
                      </div>
                      <TranslatedText
                        original={post.text}
                        translation={post.textEn}
                        originalLang={post.originalLanguage}
                        className="text-slate-800 dark:text-slate-200"
                      />
                      {post.extractedPhrases.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                          <span>Key Phrases:</span>
                          {post.extractedPhrases.map((phrase, i) => (
                            <span key={i} className="font-medium text-emerald-600 dark:text-emerald-400">
                              "{phrase}"
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Financial News & Analyst Discoveries ({news.length})
                </h3>
                <div className="space-y-3">
                  {news.map(art => (
                    <div
                      key={art.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{art.publisher}</span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{art.publishedAt.split('T')[0]}</span>
                          <span>·</span>
                          <span className="font-mono text-emerald-600">Relevance: {(art.relevanceScore * 100).toFixed(0)}%</span>
                        </div>
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-400 hover:text-emerald-500"
                        >
                          <span>Article Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        <TranslatedText
                          original={art.title}
                          translation={art.titleEn}
                          originalLang="en"
                          className="font-semibold text-slate-900 dark:text-white"
                        />
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        <TranslatedText
                          original={art.summary}
                          translation={art.summaryEn}
                          originalLang="en"
                          className="text-slate-600 dark:text-slate-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
