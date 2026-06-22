import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import { ApiFootballFixtureStatisticsItem, ApiFootballLiveOddsItem } from '../types/api';
import { Bot } from '../types';

type LiveGamesProps = {
  bots: Bot[];
};

type FixtureLiveDetails = {
  odds?: ApiFootballLiveOddsItem[];
  statistics?: ApiFootballFixtureStatisticsItem[];
};

const formatScore = (home: number | null, away: number | null) =>
  home === null || away === null ? '-' : `${home} x ${away}`;

const getStatValue = (statistics: ApiFootballFixtureStatisticsItem[] | undefined, teamId: number, label: string) => {
  const item = statistics?.find((row) => row.team.id === teamId);
  const stat = item?.statistics.find((row) => row.type.toLowerCase() === label.toLowerCase());
  return stat?.value ?? '-';
};

const countOddsMarkets = (odds: ApiFootballLiveOddsItem[] | undefined) =>
  odds?.reduce((total, item) => total + (item.odds?.length ?? 0) + (item.bookmakers?.flatMap((bookmaker) => bookmaker.bets).length ?? 0), 0) ?? 0;

export function LiveGames({ bots }: LiveGamesProps) {
  const activeBots = bots.filter((bot) => bot.isActive);
  const [detailsByFixture, setDetailsByFixture] = useState<Record<number, FixtureLiveDetails>>({});
  const { data: liveMatches, loading, error } = useAsyncData(
    () => apiFootballService.buscarFixturesAoVivo(),
    [],
  );

  useEffect(() => {
    if (!liveMatches?.length) return;

    let active = true;
    const fixtureIds = liveMatches.map((match) => match.fixture.id);

    Promise.all(
      fixtureIds.map(async (fixtureId) => {
        const [odds, statistics] = await Promise.all([
          apiFootballService.buscarOddsAoVivo(fixtureId).catch(() => undefined),
          apiFootballService.buscarEstatisticasFixture(fixtureId).catch(() => undefined),
          apiFootballService.buscarEventosFixture(fixtureId).catch(() => undefined),
        ]);
        return [fixtureId, { odds, statistics }] as const;
      }),
    ).then((entries) => {
      if (active) setDetailsByFixture(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [liveMatches]);

  return (
    <>
      <PageHeader
        title="Jogos ao vivo"
        description="Fixtures ao vivo, estatisticas e odds live carregadas pela API-FOOTBALL v3."
        action={<Button variant="secondary" onClick={() => window.location.reload()} icon={<RefreshCw className="h-4 w-4" />}>Atualizar</Button>}
      />

      {loading && <EmptyState title="Carregando jogos ao vivo" description="Consultando fixtures live pela API-FOOTBALL." />}
      {error && !loading && <EmptyState title="Nao foi possivel carregar a API-FOOTBALL" description={error} />}
      {!loading && !error && (liveMatches ?? []).length === 0 && (
        <EmptyState title="Nenhuma partida ao vivo agora" description="A API-FOOTBALL retornou a lista vazia para fixtures live." />
      )}

      {!loading && !error && (liveMatches ?? []).length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {(liveMatches ?? []).map((match) => {
            const details = detailsByFixture[match.fixture.id];
            const oddsMarkets = countOddsMarkets(details?.odds);

            return (
              <Card
                key={match.fixture.id}
                title={`${match.teams.home.name} x ${match.teams.away.name}`}
                subtitle={`${match.league.name} | ${match.fixture.status.long}`}
              >
                <div className="mb-4 flex items-center justify-between rounded-lg bg-ink-900 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <img src={match.teams.home.logo} alt="" className="h-9 w-9 shrink-0" />
                    <p className="truncate text-sm text-slate-300">{match.teams.home.name}</p>
                  </div>
                  <span className="mx-3 rounded-md border border-electric-500/30 bg-electric-500/10 px-3 py-2 text-lg font-black text-white">
                    {formatScore(match.goals.home, match.goals.away)}
                  </span>
                  <div className="flex min-w-0 items-center justify-end gap-3">
                    <p className="truncate text-right text-sm text-slate-300">{match.teams.away.name}</p>
                    <img src={match.teams.away.logo} alt="" className="h-9 w-9 shrink-0" />
                  </div>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>Minuto: <span className="text-white">{match.fixture.status.elapsed ?? '-'}{match.fixture.status.extra ? `+${match.fixture.status.extra}` : ''}</span></p>
                  <p>Temporada: <span className="text-white">{match.league.season}</span></p>
                  <p>Estadio: <span className="text-white">{match.fixture.venue.name ?? '-'}</span></p>
                  <p>ID fixture: <span className="text-white">{match.fixture.id}</span></p>
                </div>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p>Finalizacoes casa: <span className="text-white">{getStatValue(details?.statistics, match.teams.home.id, 'Total Shots')}</span></p>
                  <p>Finalizacoes fora: <span className="text-white">{getStatValue(details?.statistics, match.teams.away.id, 'Total Shots')}</span></p>
                  <p>No alvo casa: <span className="text-white">{getStatValue(details?.statistics, match.teams.home.id, 'Shots on Goal')}</span></p>
                  <p>No alvo fora: <span className="text-white">{getStatValue(details?.statistics, match.teams.away.id, 'Shots on Goal')}</span></p>
                </div>

                <div className="mt-4 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                  {activeBots.length} bot(s) ativo(s). Odds live: {oddsMarkets} mercado(s) capturado(s) para a base historica local.
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
