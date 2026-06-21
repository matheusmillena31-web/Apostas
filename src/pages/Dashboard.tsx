import { Bot, BacktestResult } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { Activity, Bot as BotIcon, CheckCircle2, CircleDollarSign, TrendingDown, TrendingUp, XCircle } from 'lucide-react';

type DashboardProps = {
  bots: Bot[];
  results: BacktestResult[];
  onCreateBot: () => void;
};

export function Dashboard({ bots, results, onCreateBot }: DashboardProps) {
  const entries = results.flatMap((result) => result.entries);
  const profit = entries.reduce((sum, entry) => sum + entry.profit, 0);
  const totalStake = entries.reduce((sum, entry) => sum + entry.stake, 0);
  const roi = totalStake ? (profit / totalStake) * 100 : 0;
  const greens = entries.filter((entry) => entry.result === 'green').length;
  const reds = entries.length - greens;
  const best = [...results].sort((a, b) => b.roi - a.roi)[0];
  const worst = [...results].sort((a, b) => a.roi - b.roi)[0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão consolidada dos seus métodos simulados, sem dinheiro real e com dados locais."
        action={<Button onClick={onCreateBot}>Criar bot</Button>}
      />

      {bots.length === 0 ? (
        <EmptyState
          title="Nenhum bot criado ainda"
          description="Crie seu primeiro método para começar a simular entradas, replay de jogos e backtests com dados mockados."
          action={<Button onClick={onCreateBot}>Criar bot</Button>}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Bots criados" value={bots.length} icon={<BotIcon className="h-5 w-5" />} tone="blue" />
            <StatCard label="Bots ativos" value={bots.filter((bot) => bot.isActive).length} icon={<Activity className="h-5 w-5" />} />
            <StatCard
              label="Lucro/prejuízo simulado"
              value={formatCurrency(profit)}
              icon={<CircleDollarSign className="h-5 w-5" />}
              tone={profit >= 0 ? 'green' : 'red'}
            />
            <StatCard
              label="ROI"
              value={formatPercent(roi)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone={roi >= 0 ? 'green' : 'red'}
            />
            <StatCard label="Entradas" value={entries.length} icon={<Activity className="h-5 w-5" />} />
            <StatCard label="Greens" value={greens} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
            <StatCard label="Reds" value={reds} icon={<XCircle className="h-5 w-5" />} tone="red" />
            <StatCard
              label="Melhor método"
              value={best?.botName ?? '-'}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="green"
            />
          </div>

          <Card title="Resumo dos métodos" subtitle="Melhor e pior desempenho considerando o último backtest salvo por bot.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-emerald-500/8 p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-semibold">Melhor método</span>
                </div>
                <p className="mt-3 text-lg font-semibold text-white">{best?.botName ?? 'Sem backtest'}</p>
                <p className="text-sm text-slate-400">{best ? `${formatPercent(best.roi)} | ${formatCurrency(best.profit)}` : 'Rode um backtest para popular os dados.'}</p>
              </div>
              <div className="rounded-lg bg-red-500/8 p-4">
                <div className="flex items-center gap-2 text-red-300">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-semibold">Pior método</span>
                </div>
                <p className="mt-3 text-lg font-semibold text-white">{worst?.botName ?? 'Sem backtest'}</p>
                <p className="text-sm text-slate-400">{worst ? `${formatPercent(worst.roi)} | ${formatCurrency(worst.profit)}` : 'O comparativo aparece após os testes.'}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
