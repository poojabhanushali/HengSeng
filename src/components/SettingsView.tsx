import React, { useState, useEffect } from 'react';
import { SystemSettings, LanguageCode, LanguagePrefs } from '../types';
import { Settings, Save, CheckCircle2, Key, Sliders, Shield, Database, Globe2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LANGUAGE_OPTIONS: { id: LanguageCode; label: string; desc: string }[] = [
  {
    id: 'en',
    label: 'English',
    desc: 'Show English translations underneath non-English content',
  },
  {
    id: 'zh-HK',
    label: 'Traditional Chinese',
    desc: 'Show Hong Kong / Traditional Chinese content',
  },
  {
    id: 'ko',
    label: 'Korean',
    desc: 'Show South Korean / Korean content',
  },
];

export const SettingsView: React.FC = () => {
  const { prefs, setPrefs } = useLanguage();
  const [settings, setSettings] = useState<SystemSettings>({
    apifyApiToken: '',
    apifyLihkgActorId: 'apify/lihkg-scraper',
    apifyTelegramActorId: 'apify/telegram-scraper',
    apifyNaverActorId: 'apify/naver-finance-scraper',
    apifyDaumActorId: 'apify/daum-forum-scraper',
    exaApiKey: '',
    marketDataProvider: 'Local Deterministic OHLCV (Curated Fallback)',
    marketDataApiKey: '',
    bullishThreshold: 20,
    bearishThreshold: -20,
    predictionHorizonDays: 1,
    dataRetentionDays: 10,
    enableAutomatedOrchestration: true,
    orchestrationIntervalHours: 4,
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/v1/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            System Configuration & API Credentials
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure Exa search credentials and model threshold parameters. Apify fields are stored for a future connector but do not enable live scraping in this build.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: External API Credentials */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Key className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              External API Authentication Tokens
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Apify API Token (APIFY_API_TOKEN)
              </label>
              <input
                type="text"
                value={settings.apifyApiToken}
                onChange={e => setSettings({ ...settings, apifyApiToken: e.target.value })}
                placeholder="apify_api_••••••••••••••••"
                className="w-full font-mono py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Stored for future use only — the Apify actor runner is not wired in this build.
              </span>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Exa API Key (EXA_API_KEY)
              </label>
              <input
                type="text"
                value={settings.exaApiKey}
                onChange={e => setSettings({ ...settings, exaApiKey: e.target.value })}
                placeholder="exa_••••••••••••••••"
                className="w-full font-mono py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Obtain from dashboard.exa.ai/api-keys
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Apify Actor Registry */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Database className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Apify Actor Scraper IDs (HKEX & KRX) — Not Wired
            </h2>
          </div>

          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            The Apify actor runner is not implemented in this build. Social data is served from the curated local dataset.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-sans font-medium mb-1">
                HKEX LIHKG Actor ID
              </label>
              <input
                type="text"
                value={settings.apifyLihkgActorId}
                onChange={e => setSettings({ ...settings, apifyLihkgActorId: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-sans font-medium mb-1">
                HKEX Telegram Finance Actor ID
              </label>
              <input
                type="text"
                value={settings.apifyTelegramActorId}
                onChange={e => setSettings({ ...settings, apifyTelegramActorId: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-sans font-medium mb-1">
                KRX Naver Finance Discussion Actor ID
              </label>
              <input
                type="text"
                value={settings.apifyNaverActorId}
                onChange={e => setSettings({ ...settings, apifyNaverActorId: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-sans font-medium mb-1">
                KRX Daum Finance Forum Actor ID
              </label>
              <input
                type="text"
                value={settings.apifyDaumActorId}
                onChange={e => setSettings({ ...settings, apifyDaumActorId: e.target.value })}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Sentiment & Quantitative Parameters */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Sliders className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Sentiment Classification Thresholds & Horizon
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Bullish Boundary Threshold ({settings.bullishThreshold})
              </label>
              <input
                type="range"
                min="10"
                max="50"
                value={settings.bullishThreshold}
                onChange={e => setSettings({ ...settings, bullishThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scores above this qualify as Bullish</span>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Bearish Boundary Threshold ({settings.bearishThreshold})
              </label>
              <input
                type="range"
                min="-50"
                max="-10"
                value={settings.bearishThreshold}
                onChange={e => setSettings({ ...settings, bearishThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-red-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Scores below this qualify as Bearish</span>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                Forecast Horizon
              </label>
              <select
                value={settings.predictionHorizonDays}
                onChange={e => setSettings({ ...settings, predictionHorizonDays: parseInt(e.target.value, 10) })}
                className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value={1}>Next Trading Session (n+1)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Only the n+1 horizon is implemented; 3- and 5-session targets are not available.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Language & Translation Preferences */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Globe2 className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Language & Translation Preferences
            </h2>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Choose which languages to display. English translations appear directly underneath
            non-English social posts and news. Changes apply to all content instantly.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LANGUAGE_OPTIONS.map(lang => (
              <div
                key={lang.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50"
              >
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prefs[lang.id]}
                    onChange={() =>
                      setPrefs({ [lang.id]: !prefs[lang.id] } as Partial<LanguagePrefs>)
                    }
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-white dark:bg-slate-900"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {lang.label}
                  </span>
                </label>
                <span className="block mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {lang.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving System Configuration...' : 'Save Configuration & Apply'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
