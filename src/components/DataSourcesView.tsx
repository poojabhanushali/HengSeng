import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface SourceStatus {
  id: string;
  name: string;
  mode: 'live' | 'local-fallback';
  modeLabel: string;
  credentialConfigured: boolean;
  liveIntegrationAvailable: boolean;
  detail: string;
  lastUpdated: string | null;
  ageMinutes: number | null;
  recordCount: number;
  platforms?: string[];
  publishers?: string[];
  provider?: string;
  tickersCovered?: number;
  liveRecordCount?: number;
  lastLiveSearchAt?: string | null;
}

const formatAge = (minutes: number | null): string => {
  if (minutes === null || Number.isNaN(minutes)) return 'unknown';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const formatTimestamp = (iso: string | null): string => (iso ? `${iso.split('T')[0]} ${iso.split('T')[1]?.slice(0, 8)} UTC` : '—');

export const DataSourcesView: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch('/api/v1/settings'),
          fetch('/api/v1/sources/status'),
        ]);
        if (settingsRes.ok) setSettings(await settingsRes.json());
        if (statusRes.ok) {
          setStatus(await statusRes.json());
        } else {
          setLoadError(`Source status endpoint returned HTTP ${statusRes.status}`);
        }
      } catch (err: any) {
        setLoadError(err?.message || 'Failed to load source status');
        console.error('Failed to load source status:', err);
      }
    }
    load();
  }, []);

  const sources: SourceStatus[] = status?.sources || [];
  const apify = sources.find(s => s.id === 'apify_social');
  const exa = sources.find(s => s.id === 'exa_news');
  const market = sources.find(s => s.id === 'market_data');

  const Badge: React.FC<{ live: boolean; label: string }> = ({ live, label }) => (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
        live
          ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
          : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
      }`}
    >
      {live ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {label}
    </span>
  );

  const MetaRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-700 dark:text-slate-300 text-right truncate">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Data Sources & Integration Registry
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Verified connector status. LIVE means records were served by the external API; LOCAL FALLBACK means the curated
            in-repo dataset is being served instead.
          </p>
        </div>
        {status && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Status generated {formatTimestamp(status.generatedAt)}</span>
          </div>
        )}
      </div>

      {loadError && (
        <div className="p-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
          Failed to load source status: {loadError}
        </div>
      )}

      {/* Integration Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Apify */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 font-bold flex items-center justify-center text-xs">
                AP
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Apify Integration</span>
            </div>
            <Badge live={apify?.mode === 'live'} label={apify ? apify.modeLabel.toUpperCase() : 'LOADING…'} />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {apify?.detail || 'Loading connector status…'}
          </p>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
            <MetaRow label="Auth Token" value={settings?.apifyApiToken ? 'Configured (masked)' : 'Not configured'} />
            <MetaRow label="Records Served" value={apify ? `${apify.recordCount} posts · ${apify.platforms?.length ?? 0} platforms` : '—'} />
            <MetaRow label="Platforms" value={apify?.platforms?.join(' · ') || '—'} />
            <MetaRow label="Last Updated" value={formatTimestamp(apify?.lastUpdated ?? null)} />
            <MetaRow label="Freshness" value={formatAge(apify?.ageMinutes ?? null)} />
          </div>
        </div>

        {/* Card 2: Exa API */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 font-bold flex items-center justify-center text-xs">
                EX
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Exa News Discovery</span>
            </div>
            <Badge live={exa?.mode === 'live'} label={exa ? exa.modeLabel.toUpperCase() : 'LOADING…'} />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {exa?.detail || 'Loading connector status…'}
          </p>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
            <MetaRow label="API Key" value={exa?.credentialConfigured ? 'Configured (masked)' : 'Not configured'} />
            <MetaRow label="Live Articles" value={exa ? `${exa.liveRecordCount ?? 0} live / ${exa.recordCount} total` : '—'} />
            <MetaRow label="Last Live Call" value={formatTimestamp(exa?.lastLiveSearchAt ?? null)} />
            <MetaRow label="Publishers" value={exa?.publishers?.slice(0, 3).join(', ') || '—'} />
            <MetaRow label="Freshness" value={formatAge(exa?.ageMinutes ?? null)} />
          </div>
        </div>

        {/* Card 3: Market Data Engine */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold flex items-center justify-center text-xs">
                MD
              </div>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Market Data Feed</span>
            </div>
            <Badge live={market?.mode === 'live'} label={market ? market.modeLabel.toUpperCase() : 'LOADING…'} />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {market?.detail || 'Loading connector status…'}
          </p>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-mono">
            <MetaRow label="Provider" value={market?.provider || settings?.marketDataProvider || '—'} />
            <MetaRow label="Supported Tickers" value={market ? `${market.tickersCovered ?? 0} of 10 covered` : '—'} />
            <MetaRow label="Price Bars" value={market ? `${market.recordCount} bars` : '—'} />
            <MetaRow label="Last Updated" value={formatTimestamp(market?.lastUpdated ?? null)} />
            <MetaRow label="Freshness" value={formatAge(market?.ageMinutes ?? null)} />
          </div>
        </div>
      </div>

      {/* Integrity & performance strip */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 text-xs font-mono">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Data Freshness
            </div>
            <MetaRow label="Social posts" value={formatAge(status.dataFreshness?.socialAgeMinutes ?? null)} />
            <MetaRow label="News articles" value={formatAge(status.dataFreshness?.newsAgeMinutes ?? null)} />
            <MetaRow label="Price bars" value={formatAge(status.dataFreshness?.priceAgeMinutes ?? null)} />
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-2 text-xs font-mono">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
              Model Performance (Walk-Forward OOS)
            </div>
            <MetaRow label="Directional accuracy" value={`${status.modelPerformance?.directionalAccuracyPercent ?? '—'}%`} />
            <MetaRow label="Normalized error (MAPE)" value={`${status.modelPerformance?.mapePercent ?? '—'}%`} />
            <MetaRow label="HKEX MAE" value={`HK$${status.modelPerformance?.hkexAverageMaeHKD ?? '—'}`} />
            <MetaRow label="KRX MAE" value={`₩${status.modelPerformance?.krxAverageMaeKRW ?? '—'}`} />
            <MetaRow label="OOS observations" value={`${status.modelPerformance?.totalOutOfSampleObservations ?? '—'} (${status.modelPerformance?.foldsPerAsset ?? '—'} folds × 10 assets)`} />
          </div>
        </div>
      )}
    </div>
  );
};
