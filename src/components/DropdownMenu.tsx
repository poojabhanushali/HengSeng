import React, { useState, useEffect, ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  destructive?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  trigger: ReactNode;
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  items,
  trigger,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (open) {
        const target = e.target as Node;
        const container = document.getElementById('dropdown-menu-container');
        if (container && !container.contains(target)) {
          setOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="More actions"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div
          id="dropdown-menu-container"
          className={`absolute z-50 mt-2 w-56 origin-${
            align === 'right' ? 'right' : 'left'
          } bg-white dark:bg-[#0c1017] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1`}
          style={{
            left: align === 'right' ? 'auto' : 0,
            right: align === 'right' ? 0 : 'auto',
          }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.disabled) {
                  item.onClick();
                  setOpen(false);
                }
              }}
              disabled={item.disabled}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition-colors text-left ${
                item.disabled
                  ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : item.destructive
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.icon && (
                <span className="w-4 h-4 shrink-0 text-slate-400">{item.icon}</span>
              )}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface SubNavTabProps {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface NestedTabsProps {
  tabs: SubNavTabProps[];
  activeId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}

export const NestedTabs: React.FC<NestedTabsProps> = ({
  tabs,
  activeId,
  onSelect,
  compact = false,
}) => {
  return (
    <div
      className={`flex gap-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto scrollbar-hide`}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              isActive
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-900/50'
            }`}
          >
            {tab.icon && <span className="w-3 h-3 shrink-0">{tab.icon}</span>}
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
