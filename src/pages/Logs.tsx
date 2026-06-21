import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { BotLog } from '../types';

type LogsProps = {
  logs: BotLog[];
};

export function Logs({ logs }: LogsProps) {
  return (
    <>
      <PageHeader
        title="Logs dos Bots"
        description="Histórico das verificações feitas durante backtests e simulações."
      />
      {logs.length === 0 ? (
        <EmptyState title="Nenhum log registrado" description="Os logs aparecem após rodar um backtest ou simulação." />
      ) : (
        <Card>
          <div className="table-scroll">
            <table className="min-w-[1020px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Data/hora</th>
                  <th className="px-3 py-3">Bot</th>
                  <th className="px-3 py-3">Jogo</th>
                  <th className="px-3 py-3">Minuto</th>
                  <th className="px-3 py-3">Regra</th>
                  <th className="px-3 py-3">Resultado</th>
                  <th className="px-3 py-3">Entrada</th>
                  <th className="px-3 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {logs.slice(0, 220).map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-4 text-slate-400">{new Date(log.date).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-4 font-semibold text-white">{log.botName}</td>
                    <td className="px-3 py-4 text-slate-300">{log.game}</td>
                    <td className="px-3 py-4 text-slate-300">{log.minute}'</td>
                    <td className="px-3 py-4 text-slate-300">{log.checkedRule}</td>
                    <td className={`px-3 py-4 font-semibold ${log.rulePassed ? 'text-emerald-300' : 'text-red-300'}`}>
                      {log.rulePassed ? 'Aprovada' : 'Reprovada'}
                    </td>
                    <td className="px-3 py-4 text-slate-300">{log.entryMade ? 'Sim' : 'Não'}</td>
                    <td className="px-3 py-4 text-slate-400">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
