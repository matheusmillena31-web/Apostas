import { historicalGames, mockGames } from '../data/mockGames';
import { BacktestResult, Bot, BotLog, Game, GameSnapshot, MethodRanking, TradeEntry } from '../types';
import { includesAny, splitList, uid } from '../utils/formatters';

const getMarketOdd = (bot: Bot, snapshot: GameSnapshot, game: Game) => {
  const market = bot.market.toLowerCase();
  if (market.includes('over 1.5')) return snapshot.over15Odd;
  if (market.includes('over 2.5')) return snapshot.over25Odd;
  if (market.includes('under 2.5')) return snapshot.under25Odd;
  if (market.includes('ambas')) return snapshot.bttsOdd;
  if (market.includes('empate')) return snapshot.drawOdd;
  return game.preLive.homeOdd <= game.preLive.awayOdd ? snapshot.homeOdd : snapshot.awayOdd;
};

const matchesScore = (filter: string, snapshot: GameSnapshot) => {
  if (!filter.trim()) return true;
  return filter.trim() === `${snapshot.scoreHome}-${snapshot.scoreAway}`;
};

const passesBaseRules = (bot: Bot, game: Game, snapshot: GameSnapshot) => {
  const odd = getMarketOdd(bot, snapshot, game);
  const leagueFilters = splitList(bot.leagues);
  const teamFilters = splitList(bot.teams);
  const teams = `${game.homeTeam} ${game.awayTeam}`;

  if (snapshot.minute < bot.entryMinute || snapshot.minute > bot.limitMinute) {
    return { passed: false, reason: 'Fora da janela de entrada', odd };
  }
  if (odd < bot.minOdd || odd > bot.maxOdd) {
    return { passed: false, reason: 'Odd fora do intervalo configurado', odd };
  }
  if (!matchesScore(bot.scoreFilter, snapshot)) {
    return { passed: false, reason: 'Placar diferente do filtro', odd };
  }
  if (!includesAny(game.league, leagueFilters)) {
    return { passed: false, reason: 'Liga fora do filtro', odd };
  }
  if (!includesAny(teams, teamFilters)) {
    return { passed: false, reason: 'Times fora do filtro', odd };
  }

  return { passed: true, reason: 'Regras base aprovadas', odd };
};

const passesLiveRules = (bot: Bot, snapshot: GameSnapshot, currentOdd: number) => {
  const rule = bot.liveRules;
  const stats = snapshot.stats;

  if (rule.minShots && stats.shots < rule.minShots) return { passed: false, reason: 'Finalizações abaixo do mínimo' };
  if (rule.minShotsOnTarget && stats.shotsOnTarget < rule.minShotsOnTarget) {
    return { passed: false, reason: 'Finalizações no alvo abaixo do mínimo' };
  }
  if (rule.minDangerousAttacks && stats.dangerousAttacks < rule.minDangerousAttacks) {
    return { passed: false, reason: 'Ataques perigosos insuficientes' };
  }
  if (rule.minCorners && stats.corners < rule.minCorners) return { passed: false, reason: 'Escanteios abaixo do mínimo' };
  if (rule.minPossession && stats.possession < rule.minPossession) return { passed: false, reason: 'Posse abaixo do mínimo' };
  if (rule.maxCards && stats.cards > rule.maxCards) return { passed: false, reason: 'Cartões acima do limite' };
  if (rule.minOffensivePressure && stats.offensivePressure < rule.minOffensivePressure) {
    return { passed: false, reason: 'Pressão ofensiva insuficiente' };
  }
  if (rule.minRecentShots && stats.recentShots < rule.minRecentShots) {
    return { passed: false, reason: 'Chutes recentes insuficientes' };
  }
  if (rule.currentOddMin && currentOdd < rule.currentOddMin) return { passed: false, reason: 'Odd atual abaixo da regra' };
  if (rule.currentOddMax && currentOdd > rule.currentOddMax) return { passed: false, reason: 'Odd atual acima da regra' };
  if (rule.score && !matchesScore(rule.score, snapshot)) return { passed: false, reason: 'Placar ao vivo fora da regra' };

  return { passed: true, reason: 'Regras ao vivo aprovadas' };
};

const passesPreLiveRules = (bot: Bot, game: Game, odd: number) => {
  const rule = bot.preLiveRules;

  if (rule.minPreLiveOdd && odd < rule.minPreLiveOdd) return { passed: false, reason: 'Odd pre-live abaixo do mínimo' };
  if (rule.maxPreLiveOdd && odd > rule.maxPreLiveOdd) return { passed: false, reason: 'Odd pre-live acima do máximo' };
  if (rule.leagues && !includesAny(game.league, splitList(rule.leagues))) return { passed: false, reason: 'Liga pre-live fora da regra' };
  if (rule.teams && !includesAny(`${game.homeTeam} ${game.awayTeam}`, splitList(rule.teams))) {
    return { passed: false, reason: 'Times pre-live fora da regra' };
  }
  if (rule.minAverageGoals && game.preLive.averageGoals < rule.minAverageGoals) {
    return { passed: false, reason: 'Média de gols abaixo da regra' };
  }
  if (rule.minAverageCorners && game.preLive.averageCorners < rule.minAverageCorners) {
    return { passed: false, reason: 'Média de escanteios abaixo da regra' };
  }
  if (rule.minH2HGoals && game.preLive.h2hGoals < rule.minH2HGoals) {
    return { passed: false, reason: 'H2H abaixo da regra' };
  }
  if (rule.maxTablePositionGap && game.preLive.tablePositionGap > rule.maxTablePositionGap) {
    return { passed: false, reason: 'Distância na tabela acima do limite' };
  }
  if (rule.minFavoritism && game.preLive.favoritism < rule.minFavoritism) {
    return { passed: false, reason: 'Favoritismo abaixo do mínimo' };
  }

  return { passed: true, reason: 'Regras pre-live aprovadas' };
};

export const shouldEnter = (bot: Bot, game: Game, snapshot: GameSnapshot) => {
  const base = passesBaseRules(bot, game, snapshot);
  if (!base.passed) return { passed: false, odd: base.odd, reason: base.reason };

  const modeRules =
    bot.mode === 'ao-vivo' ? passesLiveRules(bot, snapshot, base.odd) : passesPreLiveRules(bot, game, base.odd);

  return { passed: modeRules.passed, odd: base.odd, reason: modeRules.reason };
};

const getRawMarketGreen = (bot: Bot, game: Game) => {
  const totalGoals = game.finalScoreHome + game.finalScoreAway;
  const market = bot.market.toLowerCase();

  if (market.includes('over 1.5')) return totalGoals >= 2;
  if (market.includes('over 2.5')) return totalGoals >= 3;
  if (market.includes('under 2.5')) return totalGoals <= 2;
  if (market.includes('ambas')) return game.finalScoreHome > 0 && game.finalScoreAway > 0;
  if (market.includes('empate')) return game.finalScoreHome === game.finalScoreAway;

  const favoriteIsHome = game.preLive.homeOdd <= game.preLive.awayOdd;
  const favoriteWon = favoriteIsHome
    ? game.finalScoreHome > game.finalScoreAway
    : game.finalScoreAway > game.finalScoreHome;

  return favoriteWon;
};

const settleTrade = (bot: Bot, game: Game, odd: number) => {
  const rawGreen = getRawMarketGreen(bot, game);
  const green = bot.side === 'BACK' ? rawGreen : !rawGreen;
  const profit = green
    ? bot.side === 'BACK'
      ? bot.stake * (odd - 1)
      : bot.stake
    : bot.side === 'BACK'
      ? -bot.stake
      : -bot.stake * (odd - 1);

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

export const runBacktest = (bot: Bot, games: Game[] = historicalGames): { result: BacktestResult; logs: BotLog[] } => {
  const entries: TradeEntry[] = [];
  const logs: BotLog[] = [];
  const date = new Date().toISOString();

  games.forEach((game) => {
    let entered = false;

    for (const snapshot of game.snapshots) {
      if (snapshot.minute > bot.limitMinute || entered) continue;

      const decision = shouldEnter(bot, game, snapshot);
      const gameName = `${game.homeTeam} x ${game.awayTeam}`;
      logs.push({
        id: uid('log'),
        date,
        botId: bot.id,
        botName: bot.name,
        gameId: game.id,
        game: gameName,
        minute: snapshot.minute,
        checkedRule: bot.mode === 'ao-vivo' ? 'Regras ao vivo' : 'Regras pre-live',
        rulePassed: decision.passed,
        entryMade: decision.passed,
        reason: decision.reason,
      });

      if (decision.passed) {
        const settled = settleTrade(bot, game, decision.odd);
        entries.push({
          id: uid('entry'),
          botId: bot.id,
          botName: bot.name,
          gameId: game.id,
          game: gameName,
          league: game.league,
          minute: snapshot.minute,
          market: bot.market,
          side: bot.side,
          odd: decision.odd,
          stake: bot.stake,
          result: settled.result,
          profit: settled.profit,
          reason: decision.reason,
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

export const runAllRankings = (bots: Bot[]): MethodRanking[] =>
  bots.map((bot) => {
    const { result } = runBacktest(bot);
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
  }).sort((a, b) => b.roi - a.roi);

export const liveEntryPreview = (bots: Bot[]) =>
  mockGames
    .filter((game) => game.status === 'ao-vivo')
    .flatMap((game) => {
      const snapshot = game.snapshots[game.currentMinute];
      return bots
        .filter((bot) => bot.isActive)
        .map((bot) => ({
          game,
          bot,
          snapshot,
          decision: shouldEnter(bot, game, snapshot),
        }));
    });
