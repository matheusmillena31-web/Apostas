import { useEffect, useState } from 'react';
import { Eye, RefreshCw, X } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import { ApiFootballFixtureItem, ApiFootballFixtureStatisticsItem, ApiFootballLiveOddsItem, ApiFootballOddsBet } from '../types/api';
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

const getOddsMarkets = (odds: ApiFootballLiveOddsItem[] | undefined): ApiFootballOddsBet[] =>
  odds?.flatMap((item) => [...(item.odds ?? []), ...(item.bookmakers?.flatMap((bookmaker) => bookmaker.bets) ?? [])]) ?? [];

function MatchDetails({
  match,
  details,
  onClose,
}: {
  match: ApiFootballFixtureItem;
  details?: FixtureLiveDetails;
  onClose: () => void;
}) {
  const homeStats = details?.statistics?.find((item) => item.team.id === match.teams.home.id)?.statistics ?? [];
  const awayStats = details?.statistics?.find((item) => item.team.id === match.teams.away.id)?.statistics ?? [];
  const oddsMarkets = getOddsMarkets(details?.odds).slice(0, 16);
  const statLabels = Array.from(new Set([...homeStats, ...awayStats].map((stat) => stat.type))).slice(0, 14);

  return (
    <Card
      className="mb-5 border-electric-500/30"
      title={`${match.teams.home.name} x ${match.teams.away.name}`}
      subtitle={`${match.league.name} | ${match.fixture.status.long}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={match.teams.home.logo} alt="" className="h-10 w-10 rounded bg-white/5 p-1" />
          <span className="text-2xl font-black text-white">{formatScore(match.goals.home, match.goals.away)}</span>
          <img src={match.teams.away.logo} alt="" className="h-10 w-10 rounded bg-white/5 p-1" />
        </div>
        <Button variant="ghost" onClick={onClose} icon={<X className="h-4 w-4" />}>Fechar</Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-white/8 bg-ink-900/70 p-4">
          <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
            <p className="font-semibold text-electric-300">{match.teams.home.name}</p>
            <p className="text-center text-slate-500">estatisticas</p>
            <p className="text-right font-semibold text-violet-300">{match.teams.away.name}</p>
          </div>
          <div className="space-y-2">
            {statLabels.length === 0 && <p className="text-sm text-slate-500">Estatisticas ainda nao disponiveis para este fixture.</p>}
            {statLabels.map((label) => {
              const homeValue = homeStats.find((stat) => stat.type === label)?.value ?? '-';
              const awayValue = awayStats.find((stat) => stat.type === label)?.value ?? '-';

              return (
                <div key={label} className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-3 rounded-md bg-ink-950 px-3 py-2 text-sm">
                  <span className="font-semibold text-white">{homeValue}</span>
                  <span className="text-center text-slate-400">{label}</span>
                  <span className="text-right font-semibold text-white">{awayValue}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-ink-900/70 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-semibold text-white">Odds live</p>
            <span className="rounded-full bg-electric-500/12 px-2.5 py-1 text-xs text-electric-200">{oddsMarkets.length} mercado(s)</span>
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {oddsMarkets.length === 0 && <p className="text-sm text-slate-500">Odds live ainda nao disponiveis para este fixture.</p>}
            {oddsMarkets.map((market) => (
              <div key={`${market.id}-${market.name}`} className="rounded-md border border-white/8 bg-ink-950 p-3">
                <p className="mb-3 text-sm font-black uppercase tracking-wide text-white">{market.name}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {market.values.slice(0, 8).map((value) => (
                    <div key={`${value.value}-${value.handicap ?? ''}`} className="rounded-md bg-white/5 px-3 py-2">
                      <p className="truncate text-xs text-slate-400">{value.value}{value.handicap ? ` (${value.handicap})` : ''}</p>
                      <p className="text-lg font-black text-electric-300">{value.odd}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LiveGames({ bots }: LiveGamesProps) {
  const activeBots = bots.filter((bot) => bot.isActive);
  const [detailsByFixture, setDetailsByFixture] = useState<Record<number, FixtureLiveDetails>>({});
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | undefined>();
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
        <>
          {selectedFixtureId && (() => {
            const selectedMatch = liveMatches?.find((match) => match.fixture.id === selectedFixtureId);
            return selectedMatch ? (
              <MatchDetails
                match={selectedMatch}
                details={detailsByFixture[selectedFixtureId]}
                onClose={() => setSelectedFixtureId(undefined)}
              />
            ) : null;
          })()}
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

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                    <span>{activeBots.length} bot(s) ativo(s). Odds live: {oddsMarkets} mercado(s) capturado(s).</span>
                    <Button variant="secondary" onClick={() => setSelectedFixtureId(match.fixture.id)} icon={<Eye className="h-4 w-4" />}>
                      Abrir jogo
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
