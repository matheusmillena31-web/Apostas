import { Bot, Game, PreLiveOdds, TeamHistoricalStats } from '../types';
import { getPreLiveHistoricalStat } from './historicalStatsService';

type HistoryWindow = 'season' | 'last5' | 'last10' | 'homeOnly' | 'awayOnly';

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getOddsField = (odds: PreLiveOdds | undefined, field: string) => odds?.[field as keyof PreLiveOdds];

const getGoalOddField = (type: 'over' | 'under', line: string, half: 'ft' | 'ht') => {
  const suffix = line.replace('.', '');
  const prefix = half === 'ht' ? `${type}${suffix}HT` : `${type}${suffix}`;
  return prefix as keyof PreLiveOdds;
};

const getPreLiveOddForMarket = (game: Game, marketName?: string) => {
  const market = normalizeText(marketName);
  const odds = game.preLive.odds;
  if (!odds) return undefined;

  if (market.includes('casa') || market.includes('mandante') || market.includes('home')) return odds.home;
  if (market.includes('fora') || market.includes('visitante') || market.includes('away')) return odds.away;
  if (market.includes('empate') || market.includes('draw')) return odds.draw;
  if (market.includes('favorito')) return odds.favorite;
  if (market.includes('zebra') || market.includes('underdog')) return odds.underdog;
  if (market.includes('btts') || market.includes('ambas')) return market.includes('nao') || market.includes('não') || market.includes('no') ? odds.bttsNo : odds.bttsYes;

  const goalMatch = market.match(/(over|under)[^\d]*(\d+(?:[.,]\d+)?)/);
  if (goalMatch) {
    const type = goalMatch[1] as 'over' | 'under';
    const line = goalMatch[2].replace(',', '.');
    const half = market.includes(' ht') || market.includes('1o tempo') || market.includes('1º tempo') ? 'ht' : 'ft';
    return odds[getGoalOddField(type, line, half)];
  }

  return undefined;
};

const getStatField = (metric: string): keyof TeamHistoricalStats | undefined => {
  const fields: Record<string, keyof TeamHistoricalStats> = {
    goalsFor: 'goalsForAvg',
    goalsAgainst: 'goalsAgainstAvg',
    totalGoals: 'totalGoalsAvg',
    btts: 'bttsPercent',
    corners: 'cornersAvg',
    cards: 'cardsAvg',
    shots: 'shotsAvg',
    shotsOnTarget: 'shotsOnTargetAvg',
  };

  return fields[metric];
};

const getOverUnderField = (type: string, line: string): keyof TeamHistoricalStats | undefined => {
  const suffix = line.replace('.', '');
  const key = `${type}${suffix}Percent`;
  if (key === 'over05Percent' || key === 'over15Percent' || key === 'over25Percent' || key === 'over35Percent') return key;
  if (key === 'under25Percent' || key === 'under35Percent') return key;
  return undefined;
};

const getHomeAwayStat = (game: Game, reference: string, window: HistoryWindow, field: keyof TeamHistoricalStats) => {
  const history = reference === 'home' ? game.preLive.home : game.preLive.away;
  const value = history?.[window]?.[field];
  return typeof value === 'number' ? value : undefined;
};

const getFavoriteValue = (game: Game, parameter: string) => {
  const favorite = game.preLive.favorite;
  if (!favorite) return undefined;

  const homeIsFavorite = favorite.side === 'home';
  const awayIsFavorite = favorite.side === 'away';

  switch (parameter) {
    case 'pre:favorite:isHome':
      return homeIsFavorite ? 1 : 0;
    case 'pre:favorite:isAway':
      return awayIsFavorite ? 1 : 0;
    case 'pre:underdog:isHome':
      return awayIsFavorite ? 1 : 0;
    case 'pre:underdog:isAway':
      return homeIsFavorite ? 1 : 0;
    case 'pre:favorite:oddDiff':
      return favorite.odd !== undefined && favorite.underdogOdd !== undefined ? Number(Math.abs(favorite.underdogOdd - favorite.odd).toFixed(2)) : undefined;
    case 'pre:favorite:percent':
      return favorite.favoritismPercent;
    case 'pre:favorite:odd':
      return favorite.odd;
    case 'pre:underdog:odd':
      return favorite.underdogOdd;
    case 'pre:favorite:betterTablePosition':
    case 'pre:underdog:betterTablePosition':
      return undefined;
    default:
      return undefined;
  }
};

const getDifferenceValue = (game: Game, parameter: string) => {
  const differences = game.preLive.differences;
  const field = parameter.replace('pre:diff:', '') as keyof NonNullable<Game['preLive']['differences']>;
  const value = differences?.[field];
  return typeof value === 'number' ? value : undefined;
};

export const resolvePreLiveRuleValue = (ruleParameter: string, bot: Bot, game: Game, fallbackOdd: number): unknown => {
  if (ruleParameter.startsWith('pre:odds:')) {
    const field = ruleParameter.replace('pre:odds:', '');
    return getOddsField(game.preLive.odds, field);
  }

  if (ruleParameter.startsWith('pre:favorite:') || ruleParameter.startsWith('pre:underdog:')) {
    return getFavoriteValue(game, ruleParameter);
  }

  if (ruleParameter.startsWith('pre:diff:')) return getDifferenceValue(game, ruleParameter);

  const statMatch = ruleParameter.match(/^pre:(goalsFor|goalsAgainst|totalGoals|btts|corners|cards|shots|shotsOnTarget):([^:]+):([^:]+)$/);
  if (statMatch) {
    const field = getStatField(statMatch[1]);
    return field ? getPreLiveHistoricalStat(game, statMatch[2] as never, statMatch[3] as never, field) : undefined;
  }

  const overUnderMatch = ruleParameter.match(/^pre:(over|under):([^:]+):(\d+(?:\.\d+)?):([^:]+)$/);
  if (overUnderMatch) {
    const field = getOverUnderField(overUnderMatch[1], overUnderMatch[3]);
    return field ? getPreLiveHistoricalStat(game, overUnderMatch[2] as never, overUnderMatch[4] as never, field) : undefined;
  }

  const homeAwayMatch = ruleParameter.match(/^pre:homeAway:(home|away):(homeOnly|awayOnly):([^:]+)$/);
  if (homeAwayMatch) return getHomeAwayStat(game, homeAwayMatch[1], homeAwayMatch[2] as HistoryWindow, homeAwayMatch[3] as keyof TeamHistoricalStats);

  const formMatch = ruleParameter.match(/^pre:form:(wins|draws|losses|points):(home|away|favorite|underdog):last5$/);
  if (formMatch) return getPreLiveHistoricalStat(game, formMatch[2] as never, 'last5', formMatch[1] as keyof TeamHistoricalStats);

  const streakMatch = ruleParameter.match(/^pre:streak:([^:]+):(home|away)$/);
  if (streakMatch) return getPreLiveHistoricalStat(game, streakMatch[2] as never, 'season', streakMatch[1] as keyof TeamHistoricalStats);

  const legacyValues: Record<string, unknown> = {
    championship: game.league,
    season: game.preLive.season,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    tablePosition: game.preLive.tablePositionGap,
    performance: game.preLive.differences?.performance,
    averageGoals: game.preLive.averageGoals,
    averageCorners: game.preLive.averageCorners,
    averageCards: getPreLiveHistoricalStat(game, 'combined', 'season', 'cardsAvg'),
    winningStreak: getPreLiveHistoricalStat(game, 'home', 'season', 'winningStreak'),
    losingStreak: undefined,
    headToHead: game.preLive.h2hGoals,
    offensiveStrength: getPreLiveHistoricalStat(game, 'home', 'season', 'goalsForAvg'),
    defensiveStrength: getPreLiveHistoricalStat(game, 'home', 'season', 'goalsAgainstAvg'),
    favoritism: game.preLive.favorite?.favoritismPercent ?? game.preLive.favoritism,
    preLiveOdds: getPreLiveOddForMarket(game, bot.oddMarket ?? bot.market) ?? fallbackOdd,
  };

  return legacyValues[ruleParameter];
};
