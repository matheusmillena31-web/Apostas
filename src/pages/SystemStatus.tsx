import { CheckCircle2, Database, Server, ShieldCheck } from 'lucide-react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import { Bot, BotLog, BacktestResult } from '../types';

type SystemStatusProps = {
  bots: Bot[];
  logs: BotLog[];
  results: BacktestResult[];
};

export function SystemStatus({ bots, logs, results }: SystemStatusProps) {
  const { data: proxyStatus, loading, error } = useAsyncData(
    () => apiFootballService.buscarStatusProxy(),
    [],
  );

  return (
    <>
      <PageHeader
        title="Status do Sistema"
        description="Estado do MVP com proxy backend, API-FOOTBALL e base historica local."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dados locais" value="Operacional" icon={<Database className="h-5 w-5" />} tone="green" />
        <StatCard
          label="API-FOOTBALL"
          value={loading ? 'Verificando' : proxyStatus?.hasToken ? 'Conectada' : 'Sem token'}
          icon={<Server className="h-5 w-5" />}
          tone={proxyStatus?.hasToken ? 'green' : undefined}
        />
        <StatCard label="Token no backend" value={proxyStatus?.hasToken ? 'Sim' : 'Nao'} icon={<ShieldCheck className="h-5 w-5" />} tone={proxyStatus?.hasToken ? 'blue' : undefined} />
        <StatCard label="Snapshots" value={proxyStatus?.snapshotCount ?? 0} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
      </div>
      <Card className="mt-5" title="Inventario">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Bots: <span className="font-semibold text-white">{bots.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Backtests salvos: <span className="font-semibold text-white">{results.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Logs: <span className="font-semibold text-white">{logs.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Proxy: <span className="font-semibold text-white">{error ? 'Erro' : proxyStatus?.service ?? '-'}</span></p>
        </div>
        <p className="mt-5 text-sm text-slate-400">
          O frontend consulta somente o backend local. A chave da API-FOOTBALL fica fora do React e os snapshots gravados em JSONL formam a primeira base historica de odds e jogo.
        </p>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </Card>
    </>
  );
}
