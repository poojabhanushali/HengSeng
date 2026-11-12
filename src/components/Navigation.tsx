import React, { useState } from 'react';
import {
  LayoutDashboard,
  Globe2,
  TableProperties,
  TrendingUp,
  Cpu,
  MessageSquareQuote,
  Newspaper,
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
  ChevronRight,
  MoreHorizontal,
  ChevronLeft,
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
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const GROUPED_NAV: { group: string; items: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    group: 'Dashboard',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'exchange', label: 'Exchange Intel', icon: Globe2 },
    ],
  },
  {
    group: 'Analysis',
    items: [
      { id: 'assets', label: 'Asset Rankings', icon: TableProperties },
      { id: 'social', label: 'Social Sentiment', icon: MessageSquareQuote },
      { id: 'news', label: 'News Intelligence', icon: Newspaper },
    ],
  },
  {
    group: 'ML & Predictions',
    items: [
      { id: 'predictions', label: 'Price Predictions', icon: TrendingUp },
      { id: 'performance', label: 'Model Validation', icon: Cpu },
      { id: 'backtesting', label: 'Backtesting Lab', icon: History },
    ],
  },
  {
    group: 'Tools',
    items: [
      { id: 'reports', label: 'Executive Reports', icon: FileSpreadsheet },
      { id: 'sources', label: 'Data Registry', icon: Layers },
      { id: 'pipeline', label: 'Pipeline Monitor', icon: Workflow },
    ],
  },
  {
    group: 'System',
    items: [{ id: 'settings', label: 'Settings & Keys', icon: SettingsIcon }],
  },
];

const PRIMARY_TABS: ActiveTab[] = ['overview', 'exchange', 'assets', 'predictions'];
const SECONDARY_TABS: ActiveTab[] = [
  'social',
  'news',
  'performance',
  'backtesting',
  'reports',
  'sources',
  'pipeline',
  'settings',
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  selectedExchange,
  setSelectedExchange,
  isDark,
  setIsDark,
  isPipelineRunning,
  onTriggerPipeline,
  sidebarCollapsed,
  setSidebarCollapsed,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const handleNavClick = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setOverflowOpen(false);
  };

  const isPrimary = (id: ActiveTab) => PRIMARY_TABS.includes(id);

  return (
    <>
      {/* Top Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-6 px-2.5 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b0f17]/95 backdrop-blur-md">
        {/* Zone 1: Wordmark, Sidebar Toggle & Mobile Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation drawer"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Collapse sidebar"
            className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm shrink-0">
            HS
          </div>
          <span className={`hidden min-[360px]:inline text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            HengSeng Agent
          </span>
        </div>

        {/* Zone 2: Exchange Filter */}
        <div className="hidden lg:flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800 shrink-0">
          {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
            <button
              key={ex}
              onClick={() => setSelectedExchange(ex)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedExchange === ex
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {ex === 'ALL' ? 'All (10)' : ex === 'HKEX' ? 'HKEX' : 'KRX'}
            </button>
          ))}
        </div>

        {/* Zone 3: Primary Actions & Theme */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={onTriggerPipeline}
            disabled={isPipelineRunning}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all whitespace-nowrap ${
              isPipelineRunning
                ? 'bg-emerald-700 opacity-80 cursor-wait'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-sm active:scale-95'
            }`}
          >
            {isPipelineRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Running Agents...</span>
                <span className="sm:hidden">Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Run Pipeline</span>
                <span className="min-[380px]:hidden">Run</span>
              </>
            )}
          </button>

          {/* Overflow Menu for Secondary Actions (Desktop) */}
          <div className="relative hidden sm:flex items-center">
            <button
              onClick={() => setOverflowOpen(!overflowOpen)}
              aria-label="More actions"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {overflowOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1 z-50">
                {SECONDARY_TABS.map(id => {
                  const group = GROUPED_NAV.find(g => g.items.some(i => i.id === id))?.group || '';
                  const item = GROUPED_NAV.find(g => g.items.some(i => i.id === id))?.items.find(i => i.id === id);
                  if (!item) return null;
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => handleNavClick(id)}
                      className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left w-full ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                      <span className="ml-auto text-[10px] text-slate-400 font-mono">{group}</span>
                    </button>
                  );
                })}
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  onClick={() => setIsDark(!isDark)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-left w-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>Toggle Theme</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle (Mobile only, also shown in drawer on mobile) */}
          <button
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle color theme"
            className="sm:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0c1017] border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">Navigation</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Exchange Quick Filter */}
            <div className="p-3 bg-slate-50 dark:bg-[#0f172a] border-b border-slate-200/50 dark:border-slate-800/50">
              <div className="text-[10px] font-semibold text-slate-400 px-2 mb-2 uppercase tracking-wider">Exchange Filter</div>
              <div className="grid grid-cols-3 gap-1">
                {(['ALL', 'HKEX', 'KRX'] as const).map(ex => (
                  <button
                    key={ex}
                    onClick={() => { setSelectedExchange(ex); setMobileMenuOpen(false); }}
                    className={`py-1.5 text-[11px] font-medium rounded-md transition-colors text-center ${
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

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {GROUPED_NAV.map(group => (
                <div key={group.group} className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {group.group}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-left ${
                            isActive
                              ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => { setIsDark(!isDark); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>Toggle Theme</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
