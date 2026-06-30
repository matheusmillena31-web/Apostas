import {
  Activity,
  BarChart3,
  Bot,
  Home,
  LineChart,
  PlayCircle,
  Radio,
  Trophy,
} from 'lucide-react';
import type { PageKey } from '../App';

type SidebarProps = {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
};

const items: Array<{ key: PageKey; label: string; icon: React.ElementType }> = [
  { key: 'dashboard', label: 'Dashboard', icon: Home },
  { key: 'bots', label: 'Bots', icon: Bot },
  { key: 'liveGames', label: 'Jogos ao vivo', icon: Radio },
  { key: 'backtest', label: 'Backtest', icon: BarChart3 },
  { key: 'replay', label: 'Replay de jogos', icon: PlayCircle },
  { key: 'reports', label: 'Relatorios', icon: LineChart },
  { key: 'ranking', label: 'Ranking de metodos', icon: Trophy },
  { key: 'status', label: 'Status do Sistema', icon: Activity },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/8 bg-ink-950/96 p-4 lg:block">
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric-600 text-lg font-black text-white">
          T
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-electric-500">TradeLab</p>
          <h1 className="text-lg font-semibold text-white">Sports Sim</h1>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition ${
                active
                  ? 'bg-electric-600 text-white shadow-glow'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
