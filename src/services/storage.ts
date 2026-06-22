import { AppSettings, Bot, BotLog, BacktestResult } from '../types';
import { uid } from '../utils/formatters';

const keys = {
  bots: 'tradelab:bots',
  logs: 'tradelab:logs',
  results: 'tradelab:results',
  settings: 'tradelab:settings',
};

const defaultSettings: AppSettings = {
  bankroll: 1000,
  defaultStake: 10,
  currency: 'BRL',
  simulationDelay: 600,
};

const read = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = <T>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const normalizeMode = (mode: unknown): Bot['mode'] => (mode === 'pre-live' ? 'pre-live' : 'live');

const rule = (mode: Bot['mode'], parameter: string, operator: '>=' | '<=' | '=' | '!=' | 'between', value: string | number) => ({
  id: uid('rule'),
  mode,
  parameter,
  operator,
  value,
  connector: 'AND' as const,
});

const normalizeBot = (payload: unknown): Bot => {
  const item = payload as Partial<Bot> & Record<string, any>;
  const now = new Date().toISOString();

  if (Array.isArray(item.rules)) {
    return {
      id: String(item.id ?? uid('bot')),
      name: String(item.name ?? 'Método sem nome'),
      description: item.description ? String(item.description) : '',
      isActive: item.isActive ?? true,
      mode: normalizeMode(item.mode),
      sport: 'Futebol',
      market: item.market || undefined,
      oddMarket: item.oddMarket || item.market || undefined,
      operation: item.operation ?? item.side,
      minOdd: item.minOdd,
      maxOdd: item.maxOdd,
      stake: item.stake,
      rules: item.rules,
      includedLeagues: Array.isArray(item.includedLeagues) ? item.includedLeagues : [],
      excludedLeagues: Array.isArray(item.excludedLeagues) ? item.excludedLeagues : [],
      cashOut: item.cashOut ?? { enabled: false, exitRules: [] },
      createdAt: String(item.createdAt ?? now),
      updatedAt: String(item.updatedAt ?? now),
    };
  }

  const mode = normalizeMode(item.mode);
  const rules = [];

  if (item.entryMinute !== undefined) rules.push(rule('live', 'minute', '>=', Number(item.entryMinute)));
  if (item.limitMinute !== undefined) rules.push(rule('live', 'minute', '<=', Number(item.limitMinute)));
  if (item.scoreFilter) rules.push(rule('live', 'score', '=', String(item.scoreFilter)));
  if (item.liveRules?.minShots) rules.push(rule('live', 'shots', '>=', Number(item.liveRules.minShots)));
  if (item.liveRules?.minShotsOnTarget) rules.push(rule('live', 'shotsOnTarget', '>=', Number(item.liveRules.minShotsOnTarget)));
  if (item.liveRules?.minDangerousAttacks) rules.push(rule('live', 'dangerousAttacks', '>=', Number(item.liveRules.minDangerousAttacks)));
  if (item.liveRules?.minCorners) rules.push(rule('live', 'corners', '>=', Number(item.liveRules.minCorners)));
  if (item.liveRules?.minPossession) rules.push(rule('live', 'possession', '>=', Number(item.liveRules.minPossession)));
  if (item.liveRules?.maxCards) rules.push(rule('live', 'cards', '<=', Number(item.liveRules.maxCards)));
  if (item.liveRules?.minOffensivePressure) rules.push(rule('live', 'offensivePressure', '>=', Number(item.liveRules.minOffensivePressure)));
  if (item.liveRules?.score) rules.push(rule('live', 'score', '=', String(item.liveRules.score)));
  if (item.preLiveRules?.leagues) rules.push(rule('pre-live', 'championship', '=', String(item.preLiveRules.leagues)));
  if (item.preLiveRules?.teams) rules.push(rule('pre-live', 'homeTeam', '=', String(item.preLiveRules.teams)));
  if (item.preLiveRules?.minAverageGoals) rules.push(rule('pre-live', 'averageGoals', '>=', Number(item.preLiveRules.minAverageGoals)));
  if (item.preLiveRules?.minAverageCorners) rules.push(rule('pre-live', 'averageCorners', '>=', Number(item.preLiveRules.minAverageCorners)));
  if (item.preLiveRules?.minH2HGoals) rules.push(rule('pre-live', 'headToHead', '>=', Number(item.preLiveRules.minH2HGoals)));
  if (item.preLiveRules?.maxTablePositionGap) rules.push(rule('pre-live', 'tablePosition', '<=', Number(item.preLiveRules.maxTablePositionGap)));
  if (item.preLiveRules?.minFavoritism) rules.push(rule('pre-live', 'favoritism', '>=', Number(item.preLiveRules.minFavoritism)));

  return {
    id: String(item.id ?? uid('bot')),
    name: String(item.name ?? 'Método sem nome'),
    description: item.description ? String(item.description) : '',
    isActive: item.isActive ?? true,
    mode,
    sport: 'Futebol',
    market: item.market || undefined,
    oddMarket: item.oddMarket || item.market || undefined,
    operation: item.operation ?? item.side,
    minOdd: item.minOdd ?? item.preLiveRules?.minPreLiveOdd ?? item.liveRules?.currentOddMin,
    maxOdd: item.maxOdd ?? item.preLiveRules?.maxPreLiveOdd ?? item.liveRules?.currentOddMax,
    stake: item.stake,
    rules: rules.length ? rules : [rule(mode, '', '>=', '')],
    includedLeagues: [],
    excludedLeagues: [],
    cashOut: { enabled: false, exitRules: [] },
    createdAt: String(item.createdAt ?? now),
    updatedAt: String(item.updatedAt ?? now),
  };
};

export const storage = {
  getBots: () => read<unknown[]>(keys.bots, []).map(normalizeBot),
  saveBots: (bots: Bot[]) => write(keys.bots, bots),
  upsertBot: (bot: Bot) => {
    const bots = storage.getBots();
    const index = bots.findIndex((item) => item.id === bot.id);
    const next = index >= 0 ? bots.map((item) => (item.id === bot.id ? bot : item)) : [bot, ...bots];
    storage.saveBots(next);
    return next;
  },
  deleteBot: (botId: string) => {
    const next = storage.getBots().filter((bot) => bot.id !== botId);
    storage.saveBots(next);
    return next;
  },
  getLogs: () => read<BotLog[]>(keys.logs, []),
  saveLogs: (logs: BotLog[]) => write(keys.logs, logs.slice(0, 600)),
  appendLogs: (logs: BotLog[]) => {
    const next = [...logs, ...storage.getLogs()].slice(0, 600);
    storage.saveLogs(next);
    return next;
  },
  getResults: () => read<BacktestResult[]>(keys.results, []),
  saveResults: (results: BacktestResult[]) => write(keys.results, results),
  saveResult: (result: BacktestResult) => {
    const others = storage.getResults().filter((item) => item.botId !== result.botId);
    const next = [result, ...others];
    write(keys.results, next);
    return next;
  },
  getSettings: () => read<AppSettings>(keys.settings, defaultSettings),
  saveSettings: (settings: AppSettings) => write(keys.settings, settings),
  exportAll: () => ({
    bots: storage.getBots(),
    logs: storage.getLogs(),
    results: storage.getResults(),
    settings: storage.getSettings(),
  }),
  importAll: (payload: Partial<{ bots: Bot[]; logs: BotLog[]; results: BacktestResult[]; settings: AppSettings }>) => {
    if (payload.bots) storage.saveBots(payload.bots);
    if (payload.logs) storage.saveLogs(payload.logs);
    if (payload.results) write(keys.results, payload.results);
    if (payload.settings) storage.saveSettings(payload.settings);
  },
  clearAll: () => Object.values(keys).forEach((key) => localStorage.removeItem(key)),
};
