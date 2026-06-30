import { apiFootballService } from './apiFootball';
import { enrichGamesWithHistoricalPreLiveStats } from './historicalStatsService';
import { Game, GameSnapshot, LiveStats, TeamLiveStats } from '../types';
import { ApiFootballOddsBet, ApiFootballReplayGame, ApiFootballReplaySnapshot } from '../types/api';

const MAX_REPLAY_GAMES = 80;
const REPLAY_GAME_CONCURRENCY = 8;

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(String(value ?? '').replace('%', '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toOdd = (value: unknown) => {
  const odd = toNumber(value, Number.NaN);
  return Number.isFinite(odd) && odd > 1 ? Number(odd.toFixed(2)) : undefined;
};

const getOddsMarkets = (snapshot: ApiFootballReplaySnapshot): ApiFootballOddsBet[] =>
  snapshot.odds?.flatMap((item) => [...(item.odds ?? []), ...(item.bookmakers?.flatMap((bookmaker) => bookmaker.bets) ?? [])]) ?? [];

const flattenHistoricalOdds = (snapshot: ApiFootballReplaySnapshot) =>
  getOddsMarkets(snapshot).flatMap((market) =>
    market.values
      .map((value) => ({
        marketName: market.name,
        value: value.value,
        handicap: value.handicap,
        odd: toOdd(value.odd),
      }))
      .filter((value): value is { marketName: string; value: string; handicap: string | null | undefined; odd: number } => value.odd !== undefined),
  );

const isMatchOddsMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeText(market.name);
  return name.includes('fulltime result') || name.includes('match winner') || name === '1x2' || name.includes('resultado');
};

const isGoalLineMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeText(market.name);
  const hasGoalLine = market.values.some((value) => ['over', 'under', 'mais', 'menos'].includes(normalizeText(value.value)) && value.handicap);
  return hasGoalLine && (name.includes('over/under') || name.includes('match goals') || name.includes('goals over') || name.includes('total goals'));
};

const isBothTeamsScoreMarket = (market: ApiFootballOddsBet) => {
  const name = normalizeText(market.name);
  return name === 'both teams to score' || name.includes('ambas marcam') || name.includes('btts');
};

const selectionMatches = (value: string, candidates: string[]) => {
  const normalized = normalizeText(value);
  return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
};

const findMarketOdd = (
  snapshot: ApiFootballReplaySnapshot,
  predicate: (market: ApiFootballOddsBet) => boolean,
  selectionCandidates: string[],
  handicap?: number,
) => {
  for (const market of getOddsMarkets(snapshot)) {
    if (!predicate(market)) continue;

    const value = market.values.find((item) => {
      const handicapMatches =
        handicap === undefined || Math.abs(toNumber(item.handicap, Number.NaN) - handicap) < 0.001;
      return handicapMatches && selectionMatches(item.value, selectionCandidates);
    });

    const odd = toOdd(value?.odd);
    if (odd) return odd;
  }

  return undefined;
};

const sumStat = (snapshot: ApiFootballReplaySnapshot, labels: string[]) => {
  let found = false;
  const sum = snapshot.statistics?.reduce((total, teamStats) => {
    const item = teamStats.statistics?.find((stat) =>
      labels.some((label) => normalizeText(stat.type) === normalizeText(label)),
    );

    if (item?.value === undefined || item.value === null) return total;
    const value = toNumber(item.value, Number.NaN);
    if (!Number.isFinite(value)) return total;
    found = true;
    return total + value;
  }, 0);

  return found ? sum : undefined;
};

const getTeamStat = (snapshot: ApiFootballReplaySnapshot, teamId: number | undefined, labels: string[]) => {
  if (!teamId) return undefined;
  const teamStats = snapshot.statistics?.find((item) => item.team.id === teamId);
  const stat = teamStats?.statistics?.find((item) =>
    labels.some((label) => normalizeText(item.type) === normalizeText(label)),
  );

  if (stat?.value === undefined || stat.value === null) return undefined;
  return toNumber(stat.value, Number.NaN);
};

const buildTeamStats = (snapshot: ApiFootballReplaySnapshot, teamId: number | undefined): TeamLiveStats => {
  const yellowCards = getTeamStat(snapshot, teamId, ['Yellow Cards', 'Cartoes Amarelos']);
  const redCards = getTeamStat(snapshot, teamId, ['Red Cards', 'Cartoes Vermelhos']);
  const cards =
    yellowCards === undefined && redCards === undefined
      ? undefined
      : (yellowCards ?? 0) + (redCards ?? 0);

  return {
    shots: getTeamStat(snapshot, teamId, ['Total Shots', 'Total de Chutes']),
    shotsOnTarget: getTeamStat(snapshot, teamId, ['Shots on Goal', 'Chutes no Gol']),
    dangerousAttacks: getTeamStat(snapshot, teamId, ['Dangerous Attacks', 'Ataques Perigosos']),
    attacks: getTeamStat(snapshot, teamId, ['Attacks', 'Ataques']),
    corners: getTeamStat(snapshot, teamId, ['Corner Kicks', 'Escanteios']),
    possession: getTeamStat(snapshot, teamId, ['Ball Possession', 'Posse de Bola']),
    yellowCards,
    redCards,
    cards,
  };
};

const buildStats = (snapshot: ApiFootballReplaySnapshot): LiveStats => {
  const homeTeamId = snapshot.fixture?.teams?.home?.id;
  const awayTeamId = snapshot.fixture?.teams?.away?.id;
  const home = buildTeamStats(snapshot, homeTeamId);
  const away = buildTeamStats(snapshot, awayTeamId);
  const shots = sumStat(snapshot, ['Total Shots', 'Total de Chutes']);
  const shotsOnTarget = sumStat(snapshot, ['Shots on Goal', 'Chutes no Gol']);
  const dangerousAttacks = sumStat(snapshot, ['Dangerous Attacks', 'Ataques Perigosos']);
  const attacks = sumStat(snapshot, ['Attacks', 'Ataques']);
  const corners = sumStat(snapshot, ['Corner Kicks', 'Escanteios']);
  const possession = sumStat(snapshot, ['Ball Possession', 'Posse de Bola']);
  const yellowCards = sumStat(snapshot, ['Yellow Cards', 'Cartoes Amarelos']);
  const redCards = sumStat(snapshot, ['Red Cards', 'Cartoes Vermelhos']);
  const cards =
    yellowCards === undefined && redCards === undefined
      ? undefined
      : (yellowCards ?? 0) + (redCards ?? 0);
  const offensivePressure =
    dangerousAttacks === undefined && shotsOnTarget === undefined
      ? undefined
      : (dangerousAttacks ?? 0) + (shotsOnTarget ?? 0);

  return {
    shots,
    shotsOnTarget,
    dangerousAttacks,
    attacks,
    corners,
    possession,
    cards,
    offensivePressure,
    recentShots: shots,
    home,
    away,
  };
};

const getSnapshotOdds = (snapshot: ApiFootballReplaySnapshot, previous?: GameSnapshot) => ({
  homeOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['home', '1']) ?? previous?.homeOdd,
  drawOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['draw', 'x', 'empate']) ?? previous?.drawOdd,
  awayOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['away', '2']) ?? previous?.awayOdd,
  over15Odd: findMarketOdd(snapshot, isGoalLineMarket, ['over', 'mais'], 1.5) ?? previous?.over15Odd,
  over25Odd: findMarketOdd(snapshot, isGoalLineMarket, ['over', 'mais'], 2.5) ?? previous?.over25Odd,
  under25Odd: findMarketOdd(snapshot, isGoalLineMarket, ['under', 'menos'], 2.5) ?? previous?.under25Odd,
  bttsOdd: findMarketOdd(snapshot, isBothTeamsScoreMarket, ['yes', 'sim']) ?? previous?.bttsOdd,
});

const convertSnapshot = (snapshot: ApiFootballReplaySnapshot, previous?: GameSnapshot): GameSnapshot => ({
  capturedAt: snapshot.capturedAt,
  fixtureDate: snapshot.fixture?.fixture?.date,
  minute: snapshot.minute ?? 0,
  scoreHome: snapshot.score?.home ?? 0,
  scoreAway: snapshot.score?.away ?? 0,
  halfTimeScoreHome: snapshot.fixture?.score?.halftime?.home,
  halfTimeScoreAway: snapshot.fixture?.score?.halftime?.away,
  ...getSnapshotOdds(snapshot, previous),
  stats: buildStats(snapshot),
  events: snapshot.events?.map((event) => [event.type, event.detail].filter(Boolean).join(' ')) ?? [],
  odds: flattenHistoricalOdds(snapshot),
});

export const convertReplayGameToBacktestGame = (replayGame: ApiFootballReplayGame): Game | undefined => {
  const timeline = replayGame.timeline ?? [];
  if (timeline.length === 0) return undefined;

  const snapshots: GameSnapshot[] = [];
  timeline.forEach((snapshot) => {
    snapshots.push(convertSnapshot(snapshot, snapshots[snapshots.length - 1]));
  });

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (!first || !last) return undefined;

  return {
    id: String(replayGame.summary.fixtureId),
    league: replayGame.summary.league?.name ?? 'Liga desconhecida',
    homeTeam: replayGame.summary.homeTeam?.name ?? 'Mandante',
    awayTeam: replayGame.summary.awayTeam?.name ?? 'Visitante',
    status: 'historico',
    currentMinute: last.minute,
    fixtureDate: timeline[0]?.fixture?.fixture?.date ?? replayGame.summary.firstCapturedAt,
    finalScoreHome: replayGame.summary.score?.home ?? last.scoreHome,
    finalScoreAway: replayGame.summary.score?.away ?? last.scoreAway,
    preLive: {
      homeOdd: first.homeOdd,
      drawOdd: first.drawOdd,
      awayOdd: first.awayOdd,
      over15Odd: first.over15Odd,
      over25Odd: first.over25Odd,
      under25Odd: first.under25Odd,
      bttsOdd: first.bttsOdd,
      season: replayGame.summary.league?.season,
      h2hGoals: undefined,
      tablePositionGap: undefined,
      favoritism: undefined,
    },
    snapshots,
  };
};

export const loadHistoricalBacktestGames = async (limit = MAX_REPLAY_GAMES): Promise<Game[]> => {
  const summaries = await apiFootballService.buscarReplayGames();
  const selectedSummaries = summaries.slice(0, limit);
  const games: Game[] = [];

  for (let index = 0; index < selectedSummaries.length; index += REPLAY_GAME_CONCURRENCY) {
    const batch = selectedSummaries.slice(index, index + REPLAY_GAME_CONCURRENCY);
    const convertedGames = await Promise.all(
      batch.map(async (summary) => {
        const replayGame = await apiFootballService.buscarReplayGame(summary.fixtureId);
        return convertReplayGameToBacktestGame(replayGame);
      }),
    );
    games.push(...convertedGames.filter((game): game is Game => Boolean(game)));
  }

  return enrichGamesWithHistoricalPreLiveStats(games);
};
