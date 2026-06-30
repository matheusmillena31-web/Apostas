import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock, Eye, Loader2, Lock, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { BacktestJob, BacktestJobStatus, Bot, BotRule, TradeEntry } from '../types';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

type BacktestPageProps = {
  jobs: BacktestJob[];
  onDeleteJob: (jobId: string) => void;
  onDeleteAllJobs: () => void;
  onCancelJob: (jobId: string) => void;
};

type SortKey = 'name' | 'type' | 'market' | 'accuracy' | 'entries' | 'profit' | 'createdAt' | 'scheduledFor' | 'status';

const PAGE_SIZE = 10;
const MAX_PENDING_JOBS = 20;

type WalletPoint = {
  entrada: string;
  carteira: number;
  lucro: number;
};

const chartTooltipStyle = {
  background: '#101620',
  border: '1px solid rgba(255,255,255,.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
};

const statusLabels: Record<BacktestJobStatus, string> = {
  pending: 'Aguardando',
  processing: 'Processando',
  completed: 'Processado',
  error: 'Erro',
  cancelled: 'Cancelado',
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getAccuracy = (job: BacktestJob) => {
  if (typeof job.accuracy === 'number') return job.accuracy;
  if (!job.result || job.result.totalEntries === 0) return undefined;
  return (job.result.greens / job.result.totalEntries) * 100;
};

const getEntries = (job: BacktestJob) => job.entries ?? job.result?.totalEntries;
const getProfit = (job: BacktestJob) => job.profit ?? job.result?.profit;
const getRoi = (job: BacktestJob) => job.roi ?? job.result?.roi;

const buildWalletData = (entries: TradeEntry[]): WalletPoint[] => {
  let wallet = 0;
  const points: WalletPoint[] = [{ entrada: '0', carteira: 0, lucro: 0 }];

  entries.forEach((entry, index) => {
    wallet += entry.profit;
    points.push({
      entrada: String(index + 1),
      carteira: Number(wallet.toFixed(2)),
      lucro: Number(entry.profit.toFixed(2)),
    });
  });

  return points;
};

const statusTone = (status: BacktestJobStatus) => {
  if (status === 'completed') return 'bg-emerald-500/12 text-emerald-300';
  if (status === 'processing') return 'bg-blue-500/12 text-blue-300';
  if (status === 'pending') return 'bg-amber-500/12 text-amber-300';
  if (status === 'error') return 'bg-red-500/12 text-red-300';
  return 'bg-slate-500/12 text-slate-400';
};

function StatusPill({ status }: { status: BacktestJobStatus }) {
  const icon = {
    pending: <Clock className="h-3.5 w-3.5" />,
    processing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    completed: <CheckCircle2 className="h-3.5 w-3.5" />,
    error: <AlertTriangle className="h-3.5 w-3.5" />,
    cancelled: <Ban className="h-3.5 w-3.5" />,
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}>
      {icon}
      {statusLabels[status]}
    </span>
  );
}

const ruleText = (rule: BotRule) => {
  const value = rule.operator === 'between' ? `${rule.value} e ${rule.secondValue}` : rule.value;
  return `${rule.connector ?? 'AND'} ${rule.parameter} ${rule.operator === 'between' ? 'entre' : rule.operator} ${value}`;
};

function SortButton({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: 'asc' | 'desc'; onSort: (key: SortKey) => void }) {
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 text-left uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-300">
      {label}
      {activeKey === sortKey && <span>{direction === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function ParametersModal({ job, onClose }: { job: BacktestJob; onClose: () => void }) {
  const bot = job.botSnapshot;
  const entryRules = bot.rules.filter((rule) => rule.parameter);
  const cashOutRules = bot.cashOut?.exitRules?.filter((rule) => rule.parameter) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg border border-white/10 bg-ink-900 p-5 shadow-glow">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-white">Parametros do chamado</h3>
            <p className="mt-1 text-sm text-slate-400">Snapshot salvo em {formatDateTime(job.createdAt)}. Alteracoes atuais no bot nao afetam este relatorio.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-2 text-slate-300 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <p><span className="text-slate-500">Nome:</span> <span className="text-white">{bot.name}</span></p>
          <p><span className="text-slate-500">Modo:</span> <span className="text-white">{job.type}</span></p>
          <p><span className="text-slate-500">Mercado:</span> <span className="text-white">{bot.market ?? bot.oddMarket ?? '-'}</span></p>
          <p><span className="text-slate-500">Odd:</span> <span className="text-white">{bot.minOdd ?? '-'} ate {bot.maxOdd ?? '-'}</span></p>
          <p><span className="text-slate-500">Ligas incluidas:</span> <span className="text-white">{bot.includedLeagues?.join(', ') || '-'}</span></p>
          <p><span className="text-slate-500">Ligas excluidas:</span> <span className="text-white">{bot.excludedLeagues?.join(', ') || '-'}</span></p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-white/8 bg-ink-950/70 p-4">
            <h4 className="mb-3 font-semibold text-white">Regras de entrada</h4>
            {entryRules.length === 0 ? <p className="text-sm text-slate-500">Sem regras.</p> : entryRules.map((rule) => <p key={rule.id} className="mb-2 text-sm text-slate-300">{ruleText(rule)}</p>)}
          </div>
          <div className="rounded-lg border border-white/8 bg-ink-950/70 p-4">
            <h4 className="mb-3 font-semibold text-white">Regras de cashout</h4>
            {cashOutRules.length === 0 ? <p className="text-sm text-slate-500">Sem regras.</p> : cashOutRules.map((rule) => <p key={rule.id} className="mb-2 text-sm text-slate-300">{ruleText(rule)}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorModal({ job, onClose }: { job: BacktestJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-lg border border-red-500/50 bg-ink-900 p-5 shadow-glow">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-red-300">Erro no relatorio</h3>
            <p className="mt-1 text-sm text-slate-400">{job.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-white/10 p-2 text-slate-300 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{job.errorMessage ?? 'Erro desconhecido.'}</p>
      </div>
    </div>
  );
}

function EntryTable({ entries }: { entries: TradeEntry[] }) {
  return (
    <div className="table-scroll">
      <table className="min-w-[1120px] w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-3 py-3">Jogo</th>
            <th className="px-3 py-3">Liga</th>
            <th className="px-3 py-3">Entrada</th>
            <th className="px-3 py-3">Saida</th>
            <th className="px-3 py-3">Mercado</th>
            <th className="px-3 py-3">Odds</th>
            <th className="px-3 py-3">Placar</th>
            <th className="px-3 py-3">Resultado</th>
            <th className="px-3 py-3">Lucro</th>
            <th className="px-3 py-3">Motivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="px-3 py-4 text-white">{entry.game}</td>
              <td className="px-3 py-4 text-slate-300">{entry.league}</td>
              <td className="px-3 py-4 text-slate-300">{entry.minute}'</td>
              <td className="px-3 py-4 text-slate-300">{entry.cashOutApplied ? <span className="font-semibold text-amber-300">Cashout {entry.cashOutMinute}'</span> : 'Final'}</td>
              <td className="px-3 py-4 text-slate-300">{entry.market} {entry.operation}</td>
              <td className="px-3 py-4 text-slate-300">{entry.odd.toFixed(2)}{entry.cashOutOdd ? <span className="text-amber-300"> -&gt; {entry.cashOutOdd.toFixed(2)}</span> : null}</td>
              <td className="px-3 py-4 text-slate-300">{entry.entryScoreHome ?? '-'}-{entry.entryScoreAway ?? '-'}{entry.cashOutApplied ? <span className="text-amber-300"> -&gt; {entry.exitScoreHome ?? '-'}-{entry.exitScoreAway ?? '-'}</span> : null}</td>
              <td className={`px-3 py-4 font-semibold ${entry.result === 'green' ? 'text-emerald-300' : 'text-red-300'}`}>{entry.result}</td>
              <td className={`px-3 py-4 font-semibold ${entry.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(entry.profit)}</td>
              <td className="px-3 py-4 text-slate-400">{entry.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WalletChart({ entries }: { entries: TradeEntry[] }) {
  const data = useMemo(() => buildWalletData(entries), [entries]);
  const finalWallet = data[data.length - 1]?.carteira ?? 0;
  const stroke = finalWallet >= 0 ? '#34d399' : '#ef4444';

  return (
    <Card title="Carteira" subtitle="Evolucao acumulada do lucro/prejuizo entrada por entrada.">
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 12 }}>
          <defs>
            <linearGradient id="walletGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.24} />
              <stop offset="48%" stopColor="#34d399" stopOpacity={0.08} />
              <stop offset="52%" stopColor="#ef4444" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,.22)" strokeDasharray="3 3" />
          <XAxis
            dataKey="entrada"
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            minTickGap={18}
            label={{ value: 'Entradas', position: 'insideBottom', offset: -6, fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(Number(value)).replace('R$', '').trim()}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(value, name) => [
              formatCurrency(Number(value)),
              name === 'carteira' ? 'Carteira' : 'Lucro da entrada',
            ]}
            labelFormatter={(label) => `Entrada ${label}`}
          />
          <ReferenceLine y={0} stroke="rgba(226,232,240,.55)" strokeWidth={1.5} />
          <Area
            type="monotone"
            dataKey="carteira"
            name="Carteira"
            stroke={stroke}
            strokeWidth={3}
            fill="url(#walletGradient)"
            dot={false}
            activeDot={{ r: 4, stroke, strokeWidth: 2, fill: '#101620' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ReportDetail({ job, onBack }: { job: BacktestJob; onBack: () => void }) {
  const result = job.result;
  if (!result) {
    return (
      <EmptyState
        title="Relatorio sem resultado"
        description="Este chamado foi marcado como processado, mas o resultado tecnico nao foi encontrado."
        action={<Button onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>Voltar aos relatorios</Button>}
      />
    );
  }

  const accuracy = result.totalEntries > 0 ? (result.greens / result.totalEntries) * 100 : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={job.name}
        description={`${job.type} | ${job.market ?? 'Sem mercado'} | criado em ${formatDateTime(job.createdAt)}`}
        action={<Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="h-4 w-4" />}>Voltar aos relatorios</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entradas" value={result.totalEntries} />
        <StatCard label="Greens" value={result.greens} tone="green" />
        <StatCard label="Reds" value={result.reds} tone="red" />
        <StatCard label="Assertividade" value={formatPercent(accuracy)} tone={accuracy >= 50 ? 'green' : 'red'} />
        <StatCard label="Lucro/prejuizo" value={formatCurrency(result.profit)} tone={result.profit >= 0 ? 'green' : 'red'} />
        <StatCard label="ROI" value={formatPercent(result.roi)} tone={result.roi >= 0 ? 'green' : 'red'} />
        <StatCard label="Odd media" value={formatNumber(result.averageOdd)} />
        <StatCard label="Minuto medio" value={`${formatNumber(result.averageMinute, 1)}'`} />
        <StatCard label="Melhor liga" value={result.bestLeague} tone="blue" />
        <StatCard label="Pior liga" value={result.worstLeague} />
      </div>

      <WalletChart entries={result.entries} />

      <Card title="Entradas simuladas" subtitle="Resultado completo do chamado processado.">
        <EntryTable entries={result.entries} />
      </Card>
    </div>
  );
}

export function BacktestPage({ jobs, onDeleteJob, onDeleteAllJobs, onCancelJob }: BacktestPageProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<BacktestJob | undefined>();
  const [parameterJob, setParameterJob] = useState<BacktestJob | undefined>();
  const [errorJob, setErrorJob] = useState<BacktestJob | undefined>();

  const completed = jobs.filter((job) => job.status === 'completed').length;
  const active = jobs.filter((job) => job.status === 'pending' || job.status === 'processing').length;
  const remainingSlots = Math.max(0, MAX_PENDING_JOBS - active);

  const sortedJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const text = `${job.name} ${job.botSnapshot.name} ${job.market ?? ''} ${job.type} ${statusLabels[job.status]}`.toLowerCase();
      return text.includes(normalizedQuery);
    });

    return [...filtered].sort((a, b) => {
      const valueA = sortKey === 'accuracy' ? getAccuracy(a) : sortKey === 'entries' ? getEntries(a) : sortKey === 'profit' ? getProfit(a) : a[sortKey];
      const valueB = sortKey === 'accuracy' ? getAccuracy(b) : sortKey === 'entries' ? getEntries(b) : sortKey === 'profit' ? getProfit(b) : b[sortKey];
      const numericA = typeof valueA === 'number' ? valueA : String(valueA ?? '').toLowerCase();
      const numericB = typeof valueB === 'number' ? valueB : String(valueB ?? '').toLowerCase();
      const comparison = numericA > numericB ? 1 : numericA < numericB ? -1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [jobs, query, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / PAGE_SIZE));
  const visibleJobs = sortedJobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const changeSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  if (selectedJob) return <ReportDetail job={selectedJob} onBack={() => setSelectedJob(undefined)} />;

  return (
    <>
      <PageHeader
        title="Relatorios do backtest"
        description={`Concluidos: ${completed} | A processar: ${active} | Voce ainda pode agendar mais ${remainingSlots} relatorios.`}
        action={<Button variant="danger" onClick={onDeleteAllJobs} icon={<Trash2 className="h-4 w-4" />}>Excluir relatorios</Button>}
      />

      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, mercado, tipo ou status"
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 md:max-w-md"
          />
          <p className="text-sm text-slate-500">Pagina {page} de {totalPages}</p>
        </div>

        {jobs.length === 0 ? (
          <EmptyState title="Nenhum relatorio criado" description="Use o botao de backtest na aba Bots para criar chamados independentes." />
        ) : (
          <>
            <div className="table-scroll">
              <table className="min-w-[1320px] w-full text-left text-sm">
                <thead className="text-xs">
                  <tr>
                    <th className="px-3 py-3"><SortButton label="Nome" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3">Criado por</th>
                    <th className="px-3 py-3"><SortButton label="Tipo" sortKey="type" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3">Parametros</th>
                    <th className="px-3 py-3"><SortButton label="Mercado" sortKey="market" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Ass." sortKey="accuracy" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Cont." sortKey="entries" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Lucro" sortKey="profit" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Criado em" sortKey="createdAt" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Agendado para" sortKey="scheduledFor" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3"><SortButton label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {visibleJobs.map((job) => {
                    const clickable = job.status === 'completed' && Boolean(job.result);
                    return (
                      <tr key={job.id} className={`${job.status === 'pending' || job.status === 'processing' ? 'opacity-70' : ''}`}>
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={() => clickable && setSelectedJob(job)}
                            className={`text-left font-semibold ${clickable ? 'text-white hover:text-violet-300' : 'text-slate-400'}`}
                          >
                            {job.name}
                          </button>
                          <p className="line-clamp-1 text-xs text-slate-500">{job.botSnapshot.name}</p>
                        </td>
                        <td className="px-3 py-4 text-slate-300">{job.createdBy}</td>
                        <td className="px-3 py-4 text-slate-300">{job.type}</td>
                        <td className="px-3 py-4">
                          <Button variant="ghost" className="px-2" onClick={() => setParameterJob(job)} icon={<SlidersHorizontal className="h-4 w-4" />}>Parametros</Button>
                        </td>
                        <td className="px-3 py-4 text-slate-300">{job.market ?? '-'}</td>
                        <td className="px-3 py-4 text-slate-300">{getAccuracy(job) !== undefined ? formatPercent(getAccuracy(job) ?? 0) : '-'}</td>
                        <td className="px-3 py-4 text-slate-300">{getEntries(job) ?? '-'}</td>
                        <td className={`px-3 py-4 font-semibold ${(getProfit(job) ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {getProfit(job) !== undefined ? `${formatCurrency(getProfit(job) ?? 0)} (${formatPercent(getRoi(job) ?? 0)})` : '-'}
                        </td>
                        <td className="px-3 py-4 text-slate-300">{formatDateTime(job.createdAt)}</td>
                        <td className="px-3 py-4 text-slate-300">{formatDateTime(job.scheduledFor)}</td>
                        <td className="px-3 py-4"><StatusPill status={job.status} /></td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            {job.status === 'completed' ? (
                              <Button variant="ghost" className="px-2" title="Abrir resultado" disabled={!job.result} onClick={() => job.result && setSelectedJob(job)} icon={<Eye className="h-4 w-4" />} />
                            ) : job.status === 'error' ? (
                              <Button variant="ghost" className="px-2" title="Ver erro" onClick={() => setErrorJob(job)} icon={<AlertTriangle className="h-4 w-4" />} />
                            ) : job.status === 'pending' ? (
                              <Button variant="ghost" className="px-2" title="Cancelar" onClick={() => onCancelJob(job.id)} icon={<Ban className="h-4 w-4" />} />
                            ) : (
                              <Button variant="ghost" className="px-2" title="Indisponivel" disabled icon={<Lock className="h-4 w-4" />} />
                            )}
                            <Button variant="danger" className="px-2" title="Excluir relatorio" onClick={() => onDeleteJob(job.id)} icon={<X className="h-4 w-4" />} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button>
              <span className="text-sm text-slate-500">{sortedJobs.length} relatorio(s)</span>
              <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Proxima</Button>
            </div>
          </>
        )}
      </Card>

      {parameterJob && <ParametersModal job={parameterJob} onClose={() => setParameterJob(undefined)} />}
      {errorJob && <ErrorModal job={errorJob} onClose={() => setErrorJob(undefined)} />}
    </>
  );
}
