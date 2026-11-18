import { FC } from 'react';

interface HeaderProps {
  activeTab: 'terminal' | 'backtest';
  onSelectTab: (tab: 'terminal' | 'backtest') => void;
}

export const Header: FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  return (
    <header className="sticky top-0 left-0 right-0 h-16 border-b border-slate-800/80 bg-[#0a0c10]/90 backdrop-blur-md z-40">
      <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('terminal');
          }}
          className="text-base font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
        >
          Alpha Terminal
        </a>

        <nav className="flex items-center gap-6" aria-label="Primary navigation">
          <button
            type="button"
            onClick={() => onSelectTab('terminal')}
            className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'terminal'
                ? 'text-slate-50 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Match Analysis
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('backtest')}
            className={`py-2 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'backtest'
                ? 'text-slate-50 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Historical Audit
          </button>
        </nav>
      </div>
    </header>
  );
};
