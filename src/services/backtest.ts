import { BacktestResult, Bot, BotLog, BotRule, Game, GameSnapshot, MethodRanking, TeamReference, TradeEntry, TradeSide } from '../types';
import { uid } from '../utils/formatters';

const clampOdd = (odd: number) => Number(Math.max(1.01, Math.min(50, odd)).toFixed(2));

const parseGoalMarket = (marketName: string | undefined) => {
  const market = (marketName ?? '').toLowerCase().replace(',', '.');
  const type = market.includes('over') ? 'over' : market.includes('under') ? 'under' : undefined;
  if (!type) return undefined;

  const lineMatch = market.match(/(?:over|under)[^\d]*(\d+(?:\.\d+)?)/) ?? market.match(/\+\s*(\d+(?:\.\d+)?)/);
  const line = lineMatch ? Number(lineMatch[1]) : undefined;
  if (!line || !Number.isFinite(line)) return undefined;

  return { type, line } as const;
};

const isFirstHalfRequested = (marketName: string | undefined) => {
  const market = normalizeText(marketName);
  return market.includes(' ht') || market.includes('1o tempo') || market.includes('1º tempo') || market.includes('1st half') || market.includes('first half');
};

const rawMarketIsFirstHalf = (marketName: string) => {
  const market = normalizeText(marketName);
  return market.includes('1st half') || market.includes('first half') || market.includes('1o tempo') || market.includes('1º tempo');
};

const rawOddMatchesGoalMarket = (marketName: string, requestedFirstHalf: boolean) => {
  const market = normalizeText(marketName);
  const isGoalMarket = market.includes('over/under') || market.includes('match goals') || market.includes('goals over') || market.includes('total goals');
  if (!isGoalMarket) return false;
  return requestedFirstHalf ? rawMarketIsFirstHalf(marketName) : !rawMarketIsFirstHalf(marketName);
};

const getRawOddForMarket = (marketName: string | undefined, snapshot: GameSnapshot) => {
  const market = normalizeText(marketName);
  const rawOdds = snapshot.odds ?? [];
  if (!market || rawOdds.length === 0) return undefined;

  const goalMarket = parseGoalMarket(marketName);
  if (goalMarket) {
    const requestedFirstHalf = isFirstHalfRequested(marketName);
    return rawOdds.find((item) => {
      const sameMarket = rawOddMatchesGoalMarket(item.marketName, requestedFirstHalf);
      const sameSelection = normalizeText(item.value).includes(goalMarket.type);
      const sameLine = Math.abs(Number(String(item.handicap ?? '').replace(',', '.')) - goalMarket.line) < 0.001;
      return sameMarket && sameSelection && sameLine;
    })?.odd;
  }

  if (market.includes('casa') || market.includes('mandante') || market.includes('home')) {
    return rawOdds.find((item) => {
      const rawMarket = normalizeText(item.marketName);
      const value = normalizeText(item.value);
      return (rawMarket.includes('fulltime result') || rawMarket.includes('match winner') || rawMarket === '1x2') && ['home', '1'].includes(value);
    })?.odd;
  }

  if (market.includes('fora') || market.includes('visitante') || market.includes('away')) {
    return rawOdds.find((item) => {
      const rawMarket = normalizeText(item.marketName);
      const value = normalizeText(item.value);
      return (rawMarket.includes('fulltime result') || rawMarket.includes('match winner') || rawMarket === '1x2') && ['away', '2'].includes(value);
    })?.odd;
  }

  if (market.includes('empate') || market.includes('draw')) {
    return rawOdds.find((item) => {
      const rawMarket = normalizeText(item.marketName);
      const value = normalizeText(item.value);
      return (rawMarket.includes('fulltime result') || rawMarket.includes('match winner') || rawMarket === '1x2') && ['draw', 'x'].includes(value);
    })?.odd;
  }

  if (market.includes('ambas') || market.includes('btts')) {
    return rawOdds.find((item) => normalizeText(item.marketName).includes('both teams') && ['yes', 'sim'].includes(normalizeText(item.value)))?.odd;
  }

  return undefined;
};

const getGoalLineOdd = (type: 'over' | 'under', line: number, snapshot: GameSnapshot) => {
  if (type === 'over') {
    if (line <= 1.5) return clampOdd(snapshot.over15Odd - (1.5 - line) * 0.35);
    if (line <= 2.5) return clampOdd(snapshot.over15Odd + (snapshot.over25Odd - snapshot.over15Odd) * (line - 1.5));
    return clampOdd(snapshot.over25Odd + (line - 2.5) * 0.75);
  }

  if (line <= 2.5) return clampOdd(snapshot.under25Odd + (2.5 - line) * 0.55);
  return clampOdd(snapshot.under25Odd - (line - 2.5) * 0.35);
};

const getOddForMarket = (marketName: string | undefined, snapshot: GameSnapshot, game: Game) => {
  const market = (marketName ?? '').toLowerCase();
  const goalMarket = parseGoalMarket(marketName);
  const rawOdd = getRawOddForMarket(marketName, snapshot);

  if (rawOdd) return rawOdd;

  if (goalMarket) return getGoalLineOdd(goalMarket.type, goalMarket.line, snapshot);
  if (market.includes('ambas') || market.includes('btts')) return snapshot.bttsOdd;
  if (market.includes('empate')) return snapshot.drawOdd;
  if (market.includes('casa') || market.includes('mandante')) return snapshot.homeOdd;
  if (market.includes('fora') || market.includes('visitante')) return snapshot.awayOdd;
  if (market.includes('dupla chance')) return Math.min(snapshot.homeOdd, snapshot.drawOdd, snapshot.awayOdd);

  return game.preLive.homeOdd <= game.preLive.awayOdd ? snapshot.homeOdd : snapshot.awayOdd;
};

const getEntryOdd = (bot: Bot, snapshot: GameSnapshot, game: Game) =>
  getOddForMarket(bot.market ?? bot.oddMarket, snapshot, game);

const getFilterOdd = (bot: Bot, snapshot: GameSnapshot, game: Game) =>
  getOddForMarket(bot.oddMarket ?? bot.market, snapshot, game);

const getHistoricalOdd = (bot: Bot, snapshot: GameSnapshot, game: Game) =>
  getOddForMarket(bot.market ?? bot.oddMarket, snapshot, game);

const getMarketTotalGoalsAtSnapshot = (bot: Bot, snapshot: GameSnapshot) => {
  if (isFirstHalfRequested(bot.market ?? bot.oddMarket)) {
    const halfHome = snapshot.halfTimeScoreHome;
    const halfAway = snapshot.halfTimeScoreAway;
    if (typeof halfHome === 'number' && typeof halfAway === 'number') return halfHome + halfAway;
    if (snapshot.minute <= 45) return snapshot.scoreHome + snapshot.scoreAway;
    return undefined;
  }

  return snapshot.scoreHome + snapshot.scoreAway;
};

const getHomeIsFavorite = (game: Game) => game.preLive.homeOdd <= game.preLive.awayOdd;

const resolveReference = (reference: string, game: Game): Extract<TeamReference, 'home' | 'away'> | undefined => {
  if (reference === 'home' || reference === 'away') return reference;
  if (reference === 'favorite') return getHomeIsFavorite(game) ? 'home' : 'away';
  if (reference === 'underdog') return getHomeIsFavorite(game) ? 'away' : 'home';
  return undefined;
};

const getTeamStatValue = (snapshot: GameSnapshot, game: Game, metric: string, reference: string) => {
  const resolved = resolveReference(reference, game);
  if (!resolved) return undefined;
  return snapshot.stats[resolved]?.[metric as keyof NonNullable<GameSnapshot['stats']['home']>];
};

const isMarketSettledAtSnapshot = (bot: Bot, snapshot: GameSnapshot) => {
  const market = (bot.market ?? bot.oddMarket ?? '').toLowerCase();
  const totalGoals = getMarketTotalGoalsAtSnapshot(bot, snapshot);
  const goalMarket = parseGoalMarket(market);

  if (goalMarket) return totalGoals === undefined ? false : totalGoals > goalMarket.line;
  if (market.includes('ambas') || market.includes('btts')) return snapshot.scoreHome > 0 && snapshot.scoreAway > 0;

  return false;
};

const getSnapshotAtOrBeforeMinute = (game: Game, minute: number, beforeIndex: number) =>
  game.snapshots
    .slice(0, beforeIndex + 1)
    .filter((item) => item.minute <= minute)
    .sort((a, b) => b.minute - a.minute)[0];

const getRecentStatValue = (game: Game, snapshot: GameSnapshot, snapshotIndex: number, metric: string, window: number, reference: string) => {
  const previous = getSnapshotAtOrBeforeMinute(game, snapshot.minute - window, snapshotIndex);
  if (!previous) return undefined;

  const currentValue = getTeamStatValue(snapshot, game, metric, reference);
  const previousValue = getTeamStatValue(previous, game, metric, reference);
  if (currentValue === undefined || previousValue === undefined) return undefined;

  return Math.max(0, currentValue - previousValue);
};

const getDifferenceValue = (snapshot: GameSnapshot, game: Game, metric: string, left: string, right: string) => {
  const leftValue = getTeamStatValue(snapshot, game, metric, left);
  const rightValue = getTeamStatValue(snapshot, game, metric, right);
  if (leftValue === undefined || rightValue === undefined) return undefined;
  return leftValue - rightValue;
};

const getScoreForReference = (snapshot: GameSnapshot, game: Game, reference: 'home' | 'away' | 'favorite' | 'underdog') => {
  const resolved = resolveReference(reference, game);
  if (resolved === 'home') return snapshot.scoreHome;
  if (resolved === 'away') return snapshot.scoreAway;
  return undefined;
};

const getOpponentScoreForReference = (snapshot: GameSnapshot, game: Game, reference: 'home' | 'away' | 'favorite' | 'underdog') => {
  const resolved = resolveReference(reference, game);
  if (resolved === 'home') return snapshot.scoreAway;
  if (resolved === 'away') return snapshot.scoreHome;
  return undefined;
};

const getReferenceState = (snapshot: GameSnapshot, game: Game, reference: 'home' | 'away' | 'favorite' | 'underdog', state: 'Winning' | 'Drawing' | 'Losing') => {
  const own = getScoreForReference(snapshot, game, reference);
  const opponent = getOpponentScoreForReference(snapshot, game, reference);
  if (own === undefined || opponent === undefined) return undefined;
  if (state === 'Winning') return own > opponent ? 1 : 0;
  if (state === 'Drawing') return own === opponent ? 1 : 0;
  return own < opponent ? 1 : 0;
};

const getReferenceGoalDiff = (snapshot: GameSnapshot, game: Game, reference: 'home' | 'away' | 'favorite' | 'underdog') => {
  const own = getScoreForReference(snapshot, game, reference);
  const opponent = getOpponentScoreForReference(snapshot, game, reference);
  if (own === undefined || opponent === undefined) return undefined;
  return own - opponent;
};

const getTotalMetric = (snapshot: GameSnapshot, metric: string) => {
  if (metric === 'attacks') return snapshot.stats.attacks;
  return snapshot.stats[metric as keyof GameSnapshot['stats']];
};

const getPerMinuteValue = (snapshot: GameSnapshot, metric: string) => {
  if (snapshot.minute <= 0) return undefined;
  const value = getTotalMetric(snapshot, metric);
  return typeof value === 'number' ? value / snapshot.minute : undefined;
};

const getTotalGoals = (snapshot: GameSnapshot) => snapshot.scoreHome + snapshot.scoreAway;

const getTotalCards = (snapshot: GameSnapshot) => snapshot.stats.cards;

const getMinutesSinceIncrease = (
  game: Game,
  snapshot: GameSnapshot,
  snapshotIndex: number,
  getValue: (snapshot: GameSnapshot) => number | undefined,
) => {
  const currentValue = getValue(snapshot);
  if (currentValue === undefined || currentValue <= 0) return undefined;

  for (let index = snapshotIndex; index > 0; index -= 1) {
    const current = getValue(game.snapshots[index]);
    const previous = getValue(game.snapshots[index - 1]);
    if (current === undefined || previous === undefined) continue;
    if (current > previous) return Math.max(0, snapshot.minute - game.snapshots[index].minute);
  }

  return undefined;
};

const getOddsMovementValue = (bot: Bot, game: Game, snapshot: GameSnapshot, snapshotIndex: number, parameter: string) => {
  const currentOdd = getHistoricalOdd(bot, snapshot, game);
  if (!Number.isFinite(currentOdd) || currentOdd <= 1.01) return undefined;

  if (parameter === 'odds:initial' || parameter === 'odds:diff' || parameter === 'odds:percent') {
    const firstSnapshot = game.snapshots.find((item) => {
      const odd = getHistoricalOdd(bot, item, game);
      return Number.isFinite(odd) && odd > 1.01;
    });
    if (!firstSnapshot) return undefined;
    const initialOdd = getHistoricalOdd(bot, firstSnapshot, game);
    if (parameter === 'odds:initial') return initialOdd;
    if (parameter === 'odds:diff') return currentOdd - initialOdd;
    return ((currentOdd - initialOdd) / initialOdd) * 100;
  }

  const match = parameter.match(/^odds:(drop|rise):(\d+)$/);
  if (!match) return undefined;

  const previousSnapshot = getSnapshotAtOrBeforeMinute(game, snapshot.minute - Number(match[2]), snapshotIndex);
  if (!previousSnapshot) return undefined;
  const previousOdd = getHistoricalOdd(bot, previousSnapshot, game);
  if (!Number.isFinite(previousOdd) || previousOdd <= 1.01) return undefined;

  return match[1] === 'drop' ? Math.max(0, previousOdd - currentOdd) : Math.max(0, currentOdd - previousOdd);
};

const includesText = (source: string, filters?: string[]) => {
  const normalized = normalizeText(source);
  const activeFilters = (filters ?? []).map(normalizeText).filter(Boolean);
  if (activeFilters.length === 0) return false;
  return activeFilters.some((filter) => normalized.includes(filter));
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getFavoriteGameSituationValues = (game: Game, snapshot: GameSnapshot) => {
  const homeIsFavorite = game.preLive.homeOdd <= game.preLive.awayOdd;
  const favoriteScore = homeIsFavorite ? snapshot.scoreHome : snapshot.scoreAway;
  const underdogScore = homeIsFavorite ? snapshot.scoreAway : snapshot.scoreHome;
  const diff = Math.abs(snapshot.scoreHome - snapshot.scoreAway);
  const favoriteDiff = Math.abs(favoriteScore - underdogScore);

  return {
    favoriteSide: homeIsFavorite ? 'homeFavorite' : 'awayFavorite',
    gameDraw: snapshot.scoreHome === snapshot.scoreAway ? 0 : undefined,
    favoriteWinningGoalDiff: favoriteScore > underdogScore ? favoriteDiff : undefined,
    favoriteNotLosingGoalDiff: favoriteScore >= underdogScore ? favoriteDiff : undefined,
    underdogWinningGoalDiff: underdogScore > favoriteScore ? favoriteDiff : undefined,
    underdogNotLosingGoalDiff: underdogScore >= favoriteScore ? favoriteDiff : undefined,
    anyTeamWinningGoalDiff: diff > 0 ? diff : undefined,
  };
};

const getRuleValue = (rule: BotRule, bot: Bot, game: Game, snapshot: GameSnapshot, odd: number, snapshotIndex: number): unknown => {
  const stats = snapshot.stats;

  if (rule.mode === 'live') {
    const gameSituationValues = getFavoriteGameSituationValues(game, snapshot);
    const statMatch = rule.parameter.match(/^stat:([^:]+):([^:]+)$/);
    if (statMatch) return getTeamStatValue(snapshot, game, statMatch[1], statMatch[2]);

    const recentMatch = rule.parameter.match(/^recent:([^:]+):(\d+):([^:]+)$/);
    if (recentMatch) return getRecentStatValue(game, snapshot, snapshotIndex, recentMatch[1], Number(recentMatch[2]), recentMatch[3]);

    const diffMatch = rule.parameter.match(/^diff:([^:]+):([^:]+):([^:]+)$/);
    if (diffMatch) return getDifferenceValue(snapshot, game, diffMatch[1], diffMatch[2], diffMatch[3]);

    if (rule.parameter.startsWith('odds:')) return getOddsMovementValue(bot, game, snapshot, snapshotIndex, rule.parameter);

    if (rule.parameter.startsWith('rhythm:')) {
      switch (rule.parameter) {
        case 'rhythm:shotsPerMinute':
          return getPerMinuteValue(snapshot, 'shots');
        case 'rhythm:shotsOnTargetPerMinute':
          return getPerMinuteValue(snapshot, 'shotsOnTarget');
        case 'rhythm:cornersPerMinute':
          return getPerMinuteValue(snapshot, 'corners');
        case 'rhythm:dangerousAttacksPerMinute':
          return getPerMinuteValue(snapshot, 'dangerousAttacks');
        case 'rhythm:minutesSinceShot':
          return getMinutesSinceIncrease(game, snapshot, snapshotIndex, (item) => getTotalMetric(item, 'shots') as number | undefined);
        case 'rhythm:minutesSinceShotOnTarget':
          return getMinutesSinceIncrease(game, snapshot, snapshotIndex, (item) => getTotalMetric(item, 'shotsOnTarget') as number | undefined);
        case 'rhythm:minutesSinceCorner':
          return getMinutesSinceIncrease(game, snapshot, snapshotIndex, (item) => getTotalMetric(item, 'corners') as number | undefined);
        case 'rhythm:minutesSinceGoal':
          return getMinutesSinceIncrease(game, snapshot, snapshotIndex, getTotalGoals);
        case 'rhythm:minutesSinceCard':
          return getMinutesSinceIncrease(game, snapshot, snapshotIndex, getTotalCards);
        default:
          return undefined;
      }
    }

    const liveValues: Record<string, unknown> = {
      minute: snapshot.minute,
      score: `${snapshot.scoreHome}-${snapshot.scoreAway}`,
      goals: snapshot.scoreHome + snapshot.scoreAway,
      corners: stats.corners,
      possession: stats.possession,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      attacks: stats.attacks ?? stats.shots + stats.dangerousAttacks,
      dangerousAttacks: stats.dangerousAttacks,
      cards: stats.cards,
      substitutions: undefined,
      offensivePressure: stats.offensivePressure,
      recentEvents: snapshot.events.join(' '),
      liveOdds: odd,
      statDifference: Math.abs(stats.shots - stats.shotsOnTarget),
      favoriteWinning: getReferenceState(snapshot, game, 'favorite', 'Winning'),
      favoriteDrawing: getReferenceState(snapshot, game, 'favorite', 'Drawing'),
      favoriteLosing: getReferenceState(snapshot, game, 'favorite', 'Losing'),
      underdogWinning: getReferenceState(snapshot, game, 'underdog', 'Winning'),
      underdogDrawing: getReferenceState(snapshot, game, 'underdog', 'Drawing'),
      underdogLosing: getReferenceState(snapshot, game, 'underdog', 'Losing'),
      homeWinning: getReferenceState(snapshot, game, 'home', 'Winning'),
      homeDrawing: getReferenceState(snapshot, game, 'home', 'Drawing'),
      homeLosing: getReferenceState(snapshot, game, 'home', 'Losing'),
      awayWinning: getReferenceState(snapshot, game, 'away', 'Winning'),
      awayDrawing: getReferenceState(snapshot, game, 'away', 'Drawing'),
      awayLosing: getReferenceState(snapshot, game, 'away', 'Losing'),
      favoriteGoalDiff: getReferenceGoalDiff(snapshot, game, 'favorite'),
      underdogGoalDiff: getReferenceGoalDiff(snapshot, game, 'underdog'),
      homeGoalDiff: getReferenceGoalDiff(snapshot, game, 'home'),
      awayGoalDiff: getReferenceGoalDiff(snapshot, game, 'away'),
      ...gameSituationValues,
    };

    return liveValues[rule.parameter];
  }

  const preLiveValues: Record<string, unknown> = {
    championship: game.league,
    season: undefined,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    tablePosition: game.preLive.tablePositionGap,
    performance: undefined,
    averageGoals: game.preLive.averageGoals,
    averageCorners: game.preLive.averageCorners,
    averageCards: undefined,
    winningStreak: undefined,
    losingStreak: undefined,
    headToHead: game.preLive.h2hGoals,
    offensiveStrength: undefined,
    defensiveStrength: undefined,
    favoritism: game.preLive.favoritism,
    preLiveOdds: odd,
  };

  return preLiveValues[rule.parameter];
};

const compareRule = (actual: unknown, rule: BotRule) => {
  if (rule.parameter === 'favoriteSide' && rule.value === 'any') return true;
  if (actual === undefined || actual === null) return false;

  if (rule.operator === '=' || rule.operator === '!=') {
    const actualNumber = toNumber(actual);
    const expectedNumber = toNumber(rule.value);
    const equal =
      actualNumber !== null && expectedNumber !== null
        ? actualNumber === expectedNumber
        : normalizeText(actual) === normalizeText(rule.value);

    return rule.operator === '=' ? equal : !equal;
  }

  if (rule.operator === 'between') {
    const actualNumber = toNumber(actual);
    const min = toNumber(rule.value);
    const max = toNumber(rule.secondValue);
    return actualNumber !== null && min !== null && max !== null && actualNumber >= min && actualNumber <= max;
  }

  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(rule.value);
  if (actualNumber === null || expectedNumber === null) return false;

  return rule.operator === '>=' ? actualNumber >= expectedNumber : actualNumber <= expectedNumber;
};

const evaluateRuleList = (rules: BotRule[], bot: Bot, game: Game, snapshot: GameSnapshot, odd: number, snapshotIndex: number) => {
  const evaluations = rules.map((rule) => ({
    rule,
    passed: compareRule(getRuleValue(rule, bot, game, snapshot, odd, snapshotIndex), rule),
  }));

  const passed = evaluations.reduce((acc, item, index) => {
    if (index === 0) return item.rule.connector === 'NOT' ? !item.passed : item.passed;

    switch (item.rule.connector ?? 'AND') {
      case 'OR':
        return acc || item.passed;
      case 'NOT':
        return acc && !item.passed;
      case 'AND':
      default:
        return acc && item.passed;
    }
  }, true);

  return {
    passed,
    reason: passed ? 'Parâmetros dinâmicos aprovados' : 'Parâmetros dinâmicos reprovados',
  };
};

const evaluateDynamicRules = (bot: Bot, game: Game, snapshot: GameSnapshot, odd: number, snapshotIndex: number) => {
  const rules = bot.rules.filter((rule) => rule.parameter && (bot.mode === 'live' || rule.mode === bot.mode));
  if (rules.length === 0) return { passed: true, reason: 'Sem parâmetros obrigatórios' };
  return evaluateRuleList(rules, bot, game, snapshot, odd, snapshotIndex);
};

const passesOddFilter = (bot: Bot, odd: number) => {
  if (!Number.isFinite(odd) || odd <= 1.01) return { passed: false, reason: 'Odd historica indisponivel neste snapshot' };
  if (bot.minOdd !== undefined && odd < bot.minOdd) return { passed: false, reason: 'Odd abaixo da mínima configurada' };
  if (bot.maxOdd !== undefined && odd > bot.maxOdd) return { passed: false, reason: 'Odd acima da máxima configurada' };
  return { passed: true, reason: 'Odd dentro do intervalo' };
};

export const shouldEnter = (bot: Bot, game: Game, snapshot: GameSnapshot, snapshotIndex = 0) => {
  const odd = getEntryOdd(bot, snapshot, game);
  const filterOdd = getFilterOdd(bot, snapshot, game);

  if ((bot.includedLeagues ?? []).length > 0 && !includesText(game.league, bot.includedLeagues)) {
    return { passed: false, odd, reason: 'Liga fora do filtro selecionado' };
  }

  if (includesText(game.league, bot.excludedLeagues)) {
    return { passed: false, odd, reason: 'Liga excluída pelo filtro' };
  }

  const entryOddFilter = passesOddFilter(bot, odd);
  if (!entryOddFilter.passed) return { passed: false, odd, reason: entryOddFilter.reason };

  const oddFilter = passesOddFilter(bot, filterOdd);
  if (!oddFilter.passed) return { passed: false, odd, reason: oddFilter.reason };

  const rules = evaluateDynamicRules(bot, game, snapshot, filterOdd, snapshotIndex);
  return { passed: rules.passed, odd, reason: rules.reason };
};

const getCashOut = (bot: Bot, game: Game, entrySnapshot: GameSnapshot, entryOdd: number) => {
  const cashOut = bot.cashOut;
  if (!cashOut?.enabled) return undefined;
  if (isMarketSettledAtSnapshot(bot, entrySnapshot)) return undefined;

  const fromMinute = cashOut.fromMinute ?? entrySnapshot.minute;
  const toMinute = cashOut.toMinute ?? 150;
  const exitRules = cashOut.exitRules.filter((rule) => rule.parameter);

  return game.snapshots.find((snapshot, snapshotIndex) => {
    if (snapshot.minute < fromMinute || snapshot.minute > toMinute || snapshot.minute <= entrySnapshot.minute) return false;
    if (isMarketSettledAtSnapshot(bot, snapshot)) return false;
    if (exitRules.length === 0) return true;
    const currentOdd = getEntryOdd(bot, snapshot, game);
    return evaluateRuleList(exitRules, bot, game, snapshot, currentOdd, snapshotIndex).passed;
  });
};

const settleCashOut = (bot: Bot, entryOdd: number, exitOdd: number) => {
  const operation: TradeSide = bot.operation ?? 'BACK';
  const stake = 1;
  const profit =
    operation === 'BACK'
      ? stake * ((entryOdd - exitOdd) / exitOdd)
      : stake * ((exitOdd - entryOdd) / exitOdd);

  return {
    result: profit >= 0 ? 'green' : 'red',
    profit: Number(profit.toFixed(2)),
  } as const;
};

const getRawMarketGreen = (bot: Bot, game: Game) => {
  const lastSnapshot = game.snapshots[game.snapshots.length - 1];
  const totalGoals = lastSnapshot ? getMarketTotalGoalsAtSnapshot(bot, lastSnapshot) : game.finalScoreHome + game.finalScoreAway;
  const market = (bot.market ?? bot.oddMarket ?? '').toLowerCase();
  const goalMarket = parseGoalMarket(market);

  if (goalMarket?.type === 'over') return totalGoals !== undefined && totalGoals > goalMarket.line;
  if (goalMarket?.type === 'under') return totalGoals !== undefined && totalGoals < goalMarket.line;
  if (market.includes('ambas')) return game.finalScoreHome > 0 && game.finalScoreAway > 0;
  if (market.includes('empate')) return game.finalScoreHome === game.finalScoreAway;

  const favoriteIsHome = game.preLive.homeOdd <= game.preLive.awayOdd;
  return favoriteIsHome ? game.finalScoreHome > game.finalScoreAway : game.finalScoreAway > game.finalScoreHome;
};

const settleTrade = (bot: Bot, game: Game, odd: number) => {
  const operation: TradeSide = bot.operation ?? 'BACK';
  const stake = 1;
  const rawGreen = getRawMarketGreen(bot, game);
  const green = operation === 'BACK' ? rawGreen : !rawGreen;
  const profit = green ? (operation === 'BACK' ? stake * (odd - 1) : stake) : operation === 'BACK' ? -stake : -stake * (odd - 1);

  return {
    result: green ? 'green' : 'red',
    profit: Number(profit.toFixed(2)),
  } as const;
};

const leagueExtremes = (entries: TradeEntry[]) => {
  const map = new Map<string, number>();
  entries.forEach((entry) => map.set(entry.league, (map.get(entry.league) ?? 0) + entry.profit));
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return {
    bestLeague: sorted[0]?.[0] ?? '-',
    worstLeague: sorted[sorted.length - 1]?.[0] ?? '-',
  };
};

export const runBacktest = (bot: Bot, games: Game[] = []): { result: BacktestResult; logs: BotLog[] } => {
  const backtestBot: Bot = { ...bot, stake: 1 };
  const entries: TradeEntry[] = [];
  const logs: BotLog[] = [];
  const date = new Date().toISOString();

  games.forEach((game) => {
    let entered = false;

    for (const [snapshotIndex, snapshot] of game.snapshots.entries()) {
      if (entered) continue;

      const decision = shouldEnter(backtestBot, game, snapshot, snapshotIndex);
      const gameName = `${game.homeTeam} x ${game.awayTeam}`;
      logs.push({
        id: uid('log'),
        date,
        botId: bot.id,
        botName: bot.name,
        gameId: game.id,
        game: gameName,
        minute: snapshot.minute,
        checkedRule: bot.mode === 'live' ? 'Regras ao vivo' : 'Regras pré-live',
        rulePassed: decision.passed,
        entryMade: decision.passed,
        reason: decision.reason,
      });

      if (decision.passed) {
        const cashOutSnapshot = getCashOut(backtestBot, game, snapshot, decision.odd);
        const cashOutOdd = cashOutSnapshot ? getEntryOdd(backtestBot, cashOutSnapshot, game) : undefined;
        const settled = cashOutOdd ? settleCashOut(backtestBot, decision.odd, cashOutOdd) : settleTrade(backtestBot, game, decision.odd);
        entries.push({
          id: uid('entry'),
          botId: bot.id,
          botName: bot.name,
          gameId: game.id,
          game: gameName,
          league: game.league,
          minute: snapshot.minute,
          market: backtestBot.market ?? backtestBot.oddMarket ?? 'Match Odds',
          operation: backtestBot.operation ?? 'BACK',
          odd: decision.odd,
          stake: 1,
          result: settled.result,
          profit: settled.profit,
          reason: cashOutSnapshot
            ? `${decision.reason}; cash-out no minuto ${cashOutSnapshot.minute} @ ${cashOutOdd?.toFixed(2)}`
            : decision.reason,
          date,
        });
        entered = true;
      }
    }
  });

  const greens = entries.filter((entry) => entry.result === 'green').length;
  const reds = entries.length - greens;
  const profit = Number(entries.reduce((sum, entry) => sum + entry.profit, 0).toFixed(2));
  const totalStake = entries.reduce((sum, entry) => sum + entry.stake, 0);
  const roi = totalStake > 0 ? Number(((profit / totalStake) * 100).toFixed(2)) : 0;
  const averageOdd = entries.length ? entries.reduce((sum, entry) => sum + entry.odd, 0) / entries.length : 0;
  const averageMinute = entries.length ? entries.reduce((sum, entry) => sum + entry.minute, 0) / entries.length : 0;
  const extremes = leagueExtremes(entries);

  return {
    result: {
      botId: bot.id,
      botName: bot.name,
      entries,
      totalEntries: entries.length,
      greens,
      reds,
      profit,
      roi,
      averageOdd,
      averageMinute,
      bestLeague: extremes.bestLeague,
      worstLeague: extremes.worstLeague,
    },
    logs,
  };
};

export const runAllRankings = (bots: Bot[], games: Game[] = []): MethodRanking[] =>
  bots
    .map((bot) => {
      const { result } = runBacktest(bot, games);
      return {
        botId: bot.id,
        botName: bot.name,
        roi: result.roi,
        profit: result.profit,
        entries: result.totalEntries,
        greens: result.greens,
        reds: result.reds,
        accuracy: result.totalEntries ? Number(((result.greens / result.totalEntries) * 100).toFixed(2)) : 0,
        mode: bot.mode,
        market: bot.market,
      };
    })
    .sort((a, b) => b.roi - a.roi);

export const liveEntryPreview = (_bots: Bot[]) => [];
