import { apiFootballService } from './apiFootball';
import { Game, GameSnapshot, LiveStats } from '../types';
import { ApiFootballOddsBet, ApiFootballReplayGame, ApiFootballReplaySnapshot } from '../types/api';

const FALLBACK_ODD = 1.01;
const MAX_REPLAY_GAMES = 200;

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

const sumStat = (snapshot: ApiFootballReplaySnapshot, labels: string[]) =>
  snapshot.statistics?.reduce((sum, teamStats) => {
    const item = teamStats.statistics?.find((stat) =>
      labels.some((label) => normalizeText(stat.type) === normalizeText(label)),
    );

    return sum + toNumber(item?.value, 0);
  }, 0) ?? 0;

const buildStats = (snapshot: ApiFootballReplaySnapshot): LiveStats => {
  const shots = sumStat(snapshot, ['Total Shots', 'Total de Chutes']);
  const shotsOnTarget = sumStat(snapshot, ['Shots on Goal', 'Chutes no Gol']);
  const dangerousAttacks = sumStat(snapshot, ['Dangerous Attacks', 'Ataques Perigosos']);
  const corners = sumStat(snapshot, ['Corner Kicks', 'Escanteios']);
  const possession = sumStat(snapshot, ['Ball Possession', 'Posse de Bola']);
  const yellowCards = sumStat(snapshot, ['Yellow Cards', 'Cartoes Amarelos']);
  const redCards = sumStat(snapshot, ['Red Cards', 'Cartoes Vermelhos']);

  return {
    shots,
    shotsOnTarget,
    dangerousAttacks,
    corners,
    possession,
    cards: yellowCards + redCards,
    offensivePressure: dangerousAttacks + shotsOnTarget,
    recentShots: shots,
  };
};

const getSnapshotOdds = (snapshot: ApiFootballReplaySnapshot, previous?: GameSnapshot) => ({
  homeOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['home', '1']) ?? previous?.homeOdd ?? FALLBACK_ODD,
  drawOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['draw', 'x', 'empate']) ?? previous?.drawOdd ?? FALLBACK_ODD,
  awayOdd: findMarketOdd(snapshot, isMatchOddsMarket, ['away', '2']) ?? previous?.awayOdd ?? FALLBACK_ODD,
  over15Odd: findMarketOdd(snapshot, isGoalLineMarket, ['over', 'mais'], 1.5) ?? previous?.over15Odd ?? FALLBACK_ODD,
  over25Odd: findMarketOdd(snapshot, isGoalLineMarket, ['over', 'mais'], 2.5) ?? previous?.over25Odd ?? FALLBACK_ODD,
  under25Odd: findMarketOdd(snapshot, isGoalLineMarket, ['under', 'menos'], 2.5) ?? previous?.under25Odd ?? FALLBACK_ODD,
  bttsOdd: findMarketOdd(snapshot, isBothTeamsScoreMarket, ['yes', 'sim']) ?? previous?.bttsOdd ?? FALLBACK_ODD,
});

const convertSnapshot = (snapshot: ApiFootballReplaySnapshot, previous?: GameSnapshot): GameSnapshot => ({
  minute: snapshot.minute ?? 0,
  scoreHome: snapshot.score?.home ?? 0,
  scoreAway: snapshot.score?.away ?? 0,
  ...getSnapshotOdds(snapshot, previous),
  stats: buildStats(snapshot),
  events: snapshot.events?.map((event) => [event.type, event.detail].filter(Boolean).join(' ')) ?? [],
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
      averageGoals: replayGame.summary.score ? (replayGame.summary.score.home ?? 0) + (replayGame.summary.score.away ?? 0) : 0,
      averageCorners: first.stats.corners,
      h2hGoals: 0,
      tablePositionGap: 0,
      favoritism: Math.abs(first.homeOdd - first.awayOdd),
    },
    snapshots,
  };
};

export const loadHistoricalBacktestGames = async (limit = MAX_REPLAY_GAMES): Promise<Game[]> => {
  const summaries = await apiFootballService.buscarReplayGames();
  const selectedSummaries = summaries.slice(0, limit);
  const games: Game[] = [];

  for (const summary of selectedSummaries) {
    const replayGame = await apiFootballService.buscarReplayGame(summary.fixtureId);
    const game = convertReplayGameToBacktestGame(replayGame);
    if (game) games.push(game);
  }

  return games;
};
