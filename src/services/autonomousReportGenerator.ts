import { BacktestJob, Bot, BotRule } from '../types';
import { uid } from '../utils/formatters';
import { getParameterOption } from './parameterCatalog';

export type AutonomousReportBatchResult = {
  created: number;
  skipped: number;
  variants: Bot[];
};

const MAX_BATCH_SIZE = 10;

const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

const isNumeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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
