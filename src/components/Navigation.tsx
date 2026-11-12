import React, { useState } from 'react';
import {
  LayoutDashboard,
  Globe2,
  TableProperties,
  MessageSquareQuote,
  Newspaper,
  TrendingUp,
  Cpu,
  History,
  FileSpreadsheet,
  Layers,
  Workflow,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Menu,
  X,
} from 'lucide-react';
import { ExchangeCode } from '../types';

export type ActiveTab =
  | 'overview'
  | 'exchange'
  | 'assets'
  | 'social'
  | 'news'
  | 'predictions'
  | 'performance'
  | 'backtesting'
  | 'reports'
  | 'sources'
  | 'pipeline'
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedExchange: ExchangeCode | 'ALL';
  setSelectedExchange: (ex: ExchangeCode | 'ALL') => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  isPipelineRunning: boolean;
  onTriggerPipeline: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  selectedExchange,
  setSelectedExchange,
  isDark,
  setIsDark,
  isPipelineRunning,
  onTriggerPipeline,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'exchange', label: 'Exchange Intel', icon: Globe2 },
    { id: 'assets', label: 'Asset Rankings', icon: TableProperties },
    { id: 'social', label: 'Social Sentiment', icon: MessageSquareQuote },
    { id: 'news', label: 'News Intelligence', icon: Newspaper },
    { id: 'predictions', label: 'Price Predictions', icon: TrendingUp },
    { id: 'performance', label: 'Model Validation', icon: Cpu },
    { id: 'backtesting', label: 'Backtesting Lab', icon: History },
    { id: 'reports', label: 'Executive Reports', icon: FileSpreadsheet },
    { id: 'sources', label: 'Data Registry', icon: Layers },
    { id: 'pipeline', label: 'Pipeline Monitor', icon: Workflow },
    { id: 'settings', label: 'Settings & Keys', icon: SettingsIcon },
  ];

  const handleNavClick = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Top Bar - Strict 3-zone contract, responsive on mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-8 px-2.5 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md">
        {/* Zone 1: Wordmark & Mobile Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation drawer"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm shrink-0">
            HS
          </div>
          <span className="hidden min-[360px]:inline text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            HengSeng Agent
          </span>
        </div>

        {/* Zone 2: Navigation Links / Segmented Exchange Filter */}
        <div className="hidden lg:flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setSelectedExchange('ALL')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              selectedExchange === 'ALL'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Exchanges (10)
          </button>
          <button
            onClick={() => setSelectedExchange('HKEX')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              selectedExchange === 'HKEX'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            HKEX (Hong Kong)
          </button>
          <button
            onClick={() => setSelectedExchange('KRX')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              selectedExchange === 'KRX'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            KRX (South Korea)
          </button>
        </div>

        {/* Zone 3: Primary Action & Theme Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={onTriggerPipeline}
            disabled={isPipelineRunning}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg text-white transition-all whitespace-nowrap ${
              isPipelineRunning
                ? 'bg-emerald-700 opacity-80 cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-sm active:scale-95'
            }`}
          >
            {isPipelineRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Running Agents 1–8...</span>
                <span className="sm:hidden">Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Run Ingestion Pipeline</span>
                <span className="hidden min-[380px]:inline sm:hidden">Run Pipeline</span>
                <span className="min-[380px]:hidden">Run</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle color theme"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          {/* Drawer Content */}
          <aside className="relative w-72 max-w-[80vw] bg-white dark:bg-[#0c1017] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 z-10 shadow-2xl h-full overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  NAVIGATION TERMINAL
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation drawer"
                  className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Exchange Quick Filter */}
              <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 px-1">FILTER EXCHANGE</div>
                <div className="grid grid-cols-3 gap-1">
                  {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
                    <button
                      key={ex}
                      onClick={() => setSelectedExchange(ex)}
                      className={`py-1 text-[11px] font-medium rounded transition-colors text-center ${
                        selectedExchange === ex
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        isActive
                          ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1">DATA WINDOW</div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                  <span>10-Day UTC</span>
                  <span>n+1 Forecast</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

