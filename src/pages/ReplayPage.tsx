import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play, RotateCcw, Search, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/FormControls';
import { PageHeader } from '../components/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { apiFootballService } from '../services/apiFootball';
import {
  ApiFootballOddsBet,
  ApiFootballReplayGame,
  ApiFootballReplayGameSummary,
  ApiFootballReplaySnapshot,
} from '../types/api';
import { Bot } from '../types';

type ReplayPageProps = {
  bots: Bot[];
  delay: number;
};

const formatScore = (home: number | null, away: number | null) =>
  home === null || away === null ? '-' : `${home} x ${away}`;

const formatCapturedAt = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : '-';

const formatReplayMinute = (snapshot?: ApiFootballReplaySnapshot) => {
  if (!snapshot) return '-';
  return `${snapshot.minute ?? 0}'${snapshot.extra ? `+${snapshot.extra}` : ''}`;
};

const getOddsMarkets = (snapshot?: ApiFootballReplaySnapshot): ApiFootballOddsBet[] =>
  snapshot?.odds?.flatMap((item) => [...(item.odds ?? []), ...(item.bookmakers?.flatMap((bookmaker) => bookmaker.bets) ?? [])]) ?? [];

const normalizeMarketName = (value: string) => value.trim().toLowerCase();

const isMatchOddsMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  return name.includes('fulltime result') || name.includes('match winner') || name === '1x2';
};

const isGoalLineMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeMarketName(market.name);
  const hasGoalLine = market.values.some((value) => ['over', 'under'].includes(normalizeMarketName(value.value)) && value.handicap);
  return hasGoalLine && (name.includes('over/under') || name.includes('match goals') || name.includes('goals over'));
};

const getGoalLine = (market: ApiFootballOddsBet) => {
  const line = market.values.find((value) => value.handicap)?.handicap;
  const numeric = Number(String(line ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 999;
};

const formatMarketTitle = (market: ApiFootballOddsBet) => {
  if (isMatchOddsMarket(market)) return 'Resultado da Partida';
  if (isGoalLineMarket(market)) return `Mais/Menos ${getGoalLine(market)}`;
  if (normalizeMarketName(market.name).includes('double chance')) return 'Dupla Chance';
  return market.name;
};

const formatSelectionName = (market: ApiFootballOddsBet, value: string, game?: ApiFootballReplayGame) => {
  const normalized = normalizeMarketName(value);
  const homeName = game?.summary.homeTeam?.name ?? 'Mandante';
  const awayName = game?.summary.awayTeam?.name ?? 'Visitante';
  const line = market.values.find((item) => item.handicap)?.handicap;

  if (isMatchOddsMarket(market)) {
    if (['home', '1'].includes(normalized)) return homeName;
    if (['away', '2'].includes(normalized)) return awayName;
    if (['draw', 'x'].includes(normalized)) return 'Empate';
  }

  if (isGoalLineMarket(market)) {
    if (normalized === 'over') return `Mais de ${line}`;
    if (normalized === 'under') return `Menos de ${line}`;
  }

  if (normalizeMarketName(market.name).includes('double chance')) {
    return value
      .replace(/Home/gi, homeName)
      .replace(/Away/gi, awayName)
      .replace(/Draw/gi, 'Empate');
  }

  return value;
};

const sortMarketValues = (market: ApiFootballOddsBet) => {
  if (isGoalLineMarket(market)) {
    return [...market.values].sort((a, b) => {
      const order = { under: 0, over: 1 } as Record<string, number>;
      return (order[normalizeMarketName(a.value)] ?? 9) - (order[normalizeMarketName(b.value)] ?? 9);
    });
  }

  if (isMatchOddsMarket(market)) {
    return [...market.values].sort((a, b) => {
      const order = { home: 0, '1': 0, draw: 1, x: 1, away: 2, '2': 2 } as Record<string, number>;
      return (order[normalizeMarketName(a.value)] ?? 9) - (order[normalizeMarketName(b.value)] ?? 9);
    });
  }

  return market.values;
};

const getMarketKey = (market: ApiFootballOddsBet) =>
  `${market.id}-${market.name}-${market.values.map((value) => `${value.value}:${value.handicap ?? ''}`).join('|')}`;

const getOrderedMarkets = (snapshot?: ApiFootballReplaySnapshot) => {
  const uniqueMarkets = new Map<string, ApiFootballOddsBet>();

  getOddsMarkets(snapshot).forEach((market) => {
    uniqueMarkets.set(getMarketKey(market), market);
  });

  return [...uniqueMarkets.values()].sort((a, b) => {
    const aMatch = isMatchOddsMarket(a);
    const bMatch = isMatchOddsMarket(b);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;

    const aGoal = isGoalLineMarket(a);
    const bGoal = isGoalLineMarket(b);
    if (aGoal !== bGoal) return aGoal ? -1 : 1;
    if (aGoal && bGoal) return getGoalLine(a) - getGoalLine(b);

    return formatMarketTitle(a).localeCompare(formatMarketTitle(b), 'pt-BR');
  });
};

const getStatValue = (snapshot: ApiFootballReplaySnapshot | undefined, teamId: number | undefined, label: string) => {
  if (!snapshot || !teamId) return '-';
  const item = snapshot.statistics.find((row) => row.team.id === teamId);
  const stat = item?.statistics.find((row) => row.type.toLowerCase() === label.toLowerCase());
  return stat?.value ?? '-';
};

function ReplayGameSearch({
  games,
  selectedFixtureId,
  query,
  onQuery,
  onSelect,
}: {
  games: ApiFootballReplayGameSummary[];
  selectedFixtureId?: number;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (fixtureId: number) => void;
}) {
  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sorted = [...games].sort((a, b) => new Date(b.lastCapturedAt).getTime() - new Date(a.lastCapturedAt).getTime());

    if (!normalized) return sorted.slice(0, 12);

    return sorted
      .filter((game) =>
        `${game.homeTeam?.name ?? ''} ${game.awayTeam?.name ?? ''} ${game.league?.name ?? ''} ${game.league?.country ?? ''}`
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 16);
  }, [games, query]);

  return (
    <Card title="Partidas capturadas" subtitle="Jogos reconstruidos a partir dos snapshots gravados pelo backend.">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Buscar por time ou liga"
            className="pl-9"
          />
        </div>
        <div className="max-h-[520px] overflow-y-auto rounded-md border border-white/10 bg-ink-950">
          {filteredGames.map((game) => {
            const selected = game.fixtureId === selectedFixtureId;

            return (
              <button
                key={game.fixtureId}
                type="button"
                onClick={() => onSelect(game.fixtureId)}
                className={`block w-full border-b border-white/8 px-3 py-3 text-left transition last:border-b-0 ${
                  selected ? 'bg-electric-500/12 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {game.homeTeam?.name ?? 'Mandante'} x {game.awayTeam?.name ?? 'Visitante'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {game.league?.name ?? '-'} | {game.snapshotCount} snapshot(s)
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-ink-900 px-2 py-1 text-xs font-semibold">
                    {formatScore(game.score.home, game.score.away)}
                  </span>
                </div>
              </button>
            );
          })}
          {filteredGames.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Nenhum jogo capturado encontrado.</p>}
        </div>
      </div>
    </Card>
  );
}

function StatComparison({
  label,
  home,
  away,
}: {
  label: string;
  home: string | number | null;
  away: string | number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-3 rounded-md border border-white/8 bg-ink-900/70 px-3 py-2 text-sm">
      <span className="font-semibold text-white">{home ?? '-'}</span>
      <span className="text-center text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <span className="text-right font-semibold text-white">{away ?? '-'}</span>
    </div>
  );
}

function MarketBlock({
  market,
  game,
  collapsed,
  onToggle,
}: {
  market: ApiFootballOddsBet;
  game?: ApiFootballReplayGame;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const values = sortMarketValues(market);

  return (
    <div className="overflow-hidden rounded-md border border-white/8 bg-[#090d2b]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-[#171b46] px-3 py-2 text-left transition hover:bg-[#1d2255]"
      >
        <span>
          <span className="block text-sm font-black uppercase tracking-wide text-white">{formatMarketTitle(market)}</span>
          <span className="text-xs font-semibold text-slate-400">{values.length} selecao(oes)</span>
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          {collapsed ? 'Expandir' : 'Recolher'}
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="p-3">
          <div className="mb-2 grid grid-cols-[1fr_170px] gap-3 text-right text-xs font-black text-slate-300">
            <span />
            <span>Odd</span>
          </div>
          <div className="space-y-2">
            {values.slice(0, 16).map((value) => (
              <div key={`${value.value}-${value.handicap ?? ''}`} className="grid grid-cols-[1fr_170px] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase tracking-wide text-white">
                    {formatSelectionName(market, value.value, game)}
                  </p>
                  {value.suspended && <p className="text-xs font-semibold text-rose-300">Suspenso</p>}
                </div>
                <div className="rounded-md bg-white px-4 py-2 text-center text-[#141844]">
                  <p className="text-lg font-black">{value.odd || '-'}</p>
                </div>
              </div>
            ))}
          </div>
          {values.length > 16 && <p className="mt-3 text-right text-xs font-semibold text-slate-400">Mais {values.length - 16} selecao(oes) ocultas</p>}
        </div>
      )}
    </div>
  );
}

function OddsPanel({ snapshot, game }: { snapshot?: ApiFootballReplaySnapshot; game?: ApiFootballReplayGame }) {
  const [collapsedMarkets, setCollapsedMarkets] = useState<string[]>([]);
  const markets = getOrderedMarkets(snapshot).slice(0, 30);

  const toggleMarket = (marketKey: string) => {
    setCollapsedMarkets((current) =>
      current.includes(marketKey) ? current.filter((key) => key !== marketKey) : [...current, marketKey],
    );
  };

  return (
    <Card title="Odds do Momento" subtitle="Match odds primeiro, depois mercados de over/under gols e demais mercados.">
      <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
        {markets.length === 0 && <p className="text-sm text-slate-500">Nenhuma odd gravada neste snapshot.</p>}
        {markets.map((market) => {
          const marketKey = getMarketKey(market);

          return (
            <MarketBlock
              key={marketKey}
              market={market}
              game={game}
              collapsed={collapsedMarkets.includes(marketKey)}
              onToggle={() => toggleMarket(marketKey)}
            />
          );
        })}
      </div>
    </Card>
  );
}

function ReplayControls({
  game,
  snapshotIndex,
  playing,
  onIndex,
  onPlaying,
}: {
  game: ApiFootballReplayGame;
  snapshotIndex: number;
  playing: boolean;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
}) {
  const snapshot = game.timeline[snapshotIndex];
  const maxIndex = Math.max(0, game.timeline.length - 1);

  return (
    <Card title="Controle do replay">
      <div className="rounded-lg bg-ink-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">{game.summary.league?.name ?? '-'}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {game.summary.homeTeam?.name ?? 'Mandante'} x {game.summary.awayTeam?.name ?? 'Visitante'}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Primeiro snapshot: {formatCapturedAt(game.summary.firstCapturedAt)} | Ultimo: {formatCapturedAt(game.summary.lastCapturedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Minuto</p>
            <p className="text-3xl font-semibold text-electric-500">{formatReplayMinute(snapshot)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-sm text-slate-400">{game.summary.homeTeam?.name ?? 'Mandante'}</p>
            <p className="text-4xl font-semibold text-white">{snapshot?.score.home ?? '-'}</p>
          </div>
          <div className="self-center text-sm text-slate-500">{snapshot?.status?.long ?? 'snapshot'}</div>
          <div>
            <p className="text-sm text-slate-400">{game.summary.awayTeam?.name ?? 'Visitante'}</p>
            <p className="text-4xl font-semibold text-white">{snapshot?.score.away ?? '-'}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 text-center text-xs font-semibold text-slate-400">
            {formatCapturedAt(snapshot?.capturedAt)}
          </div>
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={snapshotIndex}
            onChange={(event) => {
              onIndex(Number(event.target.value));
              onPlaying(false);
            }}
            className="h-4 w-full cursor-pointer accent-electric-500"
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" className="px-3" onClick={() => onIndex(Math.max(0, snapshotIndex - 1))} icon={<SkipBack className="h-4 w-4" />} />
          <Button onClick={() => onPlaying(!playing)} icon={playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
            {playing ? 'Pausar' : 'Play'}
          </Button>
          <Button variant="secondary" className="px-3" onClick={() => onIndex(Math.min(maxIndex, snapshotIndex + 1))} icon={<SkipForward className="h-4 w-4" />} />
          <Button variant="ghost" className="px-3" onClick={() => onIndex(0)} icon={<RotateCcw className="h-4 w-4" />} />
        </div>
      </div>
    </Card>
  );
}

function StatsPanel({ game, snapshot }: { game?: ApiFootballReplayGame; snapshot?: ApiFootballReplaySnapshot }) {
  const homeId = game?.summary.homeTeam?.id;
  const awayId = game?.summary.awayTeam?.id;
  const labels = [
    'Gols',
    'Cartoes Amarelos',
    'Cartoes Vermelhos',
    'Substituicoes',
    'Total Shots',
    'Shots on Goal',
    'Shots off Goal',
    'Blocked Shots',
    'Corner Kicks',
    'Ball Possession',
    'Yellow Cards',
    'Red Cards',
    'Goalkeeper Saves',
    'Fouls',
    'Passes %',
  ];

  return (
    <Card title="Estatisticas da Partida" subtitle="Dados gravados no snapshot selecionado.">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <p className="font-semibold text-electric-300">{game?.summary.homeTeam?.name ?? 'Mandante'}</p>
        <p className="text-center text-slate-500">comparativo</p>
        <p className="text-right font-semibold text-violet-300">{game?.summary.awayTeam?.name ?? 'Visitante'}</p>
      </div>
      <div className="space-y-2">
        {labels.map((label) => (
          <StatComparison
            key={label}
            label={label}
            home={getStatValue(snapshot, homeId, label)}
            away={getStatValue(snapshot, awayId, label)}
          />
        ))}
      </div>
    </Card>
  );
}

export function ReplayPage({ delay }: ReplayPageProps) {
  const [query, setQuery] = useState('');
  const [selectedFixtureId, setSelectedFixtureId] = useState<number | undefined>();
  const [snapshotIndex, setSnapshotIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { data: games, loading, error } = useAsyncData(
    () => apiFootballService.buscarReplayGames(),
    [],
  );
  const activeFixtureId = selectedFixtureId ?? games?.[0]?.fixtureId;
  const {
    data: game,
    loading: gameLoading,
    error: gameError,
  } = useAsyncData(
    () => (activeFixtureId ? apiFootballService.buscarReplayGame(activeFixtureId) : Promise.resolve(undefined)),
    [activeFixtureId],
  );

  const snapshot = game?.timeline[snapshotIndex];

  useEffect(() => {
    setSnapshotIndex(0);
    setPlaying(false);
  }, [activeFixtureId]);

  useEffect(() => {
    if (!playing || !game) return;

    const interval = window.setInterval(() => {
      setSnapshotIndex((current) => {
        const next = current + 1;
        if (next >= game.timeline.length) {
          setPlaying(false);
          return current;
        }
        return next;
      });
    }, delay);

    return () => window.clearInterval(interval);
  }, [delay, game, playing]);

  return (
    <>
      <PageHeader
        title="Replay de jogos"
        description="Reconstroi partidas minuto a minuto usando os snapshots historicos gravados pelo backend."
      />

      {loading && <EmptyState title="Carregando base historica" description="Lendo snapshots gravados pelo coletor." />}
      {error && !loading && <EmptyState title="Nao foi possivel carregar o replay" description={error} />}
      {!loading && !error && (games ?? []).length === 0 && (
        <EmptyState
          title="Nenhuma partida capturada ainda"
          description="Mantenha o backend rodando para o coletor gravar fixtures, estatisticas e odds. Os jogos aparecem aqui conforme os snapshots forem acumulando."
        />
      )}

      {!loading && !error && (games ?? []).length > 0 && (
        <div className="space-y-5">
            {gameLoading && <EmptyState title="Abrindo partida" description="Montando timeline da partida selecionada." />}
            {gameError && !gameLoading && <EmptyState title="Nao foi possivel abrir a partida" description={gameError} />}
            {game && !gameLoading && (
              <>
                <ReplayControls
                  game={game}
                  snapshotIndex={Math.min(snapshotIndex, Math.max(0, game.timeline.length - 1))}
                  playing={playing}
                  onIndex={setSnapshotIndex}
                  onPlaying={setPlaying}
                />
                <div className="grid gap-5 xl:grid-cols-2">
                  <StatsPanel game={game} snapshot={snapshot} />
                  <OddsPanel snapshot={snapshot} game={game} />
                </div>
              </>
            )}
          <ReplayGameSearch
            games={games ?? []}
            selectedFixtureId={activeFixtureId}
            query={query}
            onQuery={setQuery}
            onSelect={setSelectedFixtureId}
          />
        </div>
      )}
    </>
  );
}
