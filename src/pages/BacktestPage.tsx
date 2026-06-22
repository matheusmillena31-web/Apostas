import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, HelpCircle, Play, Recycle, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { runBacktest } from '../services/backtest';
import { BacktestResult, Bot, BotLog, TradeEntry } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

type BacktestPageProps = {
  bots: Bot[];
  selectedBot?: Bot;
  initialResult?: BacktestResult;
  onResult: (result: BacktestResult, logs: BotLog[]) => void;
};

type BankrollPoint = {
  date: string;
  banca: number;
  lucro: number;
};

type RunStats = {
  count: number;
  profit: number;
  stake: number;
  startIndex: number;
  endIndex: number;
};

const chartTooltipStyle = {
  background: '#101620',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
};

const formatShortDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date);

const formatRunDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
    .format(date)
    .replace(/\//g, '-');

const getSimulatedDate = (entriesCount: number, index: number) => {
  const date = new Date();
  date.setDate(date.getDate() - entriesCount + index);
  return date;
};

const buildBankrollData = (entries: TradeEntry[]): BankrollPoint[] => {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - entries.length);

  let currentBankroll = 0;
  const initialDate = new Date(baseDate);

  const data: BankrollPoint[] = [
    {
      date: formatShortDate(initialDate),
      banca: Number(currentBankroll.toFixed(2)),
      lucro: 0,
    },
  ];

  entries.forEach((entry, index) => {
    const pointDate = new Date(baseDate);
    pointDate.setDate(baseDate.getDate() + index + 1);
    currentBankroll += entry.profit;
    data.push({
      date: formatShortDate(pointDate),
      banca: Number(currentBankroll.toFixed(2)),
      lucro: Number(entry.profit.toFixed(2)),
    });
  });

  return data;
};

const runRoi = (run: RunStats) => (run.stake > 0 ? (run.profit / run.stake) * 100 : 0);

const emptyRun = (): RunStats => ({
  count: 0,
  profit: 0,
  stake: 0,
  startIndex: -1,
  endIndex: -1,
});

const getRunRange = (run: RunStats, totalEntries: number) => {
  if (run.startIndex < 0 || run.endIndex < 0) return '-';
  return `${formatRunDate(getSimulatedDate(totalEntries, run.startIndex + 1))}/${formatRunDate(getSimulatedDate(totalEntries, run.endIndex + 1))}`;
};

const normalCdf = (value: number) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = sign * (1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)));
  return 0.5 * (1 + erf);
};

const buildAdvancedStats = (entries: TradeEntry[]) => {
  const total = entries.length;
  const greens = entries.filter((entry) => entry.result === 'green');
  const reds = entries.filter((entry) => entry.result === 'red');
  const totalStake = entries.reduce((sum, entry) => sum + entry.stake, 0);
  const months = Math.max(1, Math.ceil(Math.max(1, total) / 30));
  const days = Math.max(1, total);
  const accuracy = total > 0 ? (greens.length / total) * 100 : 0;
  const averageOdd = total > 0 ? entries.reduce((sum, entry) => sum + entry.odd, 0) / total : 0;
  const averageGreenOdd = greens.length > 0 ? greens.reduce((sum, entry) => sum + entry.odd, 0) / greens.length : 0;

  let currentRun = emptyRun();
  let currentType: TradeEntry['result'] | undefined;
  let bestGoodRun = emptyRun();
  let worstBadRun = emptyRun();
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  entries.forEach((entry, index) => {
    cumulative += entry.profit;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);

    if (entry.result !== currentType) {
      currentType = entry.result;
      currentRun = {
        count: 0,
        profit: 0,
        stake: 0,
        startIndex: index,
        endIndex: index,
      };
    }

    currentRun = {
      ...currentRun,
      count: currentRun.count + 1,
      profit: currentRun.profit + entry.profit,
      stake: currentRun.stake + entry.stake,
      endIndex: index,
    };

    if (entry.result === 'green') {
      const currentRoi = runRoi(currentRun);
      const bestRoi = runRoi(bestGoodRun);
      if (currentRun.count > bestGoodRun.count || (currentRun.count === bestGoodRun.count && currentRoi > bestRoi)) {
        bestGoodRun = currentRun;
      }
    }

    if (entry.result === 'red') {
      const currentRoi = runRoi(currentRun);
      const worstRoi = runRoi(worstBadRun);
      if (currentRun.count > worstBadRun.count || (currentRun.count === worstBadRun.count && currentRoi < worstRoi)) {
        worstBadRun = currentRun;
      }
    }
  });

  const expectedGreens = total * 0.5;
  const standardDeviation = Math.sqrt(total * 0.25);
  const zScore = standardDeviation > 0 ? Math.abs(greens.length - expectedGreens) / standardDeviation : 0;
  const pValue = total > 0 ? Math.max(0, Math.min(1, 2 * (1 - normalCdf(zScore)))) * 100 : 0;

  return {
    bestGoodRun,
    worstBadRun,
    countPerMonth: total / months,
    countPerDay: total / days,
    months,
    accuracy,
    averageOdd,
    averageGreenOdd,
    maxDrawdownPercent: totalStake > 0 ? (maxDrawdown / totalStake) * 100 : 0,
    pValue,
    greens: greens.length,
    reds: reds.length,
    voids: 0,
    total,
  };
};

const formatSignedPercent = (value: number, digits = 4) =>
  `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(digits)}%`;

function StatRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/8 py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        <span>{label}</span>
        <HelpCircle className="h-4 w-4 text-slate-500" />
      </div>
      <div className={`text-right text-base font-semibold ${tone === 'green' ? 'text-emerald-300' : tone === 'red' ? 'text-red-300' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function AdvancedStats({ entries }: { entries: TradeEntry[] }) {
  const stats = useMemo(() => buildAdvancedStats(entries), [entries]);

  return (
    <Card title="Estatisticas avancadas" subtitle="Resumo de sequencias, frequencia, assertividade e risco do backtest.">
      <div className="grid gap-x-8 lg:grid-cols-2">
        <div>
          <StatRow label="Melhor good run - Contagem" value={stats.bestGoodRun.count} />
          <StatRow label="Melhor good run - Lucro" value={formatSignedPercent(runRoi(stats.bestGoodRun), 4)} tone="green" />
          <StatRow label="Melhor good run - De/Ate" value={getRunRange(stats.bestGoodRun, stats.total)} />
          <StatRow label="Pior bad run - Contagem" value={stats.worstBadRun.count} />
          <StatRow label="Pior bad run - Perda" value={formatSignedPercent(runRoi(stats.worstBadRun), 4)} tone="red" />
          <StatRow label="Pior bad run - De/Ate" value={getRunRange(stats.worstBadRun, stats.total)} />
          <StatRow label="Contagem" value={stats.total} />
        </div>
        <div>
          <StatRow
            label="Resultado"
            value={
              <span className="inline-flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-300" />
                {stats.greens}
                <span>-</span>
                <Recycle className="h-4 w-4 text-slate-400" />
                {stats.voids}
                <span>-</span>
                <X className="h-4 w-4 text-red-300" />
                {stats.reds}
              </span>
            }
          />
          <StatRow label="Contagem/mes" value={formatNumber(stats.countPerMonth, 2)} />
          <StatRow label="Contagem/dia" value={formatNumber(stats.countPerDay, 2)} />
          <StatRow label="Meses" value={stats.months} />
          <StatRow label="Assertividade" value={formatSignedPercent(stats.accuracy, 2)} />
          <StatRow label="Odd media" value={formatNumber(stats.averageOdd, 4)} />
          <StatRow label="Odd media (greens)" value={formatNumber(stats.averageGreenOdd, 4)} />
          <StatRow label="Drawdown max." value={formatSignedPercent(stats.maxDrawdownPercent, 4)} tone="red" />
          <StatRow label="P-valor" value={formatSignedPercent(stats.pValue, 4)} tone="green" />
        </div>
      </div>
    </Card>
  );
}

export function BacktestPage({ bots, selectedBot, initialResult, onResult }: BacktestPageProps) {
  const bot = useMemo(() => {
    if (selectedBot) return bots.find((item) => item.id === selectedBot.id) ?? selectedBot;
    return bots[0];
  }, [bots, selectedBot]);

  const [result, setResult] = useState<BacktestResult | undefined>(() =>
    initialResult?.botId === bot?.id ? initialResult : undefined,
  );

  useEffect(() => {
    setResult(initialResult?.botId === bot?.id ? initialResult : undefined);
  }, [bot?.id, initialResult]);

  const bankrollData = useMemo(
    () => buildBankrollData(result?.entries ?? []),
    [result?.entries],
  );

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
        description="Teste um metodo contra a base historica de snapshots reais quando houver volume suficiente de odds minuto a minuto."
        action={bot && <Button onClick={handleRun} icon={<Play className="h-4 w-4" />}>Rodar backtest</Button>}
      />
      {bots.length === 0 || !bot ? (
        <EmptyState title="Nenhum bot disponivel" description="Crie um bot para executar o motor de backtest." />
      ) : (
        <div className="space-y-5">
          <Card title={bot.name || 'Bot sem nome'} subtitle="Bot selecionado para o backtest atual.">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-white/8 bg-ink-900/70 p-4 md:col-span-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Descricao</p>
                <p className="mt-2 text-sm text-slate-300">{bot.description || 'Sem descricao cadastrada.'}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-ink-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Mercado</p>
                <p className="mt-2 font-semibold text-white">{bot.market || 'Sem mercado'}</p>
              </div>
              <div className="rounded-lg border border-white/8 bg-ink-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Odd entrada</p>
                <p className="mt-2 font-semibold text-white">
                  {bot.minOdd !== undefined || bot.maxOdd !== undefined
                    ? `${bot.minOdd?.toFixed(2) ?? '-'} ate ${bot.maxOdd?.toFixed(2) ?? '-'}`
                    : 'Sem filtro'}
                </p>
              </div>
            </div>
          </Card>

          {result ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Entradas" value={result.totalEntries} />
                <StatCard label="Greens" value={result.greens} tone="green" />
                <StatCard label="Reds" value={result.reds} tone="red" />
                <StatCard label="Lucro/prejuizo" value={formatCurrency(result.profit)} tone={result.profit >= 0 ? 'green' : 'red'} />
                <StatCard label="ROI" value={formatPercent(result.roi)} tone={result.roi >= 0 ? 'green' : 'red'} />
                <StatCard label="Odd media" value={formatNumber(result.averageOdd)} />
                <StatCard label="Minuto medio" value={`${formatNumber(result.averageMinute, 1)}'`} />
                <StatCard label="Melhor liga" value={result.bestLeague} tone="blue" />
              </div>

              <Card title="Evolucao da banca" subtitle="Curva simulada entrada por entrada, partindo de R$0.">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={bankrollData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <defs>
                      <linearGradient id="bankrollGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#243244" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCurrency(Number(value)).replace('R$', '').trim()} />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value, name) => [
                        name === 'banca' ? formatCurrency(Number(value)) : formatCurrency(Number(value)),
                        name === 'banca' ? 'Banca' : 'Lucro da entrada',
                      ]}
                    />
                    <Area type="monotone" dataKey="banca" stroke="#34d399" strokeWidth={3} fill="url(#bankrollGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <AdvancedStats entries={result.entries} />

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
                          <td className="px-3 py-4 text-slate-300">{entry.market} {entry.operation}</td>
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
          ) : (
            <EmptyState
              title="Backtest aguardando base historica"
              description="O motor esta pronto, mas precisa de snapshots reais acumulados pelo backend para backtests e replay completos."
            />
          )}
        </div>
      )}
    </>
  );
}
