import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Save, X } from 'lucide-react';
import { Bot, BotMode, BotRule, BotRuleConnector, BotRuleOperator } from '../types';
import { apiFootballService } from '../services/apiFootball';
import {
  ParameterOption,
  cashOutParameters,
  getParameterOption,
  getParameterOptions,
  groupParameterOptions,
  liveParameters,
  preLiveParameters,
} from '../services/parameterCatalog';
import { uid } from '../utils/formatters';
import { Button } from './Button';
import { Card } from './Card';
import { Field, Input, Select, Textarea } from './FormControls';

type BotFormProps = {
  initialBot?: Bot;
  defaultStake: number;
  onSave: (bot: Bot) => void;
};

const gameSituationParameters: ParameterOption[] = [
  { value: 'gameDraw', label: 'Jogo empatado', category: 'Resultado atual', min: 0, max: 0, defaultFrom: 0, defaultTo: 0 },
  { value: 'homeWinning', label: 'Mandante vencendo', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'homeDrawing', label: 'Mandante empatando', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'homeLosing', label: 'Mandante perdendo', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayWinning', label: 'Visitante vencendo', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayDrawing', label: 'Visitante empatando', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayLosing', label: 'Visitante perdendo', category: 'Resultado atual', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteWinning', label: 'Favorito vencendo', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteDrawing', label: 'Favorito empatando', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteLosing', label: 'Favorito perdendo', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogWinning', label: 'Zebra vencendo', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogDrawing', label: 'Zebra empatando', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogLosing', label: 'Zebra perdendo', category: 'Favorito/Zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteGoalDiff', label: 'Diferenca de gols do favorito', category: 'Diferenca de gols', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'underdogGoalDiff', label: 'Diferenca de gols da zebra', category: 'Diferenca de gols', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'homeGoalDiff', label: 'Diferenca de gols do mandante', category: 'Diferenca de gols', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'awayGoalDiff', label: 'Diferenca de gols do visitante', category: 'Diferenca de gols', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'favoriteWinningGoalDiff', label: 'Favorito vencendo - dif. gols', category: 'Diferenca de gols', min: 1, max: 20, defaultFrom: 1, defaultTo: 20 },
  { value: 'favoriteNotLosingGoalDiff', label: 'Favorito empatando ou vencendo - dif. gols', category: 'Diferenca de gols', min: 0, max: 20, defaultFrom: 0, defaultTo: 20 },
  { value: 'underdogWinningGoalDiff', label: 'Zebra vencendo - dif. gols', category: 'Diferenca de gols', min: 1, max: 20, defaultFrom: 1, defaultTo: 20 },
  { value: 'underdogNotLosingGoalDiff', label: 'Zebra empatando ou vencendo - dif. gols', category: 'Diferenca de gols', min: 0, max: 20, defaultFrom: 0, defaultTo: 20 },
  { value: 'anyTeamWinningGoalDiff', label: 'Qualquer time vencendo por X gols', category: 'Diferenca de gols', min: 1, max: 20, defaultFrom: 1, defaultTo: 20 },
  { value: 'scoreChanged', label: 'Placar mudou', category: 'Mudanca de placar', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'scoreUnchanged', label: 'Placar nao mudou', category: 'Mudanca de placar', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteGoal', label: 'Gol do favorito', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'underdogGoal', label: 'Gol da zebra', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'homeGoal', label: 'Gol do mandante', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'awayGoal', label: 'Gol do visitante', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'favoriteConceded', label: 'Favorito sofreu gol', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'underdogConceded', label: 'Zebra sofreu gol', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'homeConceded', label: 'Mandante sofreu gol', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
  { value: 'awayConceded', label: 'Visitante sofreu gol', category: 'Mudanca de placar', min: 1, max: 10, defaultFrom: 1, defaultTo: 10 },
];

const gameSituationRoleOptions = [
  { value: 'any', label: 'Casa é favorito ou underdog' },
  { value: 'homeFavorite', label: 'Casa é favorito' },
  { value: 'awayFavorite', label: 'Visitante é favorito' },
];

const goalLines = ['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'];
const goalMarkets = goalLines.flatMap((line) => [`Over ${line}`, `Under ${line}`]);
const firstHalfGoalLines = ['0.5', '1.5', '2.5', '3.5'];

const oddMarkets = [
  '',
  'Odd - Casa',
  'Odd - Empate',
  'Odd - Fora',
  'Odd - Favorito',
  'Odd - Zebra',
  ...goalLines.flatMap((line) => [`Odd - Over Gol (+ ${line}G)`, `Odd - Under Gol (+ ${line}G)`]),
  ...firstHalfGoalLines.flatMap((line) => [`Odd - Over ${line} HT`, `Odd - Under ${line} HT`]),
  'Odd - BTTS Sim',
  'Odd - BTTS Nao',
  'Odd - Dupla chance Favorito-Underdog',
  'Odd - Dupla chance Underdog-Empate',
];

const markets = ['', ...goalMarkets, 'Ambas Marcam', 'Match Odds', 'Empate'];

type LeagueOption = {
  value: string;
  label: string;
};

const fallbackLeagueOptions: LeagueOption[] = [
  { value: 'Serie A', label: 'Serie A - Brasil' },
  { value: 'Serie B', label: 'Serie B - Brasil' },
  { value: 'Copa do Brasil', label: 'Copa do Brasil - Brasil' },
  { value: 'Paulista - A1', label: 'Paulista - A1 - Brasil' },
  { value: 'Carioca - 1', label: 'Carioca - 1 - Brasil' },
  { value: 'Liga Profesional Argentina', label: 'Liga Profesional Argentina - Argentina' },
  { value: 'Premier League', label: 'Premier League - England' },
  { value: 'Championship', label: 'Championship - England' },
  { value: 'League One', label: 'League One - England' },
  { value: 'League Two', label: 'League Two - England' },
  { value: 'La Liga', label: 'La Liga - Spain' },
  { value: 'Segunda Division', label: 'Segunda Division - Spain' },
  { value: 'Serie A', label: 'Serie A - Italy' },
  { value: 'Serie B', label: 'Serie B - Italy' },
  { value: 'Bundesliga', label: 'Bundesliga - Germany' },
  { value: '2. Bundesliga', label: '2. Bundesliga - Germany' },
  { value: 'Ligue 1', label: 'Ligue 1 - France' },
  { value: 'Ligue 2', label: 'Ligue 2 - France' },
  { value: 'Primeira Liga', label: 'Primeira Liga - Portugal' },
  { value: 'Eredivisie', label: 'Eredivisie - Netherlands' },
  { value: 'Major League Soccer', label: 'Major League Soccer - USA' },
  { value: 'World Cup', label: 'World Cup - World' },
  { value: 'UEFA Champions League', label: 'UEFA Champions League - World' },
  { value: 'UEFA Europa League', label: 'UEFA Europa League - World' },
  { value: 'CONMEBOL Libertadores', label: 'CONMEBOL Libertadores - World' },
  { value: 'CONMEBOL Sudamericana', label: 'CONMEBOL Sudamericana - World' },
];

const connectors: BotRuleConnector[] = ['AND', 'OR', 'NOT'];
const numericOperators: BotRuleOperator[] = ['between', '>=', '<=', '=', '!='];
const textOperators: BotRuleOperator[] = ['=', '!='];
const gameSituationRuleParameters = ['favoriteSide', ...gameSituationParameters.map((parameter) => parameter.value).filter(Boolean)];

const isGameSituationRule = (rule: BotRule) => gameSituationRuleParameters.includes(rule.parameter);

const getModeForRules = (rules: BotRule[]): BotMode =>
  rules.some((rule) => rule.mode === 'live' && rule.parameter) ? 'live' : 'pre-live';

const toOptionalNumber = (value: string) => {
  if (value.trim() === '') return undefined;
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const valueForOption = (value: string, option?: ParameterOption) => {
  if (option?.valueType === 'text') return value;
  return toOptionalNumber(value) ?? value;
};

const normalizeSearchText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const filterParameterOptions = (options: ParameterOption[], search: string, selectedValue?: string) => {
  const query = normalizeSearchText(search).trim();
  if (!query) return options;

  const filtered = options.filter((option) =>
    normalizeSearchText(`${option.label} ${option.category ?? ''} ${option.value}`).includes(query),
  );
  const selected = selectedValue ? options.find((option) => option.value === selectedValue) : undefined;
  if (selected && !filtered.some((option) => option.value === selected.value)) return [selected, ...filtered];
  return filtered;
};

const filterStringOptions = (options: string[], search: string, selectedValue?: string) => {
  const query = normalizeSearchText(search).trim();
  if (!query) return options;

  const filtered = options.filter((option) => !option || normalizeSearchText(option).includes(query));
  if (selectedValue && !filtered.includes(selectedValue)) return [selectedValue, ...filtered];
  return filtered;
};

const createRule = (mode: BotMode, parameter = ''): BotRule => {
  const option = getParameterOption(mode, parameter);

  return {
    id: uid('rule'),
    mode,
    parameter,
    operator: option?.valueType === 'text' ? '=' : 'between',
    value: option?.defaultFrom ?? '',
    secondValue: option?.valueType === 'text' ? undefined : (option?.defaultTo ?? ''),
    connector: 'AND',
  };
};

const createPreLiveOddRule = (): BotRule => ({
  ...createRule('pre-live', 'preLiveOdds'),
  operator: '<=',
  value: 1.8,
  secondValue: undefined,
});

const createGameSituationRoleRule = (): BotRule => ({
  id: uid('rule'),
  mode: 'live',
  parameter: 'favoriteSide',
  operator: '=',
  value: 'any',
  connector: 'AND',
});

const createGameSituationMetricRule = (): BotRule => ({
  id: uid('rule'),
  mode: 'live',
  parameter: 'gameDraw',
  operator: 'between',
  value: 0,
  secondValue: 0,
  connector: 'AND',
});

const getOptionFromList = (options: ParameterOption[], parameter: string) => options.find((option) => option.value === parameter);

const createCashOutRule = (): BotRule => {
  const option = getOptionFromList(cashOutParameters, 'cashout.current.odd');
  return {
    id: uid('rule'),
    mode: 'live',
    parameter: 'cashout.current.odd',
    operator: '<=',
    value: option?.defaultFrom ?? 1.5,
    secondValue: undefined,
    connector: 'AND',
  };
};

export function createDefaultBot(_defaultStake: number): Bot {
  const now = new Date().toISOString();

  return {
    id: uid('bot'),
    name: '',
    description: '',
    isActive: true,
    mode: 'live',
    sport: 'Futebol',
    market: '',
    oddMarket: undefined,
    operation: 'BACK',
    minOdd: undefined,
    maxOdd: undefined,
    stake: 1,
    rules: [createRule('live', 'minute')],
    includedLeagues: [],
    excludedLeagues: [],
    cashOut: {
      enabled: false,
      fromMinute: undefined,
      toMinute: undefined,
      exitLogic: 'AND',
      exitRules: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

function RangeLine({ min, max, from, to }: { min: number; max: number; from: string; to: string }) {
  const rangeFrom = toOptionalNumber(from) ?? min;
  const rangeTo = toOptionalNumber(to) ?? rangeFrom;
  const percentFrom = Math.max(0, Math.min(100, ((rangeFrom - min) / (max - min || 1)) * 100));
  const percentTo = Math.max(percentFrom, Math.min(100, ((rangeTo - min) / (max - min || 1)) * 100));

  return (
    <div className="relative mt-6 h-9">
      <div className="absolute left-0 right-0 top-3 h-2 rounded-full bg-slate-700" />
      <div
        className="absolute top-3 h-2 rounded-full bg-violet-500"
        style={{ left: `${percentFrom}%`, width: `${percentTo - percentFrom}%` }}
      />
      <div className="absolute top-0 h-7 w-7 -translate-x-1/2 rounded-full border border-white/30 bg-slate-100 shadow" style={{ left: `${percentFrom}%` }} />
      <div className="absolute top-0 h-7 w-7 -translate-x-1/2 rounded-full border border-white/30 bg-slate-100 shadow" style={{ left: `${percentTo}%` }} />
      <span className="absolute top-7 -translate-x-1/2 rounded-md bg-violet-600 px-2 py-1 text-xs font-bold text-white" style={{ left: `${percentFrom}%` }}>
        {from || min}
      </span>
      <span className="absolute top-7 -translate-x-1/2 rounded-md bg-violet-600 px-2 py-1 text-xs font-bold text-white" style={{ left: `${percentTo}%` }}>
        {to || max}
      </span>
    </div>
  );
}

function RangeRuleCard({
  rule,
  mode,
  index,
  optionsOverride,
  onSwitchMode,
  onRemove,
  onPatch,
}: {
  rule: BotRule;
  mode: BotMode;
  index: number;
  optionsOverride?: ParameterOption[];
  onSwitchMode?: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<BotRule>) => void;
}) {
  const options = optionsOverride ?? getParameterOptions(mode);
  const selectedOption = optionsOverride ? getOptionFromList(optionsOverride, rule.parameter) : getParameterOption(mode, rule.parameter);
  const [parameterSearch, setParameterSearch] = useState('');
  const isText = selectedOption?.valueType === 'text';
  const min = selectedOption?.min ?? 0;
  const max = selectedOption?.max ?? 100;
  const step = selectedOption?.step ?? 1;
  const from = String(rule.value ?? '');
  const to = String(rule.secondValue ?? '');
  const operatorOptions = isText ? textOperators : numericOperators;
  const showSecondValue = !isText && rule.operator === 'between';
  const filteredOptions = filterParameterOptions(options, parameterSearch, rule.parameter);

  const updateParameter = (parameter: string) => {
    const option = optionsOverride ? getOptionFromList(optionsOverride, parameter) : getParameterOption(mode, parameter);
    onPatch({
      parameter,
      operator: option?.valueType === 'text' ? '=' : 'between',
      value: option?.defaultFrom ?? '',
      secondValue: option?.valueType === 'text' ? undefined : (option?.defaultTo ?? ''),
    });
  };

  return (
    <div className="relative rounded-lg border border-violet-500/80 bg-ink-900/95 p-5 text-slate-100 shadow-glow">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        title="Remover bloco"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pr-10">
        {onSwitchMode && (
          <button
            type="button"
            onClick={onSwitchMode}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-ink-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-violet-400 hover:text-white"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Mudar para {mode === 'live' ? 'pre-live' : 'ao vivo'}
          </button>
        )}

        {index > 0 && (
          <label className="w-full">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Combinar</span>
            <select
              value={rule.connector ?? 'AND'}
              onChange={(event) => onPatch({ connector: event.target.value as BotRuleConnector })}
              className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            >
              {connectors.map((connector) => (
                <option key={connector}>{connector}</option>
              ))}
            </select>
          </label>
        )}

        <label className="w-full">
          <span className="mb-2 block text-sm font-medium text-slate-300">Parametro</span>
          <input
            type="search"
            value={parameterSearch}
            onChange={(event) => setParameterSearch(event.target.value)}
            placeholder="Pesquisar parametro"
            className="mb-2 min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          <select
            value={rule.parameter}
            onChange={(event) => updateParameter(event.target.value)}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">Selecione</option>
            {groupParameterOptions(filteredOptions).map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
            {filteredOptions.length === 0 && <option value="" disabled>Nenhum parametro encontrado</option>}
          </select>
        </label>

        <label className="w-full">
          <span className="mb-2 block text-sm font-medium text-slate-300">Operador</span>
          <select
            value={rule.operator}
            onChange={(event) => onPatch({ operator: event.target.value as BotRuleOperator })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            {operatorOptions.map((operator) => (
              <option key={operator} value={operator}>
                {operator === 'between' ? 'entre' : operator}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isText ? (
        <div className="mx-auto mt-5 max-w-3xl">
          <label>
            <span className="mb-2 block text-sm font-medium text-slate-300">Valor</span>
            <input
              value={from}
              onChange={(event) => onPatch({ value: event.target.value })}
              className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </label>
        </div>
      ) : (
        <div className="mt-5">
          <div className={`grid items-end gap-5 ${showSecondValue ? 'md:grid-cols-[1fr_auto_1fr]' : 'md:grid-cols-1'}`}>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">{showSecondValue ? 'De' : 'Valor'}</span>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={from}
                onChange={(event) => onPatch({ value: valueForOption(event.target.value, selectedOption) })}
                className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>
            {showSecondValue && (
              <>
                <span className="pb-2 text-xl text-slate-500">-&gt;</span>
                <label>
                  <span className="mb-2 block text-sm font-medium text-slate-300">Ate</span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={to}
                    onChange={(event) => onPatch({ secondValue: valueForOption(event.target.value, selectedOption) })}
                    className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </label>
              </>
            )}
          </div>

          {showSecondValue && <RangeLine min={min} max={max} from={from} to={to} />}
        </div>
      )}
    </div>
  );
}

function PreLiveRuleCard({
  rule,
  index,
  oddMarket,
  onSwitchMode,
  onRemove,
  onPatch,
  onOddMarketChange,
}: {
  rule: BotRule;
  index: number;
  oddMarket?: string;
  onSwitchMode?: () => void;
  onRemove: () => void;
  onPatch: (patch: Partial<BotRule>) => void;
  onOddMarketChange: (oddMarket?: string) => void;
}) {
  const isOddsRule = rule.parameter === 'preLiveOdds';
  const dataOptions = preLiveParameters.filter((option) => option.value !== 'preLiveOdds');
  const [parameterSearch, setParameterSearch] = useState('');
  const selectedDataOption = getParameterOption('pre-live', rule.parameter);
  const selectedOption: ParameterOption | undefined = isOddsRule
    ? { value: 'preLiveOdds', label: 'Odds pre-live', min: 1.01, max: 200, step: 0.01, defaultFrom: 1.8 }
    : selectedDataOption;
  const isText = !isOddsRule && selectedOption?.valueType === 'text';
  const operatorOptions = isText ? textOperators : (['<=', '>=', '=', '!='] as BotRuleOperator[]);
  const parameterValue = isOddsRule ? (oddMarket ?? '') : rule.parameter;
  const filteredDataOptions = filterParameterOptions(dataOptions, parameterSearch, rule.parameter);
  const filteredOddMarkets = filterStringOptions(oddMarkets, parameterSearch, oddMarket);

  const changeType = (type: 'odds' | 'data') => {
    if (type === 'odds') {
      onOddMarketChange(oddMarket || oddMarkets[1]);
      onPatch({ parameter: 'preLiveOdds', operator: '<=', value: 1.8, secondValue: undefined });
      return;
    }

    const option = getParameterOption('pre-live', 'averageGoals');
    onPatch({ parameter: 'averageGoals', operator: '<=', value: option?.defaultFrom ?? '', secondValue: undefined });
  };

  const changeParameter = (parameter: string) => {
    if (isOddsRule) {
      onOddMarketChange(parameter || undefined);
      onPatch({ parameter: 'preLiveOdds', operator: '<=', value: rule.value || 1.8, secondValue: undefined });
      return;
    }

    const option = getParameterOption('pre-live', parameter);
    onPatch({
      parameter,
      operator: option?.valueType === 'text' ? '=' : '<=',
      value: option?.defaultFrom ?? '',
      secondValue: undefined,
    });
  };

  const conditionLabel = (operator: BotRuleOperator) => {
    if (operator === '<=') return 'menor que';
    if (operator === '>=') return 'maior que';
    if (operator === '=') return 'igual a';
    if (operator === '!=') return 'diferente de';
    return 'entre';
  };

  return (
    <div className="relative rounded-lg border border-amber-400/90 bg-ink-900/95 px-5 py-7 text-slate-100 shadow-glow">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        title="Remover bloco"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto flex max-w-2xl justify-center pr-10">
        {onSwitchMode && (
          <button
            type="button"
            onClick={onSwitchMode}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-ink-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-amber-300 hover:text-white"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Mudar para live
          </button>
        )}
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-7 lg:grid-cols-2">
        {index > 0 && (
          <label className="lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-300">Combinar</span>
            <select
              value={rule.connector ?? 'AND'}
              onChange={(event) => onPatch({ connector: event.target.value as BotRuleConnector })}
              className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            >
              {connectors.map((connector) => (
                <option key={connector}>{connector}</option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Tipo</span>
          <select
            value={isOddsRule ? 'odds' : 'data'}
            onChange={(event) => changeType(event.target.value as 'odds' | 'data')}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          >
            <option value="odds">Odds pre-live</option>
            <option value="data">Dados pre-live</option>
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Condicao</span>
          <select
            value={rule.operator}
            onChange={(event) => onPatch({ operator: event.target.value as BotRuleOperator, secondValue: undefined })}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          >
            {operatorOptions.map((operator) => (
              <option key={operator} value={operator}>
                {conditionLabel(operator)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Parametro</span>
          <input
            type="search"
            value={parameterSearch}
            onChange={(event) => setParameterSearch(event.target.value)}
            placeholder={isOddsRule ? 'Pesquisar odd' : 'Pesquisar parametro'}
            className="mb-2 min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
          <select
            value={parameterValue}
            onChange={(event) => changeParameter(event.target.value)}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          >
            {isOddsRule ? (
              filteredOddMarkets.map((market) => (
                <option key={market} value={market}>
                  {market || 'Selecione uma odd'}
                </option>
              ))
            ) : (
              groupParameterOptions(filteredDataOptions).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
            {((isOddsRule && filteredOddMarkets.length === 0) || (!isOddsRule && filteredDataOptions.length === 0)) && (
              <option value="" disabled>Nenhum parametro encontrado</option>
            )}
          </select>
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Valor</span>
          <input
            type={isText ? 'text' : 'number'}
            min={selectedOption?.min}
            max={selectedOption?.max}
            step={selectedOption?.step ?? 1}
            value={String(rule.value ?? '')}
            onChange={(event) => onPatch({ value: valueForOption(event.target.value, selectedOption) })}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
        </label>
      </div>
    </div>
  );
}

function OddRangeCard({
  mode,
  oddMarket,
  minOdd,
  maxOdd,
  onChange,
  onClear,
}: {
  mode: BotMode;
  oddMarket?: string;
  minOdd?: number;
  maxOdd?: number;
  onChange: (patch: Pick<Bot, 'oddMarket' | 'minOdd' | 'maxOdd'>) => void;
  onClear: () => void;
}) {
  const from = minOdd === undefined ? '' : String(minOdd);
  const to = maxOdd === undefined ? '' : String(maxOdd);

  return (
    <div className="relative rounded-lg border border-violet-500/80 bg-ink-900/95 px-5 py-7 text-slate-100 shadow-glow">
      <button
        type="button"
        onClick={onClear}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        title="Limpar filtro de odd"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto max-w-md pr-10">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Parametro</span>
          <select
            value={oddMarket ?? ''}
            onChange={(event) => onChange({ oddMarket: event.target.value || undefined, minOdd, maxOdd })}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            {oddMarkets.map((market) => (
              <option key={market} value={market}>
                {market || 'Selecione uma odd de mercado'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-7 grid items-end gap-5 md:grid-cols-[1fr_auto_1fr]">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">De</span>
          <input
            type="number"
            min={1.01}
            max={200}
            step={0.01}
            value={from}
            onChange={(event) => onChange({ oddMarket, minOdd: toOptionalNumber(event.target.value), maxOdd })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
        <span className="pb-2 text-xl text-slate-500">-&gt;</span>
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Ate</span>
          <input
            type="number"
            min={1.01}
            max={200}
            step={0.01}
            value={to}
            onChange={(event) => onChange({ oddMarket, minOdd, maxOdd: toOptionalNumber(event.target.value) })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
      </div>

      <RangeLine min={1} max={200} from={from || '1'} to={to || '200'} />
    </div>
  );
}

function GameSituationCard({
  roleRule,
  metricRule,
  onEnable,
  onClear,
  onPatchRole,
  onPatchMetric,
}: {
  roleRule?: BotRule;
  metricRule?: BotRule;
  onEnable: () => void;
  onClear: () => void;
  onPatchRole: (patch: Partial<BotRule>) => void;
  onPatchMetric: (patch: Partial<BotRule>) => void;
}) {
  const enabled = Boolean(metricRule);
  const selectedOption = gameSituationParameters.find((option) => option.value === metricRule?.parameter) ?? gameSituationParameters[0];
  const from = String(metricRule?.value ?? selectedOption.defaultFrom ?? '');
  const to = String(metricRule?.secondValue ?? selectedOption.defaultTo ?? '');
  const min = selectedOption.min ?? 0;
  const max = selectedOption.max ?? 20;
  const step = selectedOption.step ?? 1;

  const updateParameter = (parameter: string) => {
    if (!parameter) {
      onClear();
      return;
    }

    const option = gameSituationParameters.find((item) => item.value === parameter) ?? gameSituationParameters[0];
    onPatchMetric({
      parameter,
      operator: 'between',
      value: option.defaultFrom ?? '',
      secondValue: option.defaultTo ?? '',
    });
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-violet-500/80 bg-ink-900/95 p-5 text-slate-100 shadow-glow">
        <button
          type="button"
          onClick={onEnable}
          className="mx-auto flex h-20 w-full max-w-sm items-center justify-center rounded-lg border border-white/10 bg-ink-950 text-green-400 shadow-glow transition hover:border-green-500/70 hover:bg-green-500/10"
        >
          <Plus className="h-10 w-10" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border border-violet-500/80 bg-ink-900/95 px-5 py-7 text-slate-100 shadow-glow">
      <button
        type="button"
        onClick={onClear}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        title="Remover situacao de jogo"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto flex max-w-xl flex-col gap-4 pr-10">
        {gameSituationRoleOptions.map((option) => (
          <label key={option.value} className="flex items-center justify-center gap-4 text-sm font-semibold text-white">
            <input
              type="radio"
              name="favoriteSide"
              value={option.value}
              checked={(roleRule?.value ?? 'any') === option.value}
              onChange={(event) => onPatchRole({ value: event.target.value })}
              className="h-5 w-5 accent-violet-600"
            />
            <span>{option.label}</span>
          </label>
        ))}

        <label className="mt-2">
          <span className="mb-2 block text-sm font-medium text-slate-300">Parametro</span>
          <select
            value={metricRule?.parameter ?? ''}
            onChange={(event) => updateParameter(event.target.value)}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">Selecione</option>
            {groupParameterOptions(gameSituationParameters).map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((parameter) => (
                  <option key={parameter.value} value={parameter.value}>
                    {parameter.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-7 grid items-end gap-5 md:grid-cols-[1fr_auto_1fr]">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">De</span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={from}
            onChange={(event) => onPatchMetric({ value: valueForOption(event.target.value, selectedOption) })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
        <span className="pb-2 text-xl text-slate-500">-&gt;</span>
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Ate</span>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={to}
            onChange={(event) => onPatchMetric({ secondValue: valueForOption(event.target.value, selectedOption) })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
      </div>

      <RangeLine min={min} max={max} from={from} to={to} />
    </div>
  );
}

function LeagueSelector({
  title,
  options,
  loading,
  error,
  selected,
  onChange,
}: {
  title: string;
  options: LeagueOption[];
  loading?: boolean;
  error?: string;
  selected: string[];
  onChange: (leagues: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const selectedNormalized = selected.map((league) => league.trim().toLowerCase());
  const filteredLeagues = options
    .filter((league) => `${league.label} ${league.value}`.toLowerCase().includes(normalizedQuery))
    .filter((league) => !selectedNormalized.includes(league.value.toLowerCase()))
    .slice(0, 80);

  const addLeague = (league: LeagueOption) => {
    if (!selectedNormalized.includes(league.value.toLowerCase())) onChange([...selected, league.value]);
    setQuery('');
  };

  const removeLeague = (league: string) => onChange(selected.filter((item) => item !== league));

  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <button
          type="button"
          onClick={() => onChange([])}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-red-400/60 hover:text-red-300"
        >
          Limpar
        </button>
      </div>

      <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-white/10 bg-ink-950 px-3 py-2">
        {selected.map((league) => (
          <span key={league} className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
            {league}
            <button type="button" onClick={() => removeLeague(league)} className="text-white/80 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-sm text-slate-600">Nenhuma liga selecionada</span>}
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar liga suportada pela API"
        className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />
      {loading && <p className="mt-2 text-xs text-slate-500">Carregando ligas da API...</p>}
      {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

      <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-white/10 bg-ink-950">
        {filteredLeagues.map((league) => (
          <button
            key={`${league.label}-${league.value}`}
            type="button"
            onClick={() => addLeague(league)}
            className={`block w-full px-3 py-2 text-left text-sm transition ${
              selected.includes(league.value) ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="block font-medium">{league.value}</span>
            <span className="block text-xs text-slate-500">{league.label}</span>
          </button>
        ))}
        {filteredLeagues.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Nenhuma liga encontrada na lista carregada.</p>}
      </div>
    </div>
  );
}

export function BotForm({ initialBot, defaultStake, onSave }: BotFormProps) {
  const defaultBot = createDefaultBot(defaultStake);
  const [leagueOptions, setLeagueOptions] = useState<LeagueOption[]>(fallbackLeagueOptions);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [leagueLoadError, setLeagueLoadError] = useState<string | undefined>();
  const [bot, setBot] = useState<Bot>(() => {
    const rules = (initialBot?.rules ?? defaultBot.rules).map((rule) =>
      rule.mode === 'pre-live' && rule.operator === 'between'
        ? { ...rule, operator: '<=' as BotRuleOperator, secondValue: undefined }
        : rule,
    );

    return {
      ...(initialBot ?? defaultBot),
      mode: getModeForRules(rules),
      oddMarket: initialBot?.oddMarket ?? initialBot?.market,
      operation: 'BACK',
      stake: 1,
      rules,
      cashOut: initialBot?.cashOut ?? defaultBot.cashOut,
      includedLeagues: initialBot?.includedLeagues ?? [],
      excludedLeagues: initialBot?.excludedLeagues ?? [],
    };
  });

  useEffect(() => {
    let mounted = true;
    setLoadingLeagues(true);
    setLeagueLoadError(undefined);

    apiFootballService.buscarTodasLigas()
      .then((items) => {
        if (!mounted) return;
        const nextOptions = items
          .map((item) => ({
            value: item.league.name,
            label: `${item.league.name} - ${item.country.name}`,
          }))
          .filter((item) => item.value.trim().length > 0)
          .sort((a, b) => a.label.localeCompare(b.label));
        const unique = new Map<string, LeagueOption>();
        nextOptions.forEach((item) => {
          const key = `${item.value.toLowerCase()}|${item.label.toLowerCase()}`;
          if (!unique.has(key)) unique.set(key, item);
        });
        setLeagueOptions(unique.size > 0 ? [...unique.values()] : fallbackLeagueOptions);
      })
      .catch(() => {
        if (!mounted) return;
        setLeagueOptions(fallbackLeagueOptions);
        setLeagueLoadError('Nao foi possivel carregar a lista completa agora. Usando lista local de fallback.');
      })
      .finally(() => {
        if (mounted) setLoadingLeagues(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const sortedLeagueOptions = useMemo(() => {
    const selectedValues = [...(bot.includedLeagues ?? []), ...(bot.excludedLeagues ?? [])];
    const selectedOptions = selectedValues.map((league) => ({ value: league, label: league }));
    const map = new Map<string, LeagueOption>();
    [...selectedOptions, ...leagueOptions].forEach((item) => {
      const key = `${item.value.toLowerCase()}|${item.label.toLowerCase()}`;
      if (!map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [bot.excludedLeagues, bot.includedLeagues, leagueOptions]);

  const activeRules = bot.rules.filter((rule) => (bot.mode === 'live' || rule.mode === bot.mode) && !isGameSituationRule(rule));
  const gameSituationRoleRule = bot.rules.find((rule) => rule.parameter === 'favoriteSide');
  const gameSituationMetricRule = bot.rules.find((rule) => rule.mode === 'live' && isGameSituationRule(rule) && rule.parameter !== 'favoriteSide');

  const updateBot = (patch: Partial<Bot>) => setBot((current) => ({ ...current, ...patch }));

  const changeMode = (nextMode: BotMode) => {
    setBot((current) => {
      if (nextMode === 'pre-live') {
        const rules = current.rules
          .filter((rule) => !isGameSituationRule(rule))
          .map((rule) =>
            rule.mode === 'live'
              ? { ...createRule('pre-live', 'averageGoals'), id: rule.id, connector: rule.connector }
              : rule,
          );

        return {
          ...current,
          oddMarket: current.oddMarket || oddMarkets[1],
          market: current.market || current.oddMarket || oddMarkets[1],
          mode: 'pre-live',
          rules: rules.length ? rules : [createPreLiveOddRule()],
        };
      }

      const hasLiveRule = current.rules.some((rule) => rule.mode === 'live' && !isGameSituationRule(rule));
      return {
        ...current,
        mode: 'live',
        rules: hasLiveRule ? current.rules : [...current.rules, createRule('live', 'minute')],
      };
    });
  };

  const patchRule = (ruleId: string, patch: Partial<BotRule>) => {
    const rules = bot.rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
    updateBot({ rules, mode: getModeForRules(rules) });
  };

  const switchRuleMode = (rule: BotRule) => {
    const nextRule =
      rule.mode === 'live'
        ? { ...createRule('pre-live', 'averageGoals'), id: rule.id, connector: rule.connector }
        : { ...createRule('live', 'minute'), id: rule.id, connector: rule.connector };
    const rules = bot.rules.map((item) => (item.id === rule.id ? nextRule : item));
    updateBot({
      rules,
      mode: getModeForRules(rules),
      oddMarket: nextRule.mode === 'pre-live' ? (bot.oddMarket || oddMarkets[1]) : bot.oddMarket,
      market: nextRule.mode === 'pre-live' ? (bot.market || bot.oddMarket || oddMarkets[1]) : bot.market,
    });
  };

  const addRule = () => {
    const rule = bot.mode === 'pre-live' ? createPreLiveOddRule() : createRule('live', 'minute');
    const rules = [...bot.rules, rule];
    updateBot({ rules, mode: getModeForRules(rules) });
  };

  const removeRule = (ruleId: string) => {
    const rules = bot.rules.filter((rule) => rule.id !== ruleId);
    updateBot({ rules, mode: getModeForRules(rules) });
  };

  const enableGameSituation = () => {
    const existingRole = bot.rules.some((rule) => rule.parameter === 'favoriteSide');
    const existingMetric = bot.rules.some((rule) => rule.mode === 'live' && isGameSituationRule(rule) && rule.parameter !== 'favoriteSide');
    const rules = [
      ...bot.rules,
      ...(existingRole ? [] : [createGameSituationRoleRule()]),
      ...(existingMetric ? [] : [createGameSituationMetricRule()]),
    ];
    updateBot({ rules, mode: 'live' });
  };

  const clearGameSituation = () => {
    const rules = bot.rules.filter((rule) => !isGameSituationRule(rule));
    updateBot({ rules, mode: getModeForRules(rules) });
  };

  const patchGameSituationRole = (patch: Partial<BotRule>) => {
    const hasRoleRule = bot.rules.some((rule) => rule.parameter === 'favoriteSide');
    const rules = hasRoleRule
      ? bot.rules.map((rule) => (rule.parameter === 'favoriteSide' ? { ...rule, ...patch } : rule))
      : [...bot.rules, { ...createGameSituationRoleRule(), ...patch }];
    updateBot({ rules, mode: 'live' });
  };

  const patchGameSituationMetric = (patch: Partial<BotRule>) => {
    const rules = bot.rules.map((rule) =>
      rule.mode === 'live' && isGameSituationRule(rule) && rule.parameter !== 'favoriteSide' ? { ...rule, ...patch } : rule,
    );
    updateBot({ rules, mode: 'live' });
  };

  const patchCashOutRule = (ruleId: string, patch: Partial<BotRule>) => {
    const cashOut = bot.cashOut ?? { enabled: false, exitRules: [] };
    const exitRules = cashOut.exitRules ?? [];
    updateBot({
      cashOut: {
        ...cashOut,
        exitRules: exitRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)),
      },
    });
  };

  const addCashOutRule = () => {
    const cashOut = bot.cashOut ?? { enabled: false, exitRules: [] };
    updateBot({
      cashOut: {
        ...cashOut,
        enabled: true,
        exitRules: [...(cashOut.exitRules ?? []), createCashOutRule()],
      },
    });
  };

  const removeCashOutRule = (ruleId: string) => {
    const cashOut = bot.cashOut ?? { enabled: false, exitRules: [] };
    updateBot({
      cashOut: {
        ...cashOut,
        exitRules: (cashOut.exitRules ?? []).filter((rule) => rule.id !== ruleId),
      },
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const market = bot.market || bot.oddMarket;
    const rules = bot.rules.filter((rule) => rule.parameter);

    onSave({
      ...bot,
      name: String(form.get('name') ?? '').trim() || 'Metodo sem nome',
      description: String(form.get('description') ?? ''),
      isActive: true,
      mode: getModeForRules(rules),
      market: market || undefined,
      oddMarket: bot.oddMarket || undefined,
      operation: 'BACK',
      stake: 1,
      rules,
      includedLeagues: bot.includedLeagues ?? [],
      excludedLeagues: bot.excludedLeagues ?? [],
      cashOut: {
        enabled: Boolean(bot.cashOut?.enabled),
        fromMinute: bot.cashOut?.fromMinute,
        toMinute: bot.cashOut?.toMinute,
        exitLogic: bot.cashOut?.exitLogic ?? 'AND',
        exitRules: bot.cashOut?.exitRules?.filter((rule) => rule.parameter) ?? [],
      },
      updatedAt: now,
      createdAt: bot.createdAt || now,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card title="Identidade do metodo" subtitle="Defina nome e modo operacional. Bots salvos ficam ativos para simulacoes.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Nome">
            <Input name="name" value={bot.name} onChange={(event) => updateBot({ name: event.target.value })} placeholder="Ex: Over pressao 65+" required />
          </Field>
          <Field label="Modo atual">
            <Select value={bot.mode} onChange={(event) => changeMode(event.target.value as BotMode)}>
              <option value="live">Ao vivo</option>
              <option value="pre-live">Pre-live</option>
            </Select>
          </Field>
          <div className="lg:col-span-2">
            <Field label="Descricao">
              <Textarea name="description" value={bot.description ?? ''} onChange={(event) => updateBot({ description: event.target.value })} placeholder="Resumo do racional do metodo" />
            </Field>
          </div>
        </div>
      </Card>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">Passo 1: escolha dos parametros gerais</h2>
        {activeRules.map((rule, index) => (
          rule.mode === 'pre-live' ? (
            <PreLiveRuleCard
              key={rule.id}
              rule={rule}
              index={index}
              oddMarket={bot.oddMarket}
              onSwitchMode={() => switchRuleMode(rule)}
              onRemove={() => removeRule(rule.id)}
              onPatch={(patch) => patchRule(rule.id, patch)}
              onOddMarketChange={(oddMarket) => updateBot({ oddMarket })}
            />
          ) : (
            <RangeRuleCard
              key={rule.id}
              rule={rule}
              mode={rule.mode}
              index={index}
              onSwitchMode={() => switchRuleMode(rule)}
              onRemove={() => removeRule(rule.id)}
              onPatch={(patch) => patchRule(rule.id, patch)}
            />
          )
        ))}
        <button type="button" onClick={addRule} className="mx-auto flex h-24 w-full max-w-sm items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-green-400 shadow-glow transition hover:border-green-500/70 hover:bg-green-500/10">
          <Plus className="h-12 w-12" />
        </button>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">
          Passo 2: escolha um mercado (opcional) e filtre a odd {bot.mode === 'live' ? 'live' : 'pre-live'} (opcional)
        </h2>
        <OddRangeCard
          mode={bot.mode}
          oddMarket={bot.oddMarket}
          minOdd={bot.minOdd}
          maxOdd={bot.maxOdd}
          onChange={(patch) => updateBot({ ...patch, market: 'oddMarket' in patch ? patch.oddMarket : bot.market })}
          onClear={() => updateBot({ market: undefined, oddMarket: undefined, minOdd: undefined, maxOdd: undefined })}
        />
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">Passo 3: filtro por liga (opcional)</h2>
        <div className="grid gap-4 rounded-lg border border-violet-500/80 bg-ink-850/95 p-5 shadow-glow lg:grid-cols-2">
          <LeagueSelector
            title="Inserir ligas selecionadas"
            options={sortedLeagueOptions}
            loading={loadingLeagues}
            error={leagueLoadError}
            selected={bot.includedLeagues ?? []}
            onChange={(includedLeagues) => updateBot({ includedLeagues })}
          />
          <LeagueSelector
            title="Excluir ligas selecionadas"
            options={sortedLeagueOptions}
            loading={loadingLeagues}
            error={leagueLoadError}
            selected={bot.excludedLeagues ?? []}
            onChange={(excludedLeagues) => updateBot({ excludedLeagues })}
          />
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">Passo 4: situacao de jogo (opcional)</h2>
        <GameSituationCard
          roleRule={gameSituationRoleRule}
          metricRule={gameSituationMetricRule}
          onEnable={enableGameSituation}
          onClear={clearGameSituation}
          onPatchRole={patchGameSituationRole}
          onPatchMetric={patchGameSituationMetric}
        />
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">Passo 5: Cashout / Saida da operacao</h2>
        <div className="rounded-lg border border-violet-500/80 bg-ink-850/95 p-5 shadow-glow">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(bot.cashOut?.enabled)}
              onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { exitRules: [], exitLogic: 'AND' }), enabled: event.target.checked } })}
              className="h-4 w-4 accent-violet-600"
            />
            Ativar cashout por janela de tempo e parametros de saida
          </label>

          <div className="mt-5 grid items-end gap-5 md:grid-cols-[1fr_auto_1fr_1fr]">
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Procurar cashout de minuto</span>
              <input
                type="number"
                min={0}
                max={150}
                value={bot.cashOut?.fromMinute ?? ''}
                onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { enabled: true, exitRules: [], exitLogic: 'AND' }), fromMinute: toOptionalNumber(event.target.value) } })}
                className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>
            <span className="pb-2 text-xl text-slate-500">-&gt;</span>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Ate minuto</span>
              <input
                type="number"
                min={0}
                max={150}
                value={bot.cashOut?.toMinute ?? ''}
                onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { enabled: true, exitRules: [], exitLogic: 'AND' }), toMinute: toOptionalNumber(event.target.value) } })}
                className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Logica das regras</span>
              <select
                value={bot.cashOut?.exitLogic ?? 'AND'}
                onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { enabled: true, exitRules: [] }), exitLogic: event.target.value as 'AND' | 'OR' } })}
                className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              >
                <option value="AND">AND - todas precisam passar</option>
                <option value="OR">OR - qualquer uma pode passar</option>
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-5">
            <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-4">
              <div className="rounded-md border border-white/8 bg-ink-950/70 p-3">
                <p className="font-semibold text-slate-200">Regras atuais</p>
                <p>Odd, tempo, placar e estatisticas do snapshot atual.</p>
              </div>
              <div className="rounded-md border border-white/8 bg-ink-950/70 p-3">
                <p className="font-semibold text-slate-200">Desde a entrada</p>
                <p>Compara o snapshot atual com o momento em que entrou.</p>
              </div>
              <div className="rounded-md border border-white/8 bg-ink-950/70 p-3">
                <p className="font-semibold text-slate-200">Janelas apos entrada</p>
                <p>Ultimos 5, 10 ou 15 minutos sem olhar antes da entrada.</p>
              </div>
              <div className="rounded-md border border-white/8 bg-ink-950/70 p-3">
                <p className="font-semibold text-slate-200">Situacao de jogo</p>
                <p>Favorito, zebra, placar mudou e gols sofridos.</p>
              </div>
            </div>
            {(bot.cashOut?.exitRules ?? []).map((rule, index) => (
              <RangeRuleCard
                key={rule.id}
                rule={rule}
                mode="live"
                index={index}
                optionsOverride={cashOutParameters}
                onRemove={() => removeCashOutRule(rule.id)}
                onPatch={(patch) => patchCashOutRule(rule.id, patch)}
              />
            ))}
            <button type="button" onClick={addCashOutRule} className="mx-auto flex h-20 w-full max-w-sm items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-green-400 shadow-glow transition hover:border-green-500/70 hover:bg-green-500/10">
              <Plus className="h-10 w-10" />
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <Button type="submit" icon={<Save className="h-4 w-4" />} className="bg-violet-600 hover:bg-violet-500">
          Salvar
        </Button>
      </div>
    </form>
  );
}
