import { CheckCircle2, Database, Server, ShieldCheck } from 'lucide-react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../components/StatCard';
import { mockGames } from '../data/mockGames';
import { Bot, BotLog, BacktestResult } from '../types';

type SystemStatusProps = {
  bots: Bot[];
  logs: BotLog[];
  results: BacktestResult[];
};

export function SystemStatus({ bots, logs, results }: SystemStatusProps) {
  return (
    <>
      <PageHeader
        title="Status do Sistema"
        description="Estado local do MVP e prontidão para futura integração com APIs oficiais."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Dados locais" value="Operacional" icon={<Database className="h-5 w-5" />} tone="green" />
        <StatCard label="API externa" value="Não conectada" icon={<Server className="h-5 w-5" />} />
        <StatCard label="Modo seguro" value="Simulação" icon={<ShieldCheck className="h-5 w-5" />} tone="blue" />
        <StatCard label="Motor" value="OK" icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
      </div>
      <Card className="mt-5" title="Inventário">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Bots: <span className="font-semibold text-white">{bots.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Jogos mockados: <span className="font-semibold text-white">{mockGames.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Backtests salvos: <span className="font-semibold text-white">{results.length}</span></p>
          <p className="rounded-md bg-ink-900 p-4 text-sm text-slate-300">Logs: <span className="font-semibold text-white">{logs.length}</span></p>
        </div>
        <p className="mt-5 text-sm text-slate-400">
          O MVP não executa apostas reais, não acessa casas de aposta e não depende de scraping. A camada de dados foi isolada para receber APIs oficiais no futuro.
        </p>
      </Card>
    </>
  );
}
