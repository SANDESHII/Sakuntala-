import { FC } from 'react';

export type AppTab = 'terminal' | 'ratings' | 'backtest' | 'methodology';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'terminal', label: 'Match Analysis' },
  { id: 'ratings', label: 'League Ratings' },
  { id: 'backtest', label: 'Historical Audit' },
  { id: 'methodology', label: 'Methodology' },
];

export const Header: FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onPrimaryAction,
  primaryActionLabel,
}) => {
  return (
    <header className="sticky top-0 left-0 right-0 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0a0c10]/95 backdrop-blur-md z-40">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('terminal');
          }}
          className="text-base font-bold tracking-tight text-slate-950 dark:text-slate-50 whitespace-nowrap shrink-0"
        >
          Alpha Terminal
        </a>

        <nav
          className="hidden md:flex items-center gap-6 overflow-x-auto"
          aria-label="Primary navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  isActive
                    ? 'text-slate-950 dark:text-slate-50 border-emerald-500'
                    : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-950 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        className="flex md:hidden items-center gap-4 px-4 pb-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800/60"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                isActive
                  ? 'text-slate-950 dark:text-slate-50 border-emerald-500'
                  : 'text-slate-600 dark:text-slate-400 border-transparent'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
