import { BacktestResult, Bot, BotLog, BotRule, Game, GameSnapshot, MethodRanking, TradeEntry, TradeSide } from '../types';
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

const isMarketSettledAtSnapshot = (bot: Bot, snapshot: GameSnapshot) => {
  const market = (bot.market ?? bot.oddMarket ?? '').toLowerCase();
  const totalGoals = snapshot.scoreHome + snapshot.scoreAway;
  const goalMarket = parseGoalMarket(market);

  if (goalMarket) return totalGoals > goalMarket.line;
  if (market.includes('ambas') || market.includes('btts')) return snapshot.scoreHome > 0 && snapshot.scoreAway > 0;

  return false;
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

const getRuleValue = (rule: BotRule, bot: Bot, game: Game, snapshot: GameSnapshot, odd: number): unknown => {
  const stats = snapshot.stats;

  if (rule.mode === 'live') {
    const gameSituationValues = getFavoriteGameSituationValues(game, snapshot);
    const liveValues: Record<string, unknown> = {
      minute: snapshot.minute,
      score: `${snapshot.scoreHome}-${snapshot.scoreAway}`,
      goals: snapshot.scoreHome + snapshot.scoreAway,
      corners: stats.corners,
      possession: stats.possession,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      attacks: stats.shots + stats.dangerousAttacks,
      dangerousAttacks: stats.dangerousAttacks,
      cards: stats.cards,
      substitutions: undefined,
      offensivePressure: stats.offensivePressure,
      recentEvents: snapshot.events.join(' '),
      liveOdds: odd,
      statDifference: Math.abs(stats.shots - stats.shotsOnTarget),
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

const evaluateRuleList = (rules: BotRule[], bot: Bot, game: Game, snapshot: GameSnapshot, odd: number) => {
  const evaluations = rules.map((rule) => ({
    rule,
    passed: compareRule(getRuleValue(rule, bot, game, snapshot, odd), rule),
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

const evaluateDynamicRules = (bot: Bot, game: Game, snapshot: GameSnapshot, odd: number) => {
  const rules = bot.rules.filter((rule) => rule.parameter && (bot.mode === 'live' || rule.mode === bot.mode));
  if (rules.length === 0) return { passed: true, reason: 'Sem parâmetros obrigatórios' };
  return evaluateRuleList(rules, bot, game, snapshot, odd);
};

const passesOddFilter = (bot: Bot, odd: number) => {
  if (!Number.isFinite(odd) || odd <= 1.01) return { passed: false, reason: 'Odd historica indisponivel neste snapshot' };
  if (bot.minOdd !== undefined && odd < bot.minOdd) return { passed: false, reason: 'Odd abaixo da mínima configurada' };
  if (bot.maxOdd !== undefined && odd > bot.maxOdd) return { passed: false, reason: 'Odd acima da máxima configurada' };
  return { passed: true, reason: 'Odd dentro do intervalo' };
};

export const shouldEnter = (bot: Bot, game: Game, snapshot: GameSnapshot) => {
  const odd = getEntryOdd(bot, snapshot, game);
  const filterOdd = getFilterOdd(bot, snapshot, game);

  if ((bot.includedLeagues ?? []).length > 0 && !includesText(game.league, bot.includedLeagues)) {
    return { passed: false, odd, reason: 'Liga fora do filtro selecionado' };
  }

  if (includesText(game.league, bot.excludedLeagues)) {
    return { passed: false, odd, reason: 'Liga excluída pelo filtro' };
  }

  const oddFilter = passesOddFilter(bot, filterOdd);
  if (!oddFilter.passed) return { passed: false, odd, reason: oddFilter.reason };

  const rules = evaluateDynamicRules(bot, game, snapshot, filterOdd);
  return { passed: rules.passed, odd, reason: rules.reason };
};

const getCashOut = (bot: Bot, game: Game, entrySnapshot: GameSnapshot, entryOdd: number) => {
  const cashOut = bot.cashOut;
  if (!cashOut?.enabled) return undefined;
  if (isMarketSettledAtSnapshot(bot, entrySnapshot)) return undefined;

  const fromMinute = cashOut.fromMinute ?? entrySnapshot.minute;
  const toMinute = cashOut.toMinute ?? 150;
  const exitRules = cashOut.exitRules.filter((rule) => rule.parameter);

  return game.snapshots.find((snapshot) => {
    if (snapshot.minute < fromMinute || snapshot.minute > toMinute || snapshot.minute <= entrySnapshot.minute) return false;
    if (isMarketSettledAtSnapshot(bot, snapshot)) return false;
    if (exitRules.length === 0) return true;
    const currentOdd = getEntryOdd(bot, snapshot, game);
    return evaluateRuleList(exitRules, bot, game, snapshot, currentOdd).passed;
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
  const totalGoals = game.finalScoreHome + game.finalScoreAway;
  const market = (bot.market ?? bot.oddMarket ?? '').toLowerCase();
  const goalMarket = parseGoalMarket(market);

  if (goalMarket?.type === 'over') return totalGoals > goalMarket.line;
  if (goalMarket?.type === 'under') return totalGoals < goalMarket.line;
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

    for (const snapshot of game.snapshots) {
      if (entered) continue;

      const decision = shouldEnter(backtestBot, game, snapshot);
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
