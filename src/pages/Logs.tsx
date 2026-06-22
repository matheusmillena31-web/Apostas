import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { BotLog } from '../types';

type LogsProps = {
  logs: BotLog[];
};

type LogGroup = {
  key: string;
  date: string;
  botName: string;
  game: string;
  logs: BotLog[];
  approved: number;
  entries: number;
  firstEntry?: BotLog;
};

const groupLogs = (logs: BotLog[]) => {
  const groups = new Map<string, LogGroup>();

  logs.forEach((log) => {
    const key = `${log.date}-${log.botId}-${log.gameId}`;
    const current =
      groups.get(key) ??
      {
        key,
        date: log.date,
        botName: log.botName,
        game: log.game,
        logs: [],
        approved: 0,
        entries: 0,
        firstEntry: undefined,
      };

    current.logs.push(log);
    current.approved += log.rulePassed ? 1 : 0;
    current.entries += log.entryMade ? 1 : 0;
    if (log.entryMade && !current.firstEntry) current.firstEntry = log;
    groups.set(key, current);
  });

  return [...groups.values()].map((group) => ({
    ...group,
    logs: [...group.logs].sort((a, b) => a.minute - b.minute),
  }));
};

export function Logs({ logs }: LogsProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const groupedLogs = useMemo(() => groupLogs(logs.slice(0, 600)), [logs]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <>
      <PageHeader
        title="Logs dos Bots"
        description="Historico das verificacoes feitas durante backtests e simulacoes, agrupado por partida."
      />
      {logs.length === 0 ? (
        <EmptyState title="Nenhum log registrado" description="Os logs aparecem apos rodar um backtest ou simulacao." />
      ) : (
        <Card>
          <div className="space-y-3">
            {groupedLogs.map((group) => {
              const expanded = expandedGroups.includes(group.key);
              const firstMinute = group.logs[0]?.minute ?? 0;
              const lastMinute = group.logs[group.logs.length - 1]?.minute ?? 0;

              return (
                <div key={group.key} className="rounded-lg border border-white/8 bg-ink-900/70">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{group.game}</p>
                        <p className="text-xs text-slate-500">
                          {group.botName} | {new Date(group.date).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-slate-500/12 px-2.5 py-1 text-slate-300">
                        {firstMinute}'-{lastMinute}'
                      </span>
                      <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-300">
                        {group.approved} aprovadas
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${group.entries > 0 ? 'bg-electric-500/12 text-electric-300' : 'bg-slate-500/12 text-slate-400'}`}>
                        {group.firstEntry ? `Entrada ${group.firstEntry.minute}'` : 'Sem entrada'}
                      </span>
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">
                        {expanded ? 'Recolher' : 'Ver partida completa'}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-white/8 px-4 pb-4 pt-2">
                      <div className="table-scroll">
                        <table className="min-w-[900px] w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                              <th className="px-3 py-3">Minuto</th>
                              <th className="px-3 py-3">Regra</th>
                              <th className="px-3 py-3">Resultado</th>
                              <th className="px-3 py-3">Entrada</th>
                              <th className="px-3 py-3">Motivo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/8">
                            {group.logs.map((log) => (
                              <tr key={log.id}>
                                <td className="px-3 py-3 text-slate-300">{log.minute}'</td>
                                <td className="px-3 py-3 text-slate-300">{log.checkedRule}</td>
                                <td className={`px-3 py-3 font-semibold ${log.rulePassed ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {log.rulePassed ? 'Aprovada' : 'Reprovada'}
                                </td>
                                <td className="px-3 py-3 text-slate-300">{log.entryMade ? 'Sim' : 'Nao'}</td>
                                <td className="px-3 py-3 text-slate-400">{log.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
