import React from 'react';
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
} from 'lucide-react';
import { ActiveTab } from './Navigation';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
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

  return (
    <aside className="hidden lg:flex w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] flex-col justify-between p-4 min-h-[calc(100vh-53px)] select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 tracking-wider">
          INTELLIGENCE TERMINAL
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                isActive
                  ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer info box */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs">
          <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1">DATA WINDOW</div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono text-[11px]">
            <span>Latest Window</span>
            <span>10 Days (UTC)</span>
          </div>
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono text-[11px] mt-1">
            <span>Forecast Horizon</span>
            <span>Next (n+1)</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
