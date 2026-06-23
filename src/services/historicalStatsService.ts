import { Game, PreLiveDifferences, PreLiveOdds, TeamHistoricalStats, TeamPreLiveHistory } from '../types';

const MIN_SAMPLES = {
  season: 5,
  last5: 3,
  last10: 6,
  homeAway: 3,
};

const FAVORITE_NONE_DIFF = 0.05;

type TeamSide = 'home' | 'away';
type TeamRef = TeamSide | 'favorite' | 'underdog' | 'combined';
type HistoryWindow = 'season' | 'last5' | 'last10' | 'homeOnly' | 'awayOnly';

type TeamGameRecord = {
  game: Game;
  teamName: string;
  side: TeamSide;
  goalsFor: number;
  goalsAgainst: number;
  totalGoals: number;
  won: boolean;
  drew: boolean;
  lost: boolean;
  points: number;
  btts: boolean;
  over05: boolean;
  over15: boolean;
  over25: boolean;
  over35: boolean;
  corners?: number;
  cards?: number;
  shots?: number;
  shotsOnTarget?: number;
};

const toDateTime = (game: Game) => {
  const value = game.fixtureDate ?? game.snapshots[0]?.fixtureDate ?? game.snapshots[0]?.capturedAt;
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
};

const pct = (count: number, total: number) => (total > 0 ? Number(((count / total) * 100).toFixed(2)) : undefined);

const avg = (values: Array<number | undefined>) => {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return numbers.length > 0 ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2)) : undefined;
};

const getTeamStatsFromFinalSnapshot = (game: Game, side: TeamSide) => {
  const finalSnapshot = game.snapshots[game.snapshots.length - 1];
  return finalSnapshot?.stats?.[side];
};

const getRecordForSide = (game: Game, side: TeamSide): TeamGameRecord => {
  const isHome = side === 'home';
  const goalsFor = isHome ? game.finalScoreHome : game.finalScoreAway;
  const goalsAgainst = isHome ? game.finalScoreAway : game.finalScoreHome;
  const stats = getTeamStatsFromFinalSnapshot(game, side);

  return {
    game,
    teamName: isHome ? game.homeTeam : game.awayTeam,
    side,
    goalsFor,
    goalsAgainst,
    totalGoals: goalsFor + goalsAgainst,
    won: goalsFor > goalsAgainst,
    drew: goalsFor === goalsAgainst,
    lost: goalsFor < goalsAgainst,
    points: goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0,
    btts: goalsFor > 0 && goalsAgainst > 0,
    over05: goalsFor + goalsAgainst > 0.5,
    over15: goalsFor + goalsAgainst > 1.5,
    over25: goalsFor + goalsAgainst > 2.5,
    over35: goalsFor + goalsAgainst > 3.5,
    corners: stats?.corners,
    cards: stats?.cards,
    shots: stats?.shots,
    shotsOnTarget: stats?.shotsOnTarget,
  };
};

const getTeamRecordsBeforeGame = (games: Game[], currentGame: Game, teamName: string) => {
  const currentTime = toDateTime(currentGame);

  return games
    .filter((game) => game.id !== currentGame.id && toDateTime(game) < currentTime)
    .flatMap((game) => {
      const records: TeamGameRecord[] = [];
      if (game.homeTeam === teamName) records.push(getRecordForSide(game, 'home'));
      if (game.awayTeam === teamName) records.push(getRecordForSide(game, 'away'));
      return records;
    })
    .sort((a, b) => toDateTime(b.game) - toDateTime(a.game));
};

const streak = (records: TeamGameRecord[], predicate: (record: TeamGameRecord) => boolean) => {
  let count = 0;
  for (const record of records) {
    if (!predicate(record)) break;
    count += 1;
  }
  return count;
};

const summarizeRecords = (records: TeamGameRecord[], minSamples: number): TeamHistoricalStats | undefined => {
  if (records.length < minSamples) return undefined;

  const wins = records.filter((record) => record.won).length;
  const draws = records.filter((record) => record.drew).length;
  const losses = records.filter((record) => record.lost).length;
  const points = records.reduce((sum, record) => sum + record.points, 0);

  return {
    games: records.length,
    wins,
    draws,
    losses,
    points,
    pointsAvg: Number((points / records.length).toFixed(2)),
    goalsForAvg: avg(records.map((record) => record.goalsFor)),
    goalsAgainstAvg: avg(records.map((record) => record.goalsAgainst)),
    totalGoalsAvg: avg(records.map((record) => record.totalGoals)),
    bttsPercent: pct(records.filter((record) => record.btts).length, records.length),
    over05Percent: pct(records.filter((record) => record.over05).length, records.length),
    over15Percent: pct(records.filter((record) => record.over15).length, records.length),
    over25Percent: pct(records.filter((record) => record.over25).length, records.length),
    over35Percent: pct(records.filter((record) => record.over35).length, records.length),
    under25Percent: pct(records.filter((record) => !record.over25).length, records.length),
    under35Percent: pct(records.filter((record) => !record.over35).length, records.length),
    cornersAvg: avg(records.map((record) => record.corners)),
    cardsAvg: avg(records.map((record) => record.cards)),
    shotsAvg: avg(records.map((record) => record.shots)),
    shotsOnTargetAvg: avg(records.map((record) => record.shotsOnTarget)),
    cleanSheetsPercent: pct(records.filter((record) => record.goalsAgainst === 0).length, records.length),
    failedToScorePercent: pct(records.filter((record) => record.goalsFor === 0).length, records.length),
    winningStreak: streak(records, (record) => record.won),
    unbeatenStreak: streak(records, (record) => !record.lost),
    winlessStreak: streak(records, (record) => !record.won),
    scoringStreak: streak(records, (record) => record.goalsFor > 0),
    concedingStreak: streak(records, (record) => record.goalsAgainst > 0),
    bttsStreak: streak(records, (record) => record.btts),
    over15Streak: streak(records, (record) => record.over15),
    over25Streak: streak(records, (record) => record.over25),
  };
};

const buildTeamHistory = (records: TeamGameRecord[], homeAwaySide: TeamSide): TeamPreLiveHistory => ({
  season: summarizeRecords(records, MIN_SAMPLES.season),
  last5: summarizeRecords(records.slice(0, 5), MIN_SAMPLES.last5),
  last10: summarizeRecords(records.slice(0, 10), MIN_SAMPLES.last10),
  homeOnly: homeAwaySide === 'home' ? summarizeRecords(records.filter((record) => record.side === 'home'), MIN_SAMPLES.homeAway) : undefined,
  awayOnly: homeAwaySide === 'away' ? summarizeRecords(records.filter((record) => record.side === 'away'), MIN_SAMPLES.homeAway) : undefined,
});

const getFavoriteSide = (homeOdd: number, awayOdd: number): 'home' | 'away' | 'none' => {
  if (!Number.isFinite(homeOdd) || !Number.isFinite(awayOdd)) return 'none';
  if (Math.abs(homeOdd - awayOdd) < FAVORITE_NONE_DIFF) return 'none';
  return homeOdd < awayOdd ? 'home' : 'away';
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getSnapshotOdd = (game: Game, matcher: (marketName: string, value: string, handicap?: string | null) => boolean) => {
  const firstSnapshot = game.snapshots[0];
  return firstSnapshot?.odds?.find((item) => matcher(item.marketName, item.value, item.handicap))?.odd;
};

const isFullTimeGoalMarket = (marketName: string) => {
  const market = normalizeText(marketName);
  const isGoalMarket = market.includes('over/under') || market.includes('match goals') || market.includes('total goals');
  const isFirstHalf = market.includes('1st half') || market.includes('first half');
  return isGoalMarket && !isFirstHalf;
};

const isFirstHalfGoalMarket = (marketName: string) => {
  const market = normalizeText(marketName);
  return (market.includes('over/under') || market.includes('total goals')) && (market.includes('1st half') || market.includes('first half'));
};

const getGoalOdd = (game: Game, side: 'over' | 'under', line: string, half: 'ft' | 'ht') =>
  getSnapshotOdd(game, (marketName, value, handicap) => {
    const marketMatches = half === 'ft' ? isFullTimeGoalMarket(marketName) : isFirstHalfGoalMarket(marketName);
    return marketMatches && normalizeText(value).includes(side) && String(handicap ?? '').replace(',', '.') === line;
  });

const getBttsOdd = (game: Game, value: 'yes' | 'no') =>
  getSnapshotOdd(game, (marketName, selection) => normalizeText(marketName).includes('both teams') && normalizeText(selection) === value);

const getPreLiveOdds = (game: Game): PreLiveOdds => {
  const favoriteSide = getFavoriteSide(game.preLive.homeOdd, game.preLive.awayOdd);
  const favoriteOdd = favoriteSide === 'home' ? game.preLive.homeOdd : favoriteSide === 'away' ? game.preLive.awayOdd : undefined;
  const underdogOdd = favoriteSide === 'home' ? game.preLive.awayOdd : favoriteSide === 'away' ? game.preLive.homeOdd : undefined;

  return {
    home: game.preLive.homeOdd,
    draw: game.preLive.drawOdd,
    away: game.preLive.awayOdd,
    favorite: favoriteOdd,
    underdog: underdogOdd,
    over05: getGoalOdd(game, 'over', '0.5', 'ft'),
    over15: game.preLive.over15Odd,
    over25: game.preLive.over25Odd,
    over35: getGoalOdd(game, 'over', '3.5', 'ft'),
    under05: getGoalOdd(game, 'under', '0.5', 'ft'),
    under15: getGoalOdd(game, 'under', '1.5', 'ft'),
    under25: game.preLive.under25Odd,
    under35: getGoalOdd(game, 'under', '3.5', 'ft'),
    bttsYes: game.preLive.bttsOdd,
    bttsNo: getBttsOdd(game, 'no'),
    over05HT: getGoalOdd(game, 'over', '0.5', 'ht'),
    over15HT: getGoalOdd(game, 'over', '1.5', 'ht'),
    under05HT: getGoalOdd(game, 'under', '0.5', 'ht'),
    under15HT: getGoalOdd(game, 'under', '1.5', 'ht'),
  };
};

const getHistoryByReference = (home: TeamPreLiveHistory, away: TeamPreLiveHistory, favoriteSide: 'home' | 'away' | 'none', reference: TeamRef) => {
  if (reference === 'home') return home;
  if (reference === 'away') return away;
  if (reference === 'favorite') return favoriteSide === 'home' ? home : favoriteSide === 'away' ? away : undefined;
  if (reference === 'underdog') return favoriteSide === 'home' ? away : favoriteSide === 'away' ? home : undefined;
  return undefined;
};

const getStatsForWindow = (history: TeamPreLiveHistory | undefined, window: HistoryWindow) => history?.[window];

const averageDefined = (a: number | undefined, b: number | undefined) =>
  a === undefined || b === undefined ? undefined : Number(((a + b) / 2).toFixed(2));

const buildDifferences = (home: TeamPreLiveHistory, away: TeamPreLiveHistory): PreLiveDifferences => ({
  formPointsLast5:
    home.last5?.points === undefined || away.last5?.points === undefined ? undefined : home.last5.points - away.last5.points,
  goalsForSeason:
    home.season?.goalsForAvg === undefined || away.season?.goalsForAvg === undefined ? undefined : Number((home.season.goalsForAvg - away.season.goalsForAvg).toFixed(2)),
  goalsAgainstSeason:
    home.season?.goalsAgainstAvg === undefined || away.season?.goalsAgainstAvg === undefined
      ? undefined
      : Number((home.season.goalsAgainstAvg - away.season.goalsAgainstAvg).toFixed(2)),
  bttsPercent:
    home.season?.bttsPercent === undefined || away.season?.bttsPercent === undefined ? undefined : Number((home.season.bttsPercent - away.season.bttsPercent).toFixed(2)),
  over25Percent:
    home.season?.over25Percent === undefined || away.season?.over25Percent === undefined
      ? undefined
      : Number((home.season.over25Percent - away.season.over25Percent).toFixed(2)),
});

export const enrichGamesWithHistoricalPreLiveStats = (games: Game[]) => {
  const sortedGames = [...games].sort((a, b) => toDateTime(a) - toDateTime(b));

  return games.map((game) => {
    const homeRecords = getTeamRecordsBeforeGame(sortedGames, game, game.homeTeam);
    const awayRecords = getTeamRecordsBeforeGame(sortedGames, game, game.awayTeam);
    const home = buildTeamHistory(homeRecords, 'home');
    const away = buildTeamHistory(awayRecords, 'away');
    const odds = getPreLiveOdds(game);
    const favoriteSide = getFavoriteSide(game.preLive.homeOdd, game.preLive.awayOdd);
    const favoriteOdd = favoriteSide === 'home' ? game.preLive.homeOdd : favoriteSide === 'away' ? game.preLive.awayOdd : undefined;
    const underdogOdd = favoriteSide === 'home' ? game.preLive.awayOdd : favoriteSide === 'away' ? game.preLive.homeOdd : undefined;

    return {
      ...game,
      preLive: {
        ...game.preLive,
        odds,
        home,
        away,
        favorite: {
          side: favoriteSide,
          odd: favoriteOdd,
          underdogOdd,
          favoritismPercent:
            favoriteOdd && underdogOdd ? Number(((1 / favoriteOdd / (1 / favoriteOdd + 1 / underdogOdd)) * 100).toFixed(2)) : undefined,
        },
        differences: {
          ...game.preLive.differences,
          ...buildDifferences(home, away),
        },
        averageGoals: averageDefined(home.season?.totalGoalsAvg, away.season?.totalGoalsAvg),
        averageCorners: averageDefined(home.season?.cornersAvg, away.season?.cornersAvg),
        favoritism: favoriteOdd && underdogOdd ? Number(Math.abs(underdogOdd - favoriteOdd).toFixed(2)) : undefined,
      },
    };
  });
};

export const getPreLiveHistoricalStat = (
  game: Game,
  reference: TeamRef,
  window: HistoryWindow,
  field: keyof TeamHistoricalStats,
) => {
  if (reference === 'combined') {
    const homeValue = getStatsForWindow(game.preLive.home, window)?.[field];
    const awayValue = getStatsForWindow(game.preLive.away, window)?.[field];
    if (typeof homeValue !== 'number' || typeof awayValue !== 'number') return undefined;
    return Number(((homeValue + awayValue) / 2).toFixed(2));
  }

  const history = getHistoryByReference(game.preLive.home ?? {}, game.preLive.away ?? {}, game.preLive.favorite?.side ?? 'none', reference);
  const value = getStatsForWindow(history, window)?.[field];
  return typeof value === 'number' ? value : undefined;
};
