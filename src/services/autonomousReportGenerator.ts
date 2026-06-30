import { BacktestJob, Bot, BotRule } from '../types';
import { uid } from '../utils/formatters';
import { getParameterOption } from './parameterCatalog';

export type AutonomousMarketOption = {
  value: string;
  label: string;
  keywords: string[];
};

export type AutonomousReportBatchResult = {
  created: number;
  skipped: number;
  variants: Bot[];
};

const MAX_BATCH_SIZE = 20;

export const AUTONOMOUS_MARKET_OPTIONS: AutonomousMarketOption[] = [
  { value: 'Odd - Casa', label: 'Vitoria do mandante', keywords: ['casa', 'mandante', 'home', 'vitoria'] },
  { value: 'Odd - Empate', label: 'Empate', keywords: ['empate', 'draw'] },
  { value: 'Odd - Fora', label: 'Vitoria do visitante', keywords: ['fora', 'visitante', 'away', 'vitoria'] },
  { value: 'Odd - Favorito', label: 'Vitoria do favorito', keywords: ['favorito', 'favorite'] },
  { value: 'Odd - Zebra', label: 'Vitoria da zebra', keywords: ['zebra', 'underdog'] },
  { value: 'Odd - Over Gol (+ 0.5G)', label: 'Over 0.5 gols FT', keywords: ['over', '0.5', 'gols', 'ft'] },
  { value: 'Odd - Over Gol (+ 1.5G)', label: 'Over 1.5 gols FT', keywords: ['over', '1.5', 'gols', 'ft'] },
  { value: 'Odd - Over Gol (+ 2.5G)', label: 'Over 2.5 gols FT', keywords: ['over', '2.5', 'gols', 'ft'] },
  { value: 'Odd - Over Gol (+ 3.5G)', label: 'Over 3.5 gols FT', keywords: ['over', '3.5', 'gols', 'ft'] },
  { value: 'Odd - Under Gol (+ 0.5G)', label: 'Under 0.5 gols FT', keywords: ['under', '0.5', 'gols', 'ft'] },
  { value: 'Odd - Under Gol (+ 1.5G)', label: 'Under 1.5 gols FT', keywords: ['under', '1.5', 'gols', 'ft'] },
  { value: 'Odd - Under Gol (+ 2.5G)', label: 'Under 2.5 gols FT', keywords: ['under', '2.5', 'gols', 'ft'] },
  { value: 'Odd - Under Gol (+ 3.5G)', label: 'Under 3.5 gols FT', keywords: ['under', '3.5', 'gols', 'ft'] },
  { value: 'Odd - Over 0.5 HT', label: 'Over 0.5 gols HT', keywords: ['over', '0.5', 'ht', 'primeiro tempo'] },
  { value: 'Odd - Under 0.5 HT', label: 'Under 0.5 gols HT', keywords: ['under', '0.5', 'ht', 'primeiro tempo'] },
  { value: 'Odd - BTTS Sim', label: 'Ambas marcam - Sim', keywords: ['ambas', 'btts', 'sim'] },
  { value: 'Odd - BTTS Nao', label: 'Ambas marcam - Nao', keywords: ['ambas', 'btts', 'nao'] },
];

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const isNumeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const randomInt = (min: number, max: number, seed: number) => {
  const x = Math.sin(seed * 9999.91) * 10000;
  const ratio = x - Math.floor(x);
  return Math.floor(ratio * (max - min + 1)) + min;
};

const randomFrom = <T,>(values: T[], seed: number) => values[randomInt(0, values.length - 1, seed)];

const randomFloat = (min: number, max: number, step: number, seed: number) => {
  const steps = Math.max(0, Math.floor((max - min) / step));
  return round(min + randomInt(0, steps, seed) * step, getDecimals(step));
};

const makeRule = (
  mode: BotRule['mode'],
  parameter: string,
  operator: BotRule['operator'],
  value: string | number,
  secondValue?: string | number,
): BotRule => ({
  id: uid('rule'),
  mode,
  parameter,
  operator,
  value,
  secondValue,
  connector: 'AND',
});

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const createAutonomousReportHash = (bot: Bot) => {
  const payload = {
    mode: bot.mode,
    market: bot.market,
    oddMarket: bot.oddMarket,
    operation: bot.operation,
    minOdd: bot.minOdd,
    maxOdd: bot.maxOdd,
    includedLeagues: bot.includedLeagues ?? [],
    excludedLeagues: bot.excludedLeagues ?? [],
    rules: (bot.rules ?? [])
      .filter((rule) => rule.parameter)
      .map((rule) => ({
        mode: rule.mode,
        parameter: rule.parameter,
        operator: rule.operator,
        value: rule.value,
        secondValue: rule.secondValue,
        connector: rule.connector ?? 'AND',
      }))
      .sort((left, right) => `${left.mode}:${left.parameter}:${left.operator}:${left.value}:${left.secondValue}`.localeCompare(`${right.mode}:${right.parameter}:${right.operator}:${right.value}:${right.secondValue}`)),
    cashOut: {
      enabled: Boolean(bot.cashOut?.enabled),
      fromMinute: bot.cashOut?.fromMinute,
      toMinute: bot.cashOut?.toMinute,
      exitLogic: bot.cashOut?.exitLogic ?? 'AND',
      exitRules: (bot.cashOut?.exitRules ?? [])
        .filter((rule) => rule.parameter)
        .map((rule) => ({
          parameter: rule.parameter,
          operator: rule.operator,
          value: rule.value,
          secondValue: rule.secondValue,
          connector: rule.connector ?? 'AND',
        })),
    },
  };

  let hash = 0x811c9dc5;
  const text = stableStringify(payload);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `auto-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const getDecimals = (step?: number) => {
  const text = String(step ?? 1);
  const [, decimals = ''] = text.split('.');
  return decimals.length;
};

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
};

const varyNumber = (value: number, min: number | undefined, max: number | undefined, step: number | undefined, seed: number) => {
  const realStep = step ?? 1;
  const direction = seed % 2 === 0 ? 1 : -1;
  const multiplier = 1 + Math.floor(seed / 2) % 4;
  return round(clamp(value + direction * realStep * multiplier, min, max), getDecimals(realStep));
};

const varyRule = (rule: BotRule, seed: number): BotRule => {
  const option = getParameterOption(rule.mode, rule.parameter);
  const step = option?.step ?? (typeof rule.value === 'number' && Math.abs(rule.value) < 5 ? 0.05 : 1);

  if (isNumeric(rule.value)) {
    const value = varyNumber(rule.value, option?.min, option?.max, step, seed);
    const secondValue = rule.operator === 'between' && isNumeric(rule.secondValue)
      ? Math.max(value, varyNumber(rule.secondValue, option?.min, option?.max, step, seed + 1))
      : rule.secondValue;
    return { ...rule, value, secondValue };
  }

  if (rule.operator === 'between' && isNumeric(rule.secondValue)) {
    return { ...rule, secondValue: varyNumber(rule.secondValue, option?.min, option?.max, step, seed) };
  }

  return rule;
};

const varyOdds = (bot: Bot, seed: number) => {
  const patch: Partial<Bot> = {};
  if (isNumeric(bot.minOdd)) patch.minOdd = round(clamp(bot.minOdd + (seed % 2 === 0 ? 0.05 : -0.05) * (1 + (seed % 3)), 1.01, 50), 2);
  if (isNumeric(bot.maxOdd)) patch.maxOdd = round(clamp(bot.maxOdd + (seed % 2 === 0 ? 0.05 : -0.05) * (1 + ((seed + 1) % 3)), patch.minOdd ?? 1.01, 50), 2);
  return patch;
};

export const buildAutonomousReportVariants = (baseBot: Bot, existingJobs: BacktestJob[], quantity = MAX_BATCH_SIZE): AutonomousReportBatchResult => {
  const targetQuantity = Math.max(1, Math.min(quantity, MAX_BATCH_SIZE));
  const existingHashes = new Set(
    existingJobs
      .map((job) => job.automation?.hash ?? createAutonomousReportHash(job.botSnapshot))
      .filter(Boolean),
  );
  const variants: Bot[] = [];
  let skipped = 0;
  const numericRuleIndexes = baseBot.rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => rule.parameter && (isNumeric(rule.value) || isNumeric(rule.secondValue)))
    .map(({ index }) => index);

  for (let seed = 1; variants.length < targetQuantity && seed <= targetQuantity * 80; seed += 1) {
    const now = new Date().toISOString();
    const ruleIndex = numericRuleIndexes.length ? numericRuleIndexes[(seed - 1) % numericRuleIndexes.length] : -1;
    const rules = baseBot.rules.map((rule, index) => (index === ruleIndex ? varyRule(rule, seed) : rule));
    const oddPatch = varyOdds(baseBot, seed);
    const candidate: Bot = {
      ...baseBot,
      ...oddPatch,
      id: uid('auto-bot'),
      name: `${baseBot.name || 'Relatorio'} auto ${String(seed).padStart(2, '0')}`,
      description: `${baseBot.description ?? ''}${baseBot.description ? '\n' : ''}Gerado automaticamente com variacao de parametros.`,
      isActive: true,
      rules,
      createdAt: now,
      updatedAt: now,
    };
    const hash = createAutonomousReportHash(candidate);

    if (existingHashes.has(hash)) {
      skipped += 1;
      continue;
    }

    existingHashes.add(hash);
    variants.push(candidate);
  }

  return { created: variants.length, skipped, variants };
};

const buildRandomMarketBot = (market: AutonomousMarketOption, seed: number): Bot => {
  const now = new Date().toISOString();
  const entryMinuteFrom = randomFrom([8, 12, 18, 25, 30, 35, 45, 52, 60], seed + 1);
  const entryMinuteTo = Math.min(85, entryMinuteFrom + randomFrom([8, 10, 12, 15, 20], seed + 2));
  const minOdd = randomFloat(1.35, 2.45, 0.05, seed + 3);
  const maxOdd = round(minOdd + randomFloat(0.35, 1.6, 0.05, seed + 4), 2);
  const score = randomFrom(['0-0', '1-0', '0-1', '1-1', '2-0', '0-2'], seed + 5);
  const includeScoreRule = randomInt(0, 100, seed + 6) >= 35;
  const includeAwayGoalsRule = randomInt(0, 100, seed + 7) >= 10;
  const includePerformanceRule = randomInt(0, 100, seed + 8) >= 15;
  const includeTotalGoalsRule = randomInt(0, 100, seed + 9) >= 25;
  const includeFormRule = randomInt(0, 100, seed + 10) >= 45;

  const rules: BotRule[] = [
    makeRule('live', 'minute', 'between', entryMinuteFrom, entryMinuteTo),
    ...(includeScoreRule ? [makeRule('live', 'score', '=', score)] : []),
    ...(includePerformanceRule ? [makeRule('pre-live', 'performance', '>=', randomInt(40, 72, seed + 11))] : []),
    ...(includeAwayGoalsRule ? [makeRule('pre-live', 'pre:homeAway:away:awayOnly:goalsForAvg', '>=', randomFloat(0.7, 2.2, 0.1, seed + 12))] : []),
    ...(includeTotalGoalsRule ? [makeRule('pre-live', 'pre:totalGoals:combined:season', '>=', randomFloat(1.8, 3.4, 0.1, seed + 13))] : []),
    ...(includeFormRule ? [makeRule('pre-live', 'pre:form:points:favorite:last5', '>=', randomInt(4, 12, seed + 14))] : []),
  ];

  return {
    id: uid('generated-report-bot'),
    name: `Gerador - ${market.label}`,
    description: `Relatorio autonomo gerado para o mercado ${market.label}.`,
    isActive: true,
    mode: 'live',
    sport: 'Futebol',
    market: market.value,
    oddMarket: market.value,
    operation: 'BACK',
    minOdd,
    maxOdd,
    stake: 1,
    rules,
    includedLeagues: [],
    excludedLeagues: [],
    cashOut: {
      enabled: false,
      exitLogic: 'AND',
      exitRules: [],
    },
    createdAt: now,
    updatedAt: now,
  };
};

export const buildMarketAutonomousReportVariants = (
  marketValue: string,
  existingJobs: BacktestJob[],
  quantity = MAX_BATCH_SIZE,
): AutonomousReportBatchResult => {
  const market = AUTONOMOUS_MARKET_OPTIONS.find((option) => option.value === marketValue) ?? AUTONOMOUS_MARKET_OPTIONS[0];
  const targetQuantity = Math.max(1, Math.min(quantity, MAX_BATCH_SIZE));
  const existingHashes = new Set(existingJobs.map((job) => job.automation?.hash ?? createAutonomousReportHash(job.botSnapshot)));
  const variants: Bot[] = [];
  let skipped = 0;
  const seedStart = Date.now() % 1000000;

  for (let offset = 1; variants.length < targetQuantity && offset <= targetQuantity * 120; offset += 1) {
    const candidate = buildRandomMarketBot(market, seedStart + offset);
    candidate.name = `${candidate.name} ${String(offset).padStart(2, '0')}`;
    const hash = createAutonomousReportHash(candidate);
    if (existingHashes.has(hash)) {
      skipped += 1;
      continue;
    }
    existingHashes.add(hash);
    variants.push(candidate);
  }

  return { created: variants.length, skipped, variants };
};
