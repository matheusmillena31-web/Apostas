import { AppSettings, Bot, BotLog, BacktestJob, BacktestResult } from '../types';
import { uid } from '../utils/formatters';

const keys = {
  bots: 'tradelab:bots',
  logs: 'tradelab:logs',
  results: 'tradelab:results',
  backtestJobs: 'tradelab:backtestJobs',
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
      cashOut: item.cashOut ? { exitLogic: 'AND', ...item.cashOut } : { enabled: false, exitLogic: 'AND', exitRules: [] },
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
    cashOut: { enabled: false, exitLogic: 'AND', exitRules: [] },
    createdAt: String(item.createdAt ?? now),
    updatedAt: String(item.updatedAt ?? now),
  };
};

const cloneBot = (bot: Bot): Bot => JSON.parse(JSON.stringify(bot)) as Bot;

const getAccuracy = (result?: BacktestResult) =>
  result && result.totalEntries > 0 ? Number(((result.greens / result.totalEntries) * 100).toFixed(2)) : undefined;

const summarizeParameters = (bot: Bot) => {
  const rules = bot.rules?.filter((rule) => rule.parameter).length ?? 0;
  const cashOutRules = bot.cashOut?.exitRules?.filter((rule) => rule.parameter).length ?? 0;
  return `${rules} regra(s) de entrada${cashOutRules ? `, ${cashOutRules} regra(s) de cashout` : ''}`;
};

const buildJobFromResult = (result: BacktestResult): BacktestJob => {
  const now = new Date().toISOString();
  const botSnapshot: Bot = {
    id: result.botId,
    name: result.botName,
    description: 'Resultado antigo migrado',
    isActive: true,
    mode: 'live',
    sport: 'Futebol',
    market: undefined,
    operation: 'BACK',
    stake: 1,
    rules: [],
    includedLeagues: [],
    excludedLeagues: [],
    cashOut: { enabled: false, exitLogic: 'AND', exitRules: [] },
    createdAt: now,
    updatedAt: now,
  };

  return {
    id: uid('job'),
    botId: result.botId,
    botSnapshot,
    name: result.botName,
    createdBy: 'Eu',
    type: 'Live',
    market: undefined,
    parametersSummary: 'Resultado antigo',
    status: 'completed',
    createdAt: now,
    scheduledFor: now,
    startedAt: now,
    finishedAt: now,
    progress: 100,
    resultId: result.botId,
    result,
    entries: result.totalEntries,
    accuracy: getAccuracy(result),
    profit: result.profit,
    roi: result.roi,
  };
};

export const normalizeBacktestJob = (payload: unknown): BacktestJob => {
  const item = payload as Partial<BacktestJob> & Record<string, any>;
  const botSnapshot = normalizeBot(item.botSnapshot ?? {});
  const now = new Date().toISOString();
  const result = item.result as BacktestResult | undefined;
  const status = ['pending', 'processing', 'completed', 'error', 'cancelled'].includes(String(item.status))
    ? (item.status as BacktestJob['status'])
    : 'pending';

  return {
    id: String(item.id ?? uid('job')),
    botId: String(item.botId ?? botSnapshot.id),
    botSnapshot,
    name: String(item.name ?? botSnapshot.name ?? 'Backtest sem nome'),
    createdBy: String(item.createdBy ?? 'Eu'),
    type: item.type === 'Pre-Live' ? 'Pre-Live' : 'Live',
    market: item.market ?? botSnapshot.market ?? botSnapshot.oddMarket,
    parametersSummary: String(item.parametersSummary ?? summarizeParameters(botSnapshot)),
    status,
    createdAt: String(item.createdAt ?? now),
    scheduledFor: item.scheduledFor ? String(item.scheduledFor) : undefined,
    startedAt: item.startedAt ? String(item.startedAt) : undefined,
    finishedAt: item.finishedAt ? String(item.finishedAt) : undefined,
    progress: typeof item.progress === 'number' ? item.progress : undefined,
    resultId: item.resultId ? String(item.resultId) : undefined,
    result,
    logs: Array.isArray(item.logs) ? item.logs : undefined,
    errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
    entries: typeof item.entries === 'number' ? item.entries : result?.totalEntries,
    accuracy: typeof item.accuracy === 'number' ? item.accuracy : getAccuracy(result),
    profit: typeof item.profit === 'number' ? item.profit : result?.profit,
    roi: typeof item.roi === 'number' ? item.roi : result?.roi,
    automation: item.automation?.source === 'autonomous'
      ? {
          source: 'autonomous',
          hash: String(item.automation.hash ?? ''),
          baseBotId: item.automation.baseBotId ? String(item.automation.baseBotId) : undefined,
          variantIndex: typeof item.automation.variantIndex === 'number' ? item.automation.variantIndex : undefined,
        }
      : undefined,
  };
};

export const createBacktestJobDraft = (bot: Bot, scheduledFor?: string): BacktestJob => {
  const now = new Date().toISOString();
  const botSnapshot = cloneBot(bot);
  return {
    id: uid('job'),
    botId: bot.id,
    botSnapshot,
    name: `${bot.name || 'Bot sem nome'} - ${new Date(now).toLocaleString('pt-BR')}`,
    createdBy: 'Eu',
    type: bot.mode === 'pre-live' ? 'Pre-Live' : 'Live',
    market: bot.market ?? bot.oddMarket,
    parametersSummary: summarizeParameters(bot),
    status: 'pending',
    createdAt: now,
    scheduledFor: scheduledFor ?? now,
    progress: 0,
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
    const next = [result, ...storage.getResults()];
    write(keys.results, next);
    return next;
  },
  getBacktestJobs: () => {
    const hasStoredJobs = localStorage.getItem(keys.backtestJobs) !== null;
    const jobs = read<unknown[]>(keys.backtestJobs, []).map(normalizeBacktestJob);
    if (hasStoredJobs) return jobs;

    const legacyResults = storage.getResults();
    if (legacyResults.length === 0) return [];

    const migratedJobs = legacyResults.map(buildJobFromResult);
    write(keys.backtestJobs, migratedJobs);
    return migratedJobs;
  },
  saveBacktestJobs: (jobs: BacktestJob[]) => write(keys.backtestJobs, jobs),
  createBacktestJob: (bot: Bot, scheduledFor?: string) => {
    const job = createBacktestJobDraft(bot, scheduledFor);
    const jobs = [job, ...storage.getBacktestJobs()];
    storage.saveBacktestJobs(jobs);
    return { job, jobs };
  },
  updateBacktestJob: (jobId: string, patch: Partial<BacktestJob>) => {
    const jobs = storage.getBacktestJobs().map((job) => (job.id === jobId ? { ...job, ...patch } : job));
    storage.saveBacktestJobs(jobs);
    return jobs;
  },
  deleteBacktestJob: (jobId: string) => {
    const jobs = storage.getBacktestJobs().filter((job) => job.id !== jobId);
    storage.saveBacktestJobs(jobs);
    return jobs;
  },
  deleteAllBacktestJobs: () => {
    storage.saveBacktestJobs([]);
    return [];
  },
  getBacktestJobById: (jobId: string) => storage.getBacktestJobs().find((job) => job.id === jobId),
  getSettings: () => read<AppSettings>(keys.settings, defaultSettings),
  saveSettings: (settings: AppSettings) => write(keys.settings, settings),
  exportAll: () => ({
    bots: storage.getBots(),
    logs: storage.getLogs(),
    results: storage.getResults(),
    backtestJobs: storage.getBacktestJobs(),
    settings: storage.getSettings(),
  }),
  importAll: (payload: Partial<{ bots: Bot[]; logs: BotLog[]; results: BacktestResult[]; backtestJobs: BacktestJob[]; settings: AppSettings }>) => {
    if (payload.bots) storage.saveBots(payload.bots);
    if (payload.logs) storage.saveLogs(payload.logs);
    if (payload.results) write(keys.results, payload.results);
    if (payload.backtestJobs) storage.saveBacktestJobs(payload.backtestJobs);
    if (payload.settings) storage.saveSettings(payload.settings);
  },
  clearAll: () => Object.values(keys).forEach((key) => localStorage.removeItem(key)),
};
