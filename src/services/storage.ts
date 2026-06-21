import { AppSettings, Bot, BotLog, BacktestResult } from '../types';

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

export const storage = {
  getBots: () => read<Bot[]>(keys.bots, []),
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
