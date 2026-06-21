import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { BacktestResult } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

type IndicatorsProps = {
  results: BacktestResult[];
};

export function Indicators({ results }: IndicatorsProps) {
  const entries = results.flatMap((result) => result.entries);
  const greens = entries.filter((entry) => entry.result === 'green').length;
  const reds = entries.length - greens;
  const profit = entries.reduce((sum, entry) => sum + entry.profit, 0);
  const totalStake = entries.reduce((sum, entry) => sum + entry.stake, 0);
  const roi = totalStake ? (profit / totalStake) * 100 : 0;
  const averageOdd = entries.length ? entries.reduce((sum, entry) => sum + entry.odd, 0) / entries.length : 0;
  const accuracy = entries.length ? (greens / entries.length) * 100 : 0;
  const drawdown = entries.reduce(
    (state, entry) => {
      const equity = state.equity + entry.profit;
      const peak = Math.max(state.peak, equity);
      return { equity, peak, drawdown: Math.min(state.drawdown, equity - peak) };
    },
    { equity: 0, peak: 0, drawdown: 0 },
  ).drawdown;

  return (
    <>
      <PageHeader title="Indicadores" description="Leitura quantitativa do desempenho simulado dos métodos." />
      {entries.length === 0 ? (
        <EmptyState title="Indicadores aguardando backtest" description="Execute um backtest para calcular assertividade, drawdown e ROI." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Assertividade" value={formatPercent(accuracy)} tone="green" />
          <StatCard label="ROI" value={formatPercent(roi)} tone={roi >= 0 ? 'green' : 'red'} />
          <StatCard label="Odd média" value={formatNumber(averageOdd)} />
          <StatCard label="Taxa de green" value={formatPercent(accuracy)} tone="green" />
          <StatCard label="Taxa de red" value={formatPercent(entries.length ? (reds / entries.length) * 100 : 0)} tone="red" />
          <StatCard label="Drawdown" value={formatCurrency(drawdown)} tone="red" />
          <StatCard label="Lucro por stake" value={formatPercent(totalStake ? (profit / totalStake) * 100 : 0)} />
          <StatCard label="Quantidade de entradas" value={entries.length} tone="blue" />
        </div>
      )}
      <Card className="mt-5" title="Leitura rápida">
        <p className="text-sm text-slate-400">
          Todos os indicadores usam apenas entradas simuladas salvas no navegador. Nenhuma aposta real é executada.
        </p>
      </Card>
    </>
  );
}
