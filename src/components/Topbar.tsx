import { Menu } from 'lucide-react';
import type { PageKey } from '../App';

type TopbarProps = {
  title: string;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

const mobileItems: Array<{ key: PageKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bots', label: 'Bots' },
  { key: 'backtest', label: 'Backtest' },
  { key: 'reports', label: 'Relatórios' },
  { key: 'settings', label: 'Configurações' },
];

export function Topbar({ title, activePage, onNavigate }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-ink-950/86 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Menu className="h-5 w-5 text-electric-500" />
          <span className="font-semibold text-white">{title}</span>
        </div>
        <select
          value={activePage}
          onChange={(event) => onNavigate(event.target.value as PageKey)}
          className="max-w-44 rounded-md border border-white/10 bg-ink-900 px-3 py-2 text-sm text-white"
        >
          {mobileItems.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
