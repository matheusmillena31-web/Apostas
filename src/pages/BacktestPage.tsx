import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Select } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { runBacktest } from '../services/backtest';
import { Bot, BacktestResult, BotLog } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

type BacktestPageProps = {
  bots: Bot[];
  selectedBot?: Bot;
  onResult: (result: BacktestResult, logs: BotLog[]) => void;
};

export function BacktestPage({ bots, selectedBot, onResult }: BacktestPageProps) {
  const [botId, setBotId] = useState(selectedBot?.id ?? bots[0]?.id ?? '');
  const [result, setResult] = useState<BacktestResult | undefined>();
  const bot = useMemo(() => bots.find((item) => item.id === botId), [bots, botId]);

  const handleRun = () => {
    if (!bot) return;
    const output = runBacktest(bot);
    setResult(output.result);
    onResult(output.result, output.logs);
  };

  return (
    <>
      <PageHeader
        title="Backtest"
        description="Teste um método contra jogos históricos mockados e veja entradas simuladas, resultado, ROI e ligas."
        action={bot && <Button onClick={handleRun} icon={<Play className="h-4 w-4" />}>Rodar backtest</Button>}
      />
      {bots.length === 0 ? (
        <EmptyState title="Nenhum bot disponível" description="Crie um bot para executar o motor de backtest." />
      ) : (
        <div className="space-y-5">
          <Card title="Seleção">
            <div className="max-w-md">
              <Select value={botId} onChange={(event) => setBotId(event.target.value)}>
                {bots.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </div>
          </Card>

          {result && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Entradas" value={result.totalEntries} />
                <StatCard label="Greens" value={result.greens} tone="green" />
                <StatCard label="Reds" value={result.reds} tone="red" />
                <StatCard label="Lucro/prejuízo" value={formatCurrency(result.profit)} tone={result.profit >= 0 ? 'green' : 'red'} />
                <StatCard label="ROI" value={formatPercent(result.roi)} tone={result.roi >= 0 ? 'green' : 'red'} />
                <StatCard label="Odd média" value={formatNumber(result.averageOdd)} />
                <StatCard label="Minuto médio" value={`${formatNumber(result.averageMinute, 1)}'`} />
                <StatCard label="Melhor liga" value={result.bestLeague} tone="blue" />
              </div>

              <Card title="Entradas simuladas" subtitle={`Pior liga: ${result.worstLeague}`}>
                <div className="table-scroll">
                  <table className="min-w-[920px] w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-3 py-3">Jogo</th>
                        <th className="px-3 py-3">Liga</th>
                        <th className="px-3 py-3">Minuto</th>
                        <th className="px-3 py-3">Mercado</th>
                        <th className="px-3 py-3">Odd</th>
                        <th className="px-3 py-3">Resultado</th>
                        <th className="px-3 py-3">Lucro</th>
                        <th className="px-3 py-3">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {result.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-4 text-white">{entry.game}</td>
                          <td className="px-3 py-4 text-slate-300">{entry.league}</td>
                          <td className="px-3 py-4 text-slate-300">{entry.minute}'</td>
                          <td className="px-3 py-4 text-slate-300">{entry.market} {entry.side}</td>
                          <td className="px-3 py-4 text-slate-300">{entry.odd.toFixed(2)}</td>
                          <td className={`px-3 py-4 font-semibold ${entry.result === 'green' ? 'text-emerald-300' : 'text-red-300'}`}>{entry.result}</td>
                          <td className={`px-3 py-4 font-semibold ${entry.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(entry.profit)}</td>
                          <td className="px-3 py-4 text-slate-400">{entry.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}
