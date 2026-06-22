import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import { Bot } from '../types';

type TradingExecutionProps = {
  bots: Bot[];
};

export function TradingExecution({ bots }: TradingExecutionProps) {
  const activeBots = bots.filter((bot) => bot.isActive);
  const { data: liveMatches, loading, error } = useAsyncData(
    () => apiFootballService.buscarFixturesAoVivo(),
    [],
  );

  return (
    <>
      <PageHeader
        title="Trading em execucao"
        description="Monitor conectado aos fixtures ao vivo reais da API-FOOTBALL."
      />

      {loading && <EmptyState title="Carregando monitor ao vivo" description="Consultando fixtures em andamento." />}
      {error && !loading && <EmptyState title="Nao foi possivel carregar o monitor" description={error} />}
      {!loading && !error && (liveMatches ?? []).length === 0 && (
        <EmptyState title="Nenhuma entrada em execucao" description="Nao ha fixtures ao vivo retornados pela API-FOOTBALL neste momento." />
      )}

      {!loading && !error && (liveMatches ?? []).length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {(liveMatches ?? []).map((match) => (
            <Card
              key={match.fixture.id}
              title={`${match.teams.home.name} x ${match.teams.away.name}`}
              subtitle={`${match.league.name} | ${match.fixture.status.long}`}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Bots ativos</p>
                  <p className="text-xl font-semibold text-white">{activeBots.length}</p>
                </div>
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Minuto</p>
                  <p className="text-xl font-semibold text-white">{match.fixture.status.elapsed ?? '-'}'</p>
                </div>
                <div className="rounded-md bg-ink-900 p-3">
                  <p className="text-xs text-slate-500">Placar</p>
                  <p className="text-xl font-semibold text-white">{match.goals.home ?? 0} x {match.goals.away ?? 0}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300">
                As chamadas de fixtures live, estatisticas, eventos e odds live sao gravadas pelo backend para formar a base historica de replay/backtest.
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
