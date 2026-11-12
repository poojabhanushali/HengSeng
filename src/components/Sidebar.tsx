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
  ChevronRight,
} from 'lucide-react';
import { ActiveTab } from './Navigation';

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

const NavItem: React.FC<{ item: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }; isActive: boolean; onSelect: (id: ActiveTab) => void }> = ({ item, isActive, onSelect }) => {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
      <span className="truncate">{item.label}</span>
    </button>
  );
};

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed }) => {
  const sidebarWidth = collapsed ? 16 : 256;

  return (
    <aside
      className={`hidden lg:flex shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0c1017] flex-col select-none transition-all duration-300 ease-in-out overflow-hidden`}
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
    >
      {collapsed && (
        <div className="flex items-center justify-center h-12 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f172a]/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      )}

      {!collapsed && (
        <>
          <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0f172a]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-sm">
                HS
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
                HengSeng Agent
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {GROUPED_NAV.map(group => (
              <div key={group.group} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <NavItem
                      key={item.id}
                      item={item}
                      isActive={activeTab === item.id}
                      onSelect={setActiveTab}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="text-slate-500 dark:text-slate-400 text-[11px] mb-1 uppercase tracking-wider">Data Window</div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                <span>10-Day UTC</span>
                <span>n+1 Forecast</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
