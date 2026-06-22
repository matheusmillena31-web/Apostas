import { FormEvent, useState } from 'react';
import { ArrowLeftRight, Plus, Save, X } from 'lucide-react';
import { Bot, BotMode, BotRule, BotRuleConnector, BotRuleOperator, TradeSide } from '../types';
import { uid } from '../utils/formatters';
import { Button } from './Button';
import { Card } from './Card';
import { Field, Input, Select, Textarea } from './FormControls';

type BotFormProps = {
  initialBot?: Bot;
  defaultStake: number;
  onSave: (bot: Bot) => void;
};

type ParameterOption = {
  value: string;
  label: string;
  valueType?: 'text' | 'number';
  min?: number;
  max?: number;
  step?: number;
  defaultFrom?: number | string;
  defaultTo?: number | string;
};

const liveParameters: ParameterOption[] = [
  { value: 'minute', label: 'Tempo (min.)', min: 0, max: 150, defaultFrom: 0, defaultTo: 150 },
  { value: 'score', label: 'Placar', valueType: 'text', defaultFrom: '0-0' },
  { value: 'goals', label: 'Gols - Total', min: 0, max: 15, defaultFrom: 0, defaultTo: 15 },
  { value: 'corners', label: 'Escanteios - Total', min: 0, max: 30, defaultFrom: 0, defaultTo: 12 },
  { value: 'possession', label: 'Posse de bola (%)', min: 0, max: 100, defaultFrom: 45, defaultTo: 100 },
  { value: 'shots', label: 'Finalizacoes - Total', min: 0, max: 40, defaultFrom: 0, defaultTo: 15 },
  { value: 'shotsOnTarget', label: 'Finalizacoes no alvo - Total', min: 0, max: 20, defaultFrom: 0, defaultTo: 5 },
  { value: 'attacks', label: 'Ataques - Total', min: 0, max: 200, defaultFrom: 0, defaultTo: 100 },
  { value: 'dangerousAttacks', label: 'Ataques perigosos - Total', min: 0, max: 120, defaultFrom: 0, defaultTo: 40 },
  { value: 'cards', label: 'Cartoes - Total', min: 0, max: 15, defaultFrom: 0, defaultTo: 6 },
  { value: 'substitutions', label: 'Substituicoes', min: 0, max: 12, defaultFrom: 0, defaultTo: 6 },
  { value: 'offensivePressure', label: 'Pressao ofensiva', min: 0, max: 100, defaultFrom: 0, defaultTo: 70 },
  { value: 'recentEvents', label: 'Eventos recentes', valueType: 'text', defaultFrom: 'finalizacao' },
  { value: 'liveOdds', label: 'Odds live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'statDifference', label: 'Diferenca estatistica entre equipes', min: 0, max: 100, defaultFrom: 0, defaultTo: 30 },
];

const preLiveParameters: ParameterOption[] = [
  { value: 'championship', label: 'Campeonato', valueType: 'text' },
  { value: 'season', label: 'Temporada', valueType: 'text' },
  { value: 'homeTeam', label: 'Time mandante', valueType: 'text' },
  { value: 'awayTeam', label: 'Time visitante', valueType: 'text' },
  { value: 'tablePosition', label: 'Posicao na tabela', min: 1, max: 30, defaultFrom: 1, defaultTo: 12 },
  { value: 'performance', label: 'Aproveitamento (%)', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'averageGoals', label: 'Media de gols', min: 0, max: 6, step: 0.1, defaultFrom: 1.5, defaultTo: 4 },
  { value: 'averageCorners', label: 'Media de escanteios', min: 0, max: 20, step: 0.1, defaultFrom: 6, defaultTo: 14 },
  { value: 'averageCards', label: 'Media de cartoes', min: 0, max: 12, step: 0.1, defaultFrom: 0, defaultTo: 6 },
  { value: 'winningStreak', label: 'Sequencia de vitorias', min: 0, max: 15, defaultFrom: 0, defaultTo: 5 },
  { value: 'losingStreak', label: 'Sequencia de derrotas', min: 0, max: 15, defaultFrom: 0, defaultTo: 3 },
  { value: 'headToHead', label: 'Confronto direto', min: 0, max: 10, step: 0.1, defaultFrom: 0, defaultTo: 4 },
  { value: 'offensiveStrength', label: 'Forca ofensiva', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'defensiveStrength', label: 'Forca defensiva', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'favoritism', label: 'Favoritismo (%)', min: 0, max: 100, defaultFrom: 50, defaultTo: 100 },
  { value: 'preLiveOdds', label: 'Odds pre-live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
];

const goalLines = ['0.5', '1.5', '2.5', '3.5', '4.5', '5.5'];
const goalMarkets = goalLines.flatMap((line) => [`Over ${line}`, `Under ${line}`]);

const oddMarkets = [
  '',
  'Odd - Casa',
  'Odd - Empate',
  'Odd - Fora',
  ...goalLines.flatMap((line) => [`Odd - Over Gol (+ ${line}G)`, `Odd - Under Gol (+ ${line}G)`]),
  'Odd - BTTS Sim',
  'Odd - BTTS Nao',
  'Odd - Dupla chance Favorito-Underdog',
  'Odd - Dupla chance Underdog-Empate',
];

const markets = ['', ...goalMarkets, 'Ambas Marcam', 'Match Odds', 'Empate'];

const mainLeagues = [
  'Brasil: Serie A',
  'Brasil: Serie B',
  'Brasil: Copa do Brasil',
  'Brasil: Campeonato Paulista',
  'Brasil: Campeonato Carioca',
  'Argentina: Liga Profesional',
  'Great Britain: England Premier League',
  'Great Britain: England Championship',
  'Great Britain: England League One',
  'Great Britain: England League Two',
  'Spain: La Liga',
  'Spain: Segunda Division',
  'Italy: Serie A',
  'Italy: Serie B',
  'Germany: Bundesliga',
  'Germany: 2. Bundesliga',
  'France: Ligue 1',
  'France: Ligue 2',
  'Portugal: Primeira Liga',
  'Netherlands: Eredivisie',
  'USA: Major League Soccer',
  'World: UEFA Champions League',
  'World: UEFA Europa League',
  'South America: Copa Libertadores',
  'South America: Copa Sudamericana',
];

const connectors: BotRuleConnector[] = ['AND', 'OR', 'NOT'];
const numericOperators: BotRuleOperator[] = ['between', '>=', '<=', '=', '!='];
const textOperators: BotRuleOperator[] = ['=', '!='];

const getParameterOptions = (mode: BotMode) => (mode === 'live' ? liveParameters : preLiveParameters);

const getParameterOption = (mode: BotMode, parameter: string) =>
  getParameterOptions(mode).find((option) => option.value === parameter);

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

const createCashOutRule = (mode: BotMode): BotRule => createRule(mode, mode === 'live' ? 'liveOdds' : 'preLiveOdds');

export function createDefaultBot(defaultStake: number): Bot {
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
    operation: undefined,
    minOdd: undefined,
    maxOdd: undefined,
    stake: defaultStake,
    rules: [createRule('live', 'minute')],
    includedLeagues: [],
    excludedLeagues: [],
    cashOut: {
      enabled: false,
      fromMinute: undefined,
      toMinute: undefined,
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
  onSwitchMode,
  onRemove,
  onChange,
}: {
  rule: BotRule;
  mode: BotMode;
  index: number;
  onSwitchMode?: () => void;
  onRemove: () => void;
  onChange: <TKey extends keyof BotRule>(field: TKey, value: BotRule[TKey]) => void;
}) {
  const options = getParameterOptions(mode);
  const selectedOption = getParameterOption(mode, rule.parameter);
  const isText = selectedOption?.valueType === 'text';
  const min = selectedOption?.min ?? 0;
  const max = selectedOption?.max ?? 100;
  const step = selectedOption?.step ?? 1;
  const from = String(rule.value ?? '');
  const to = String(rule.secondValue ?? '');
  const operatorOptions = isText ? textOperators : numericOperators;
  const showSecondValue = !isText && rule.operator === 'between';

  const updateParameter = (parameter: string) => {
    const option = getParameterOption(mode, parameter);
    onChange('parameter', parameter);
    onChange('operator', option?.valueType === 'text' ? '=' : 'between');
    onChange('value', option?.defaultFrom ?? '');
    onChange('secondValue', option?.valueType === 'text' ? undefined : (option?.defaultTo ?? ''));
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
              onChange={(event) => onChange('connector', event.target.value as BotRuleConnector)}
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
          <select
            value={rule.parameter}
            onChange={(event) => updateParameter(event.target.value)}
            className="min-h-11 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">Selecione</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="w-full">
          <span className="mb-2 block text-sm font-medium text-slate-300">Operador</span>
          <select
            value={rule.operator}
            onChange={(event) => onChange('operator', event.target.value as BotRuleOperator)}
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
              onChange={(event) => onChange('value', event.target.value)}
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
                onChange={(event) => onChange('value', valueForOption(event.target.value, selectedOption))}
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
                    onChange={(event) => onChange('secondValue', valueForOption(event.target.value, selectedOption))}
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
    <div className="relative rounded-lg border border-violet-500/80 bg-ink-900/95 p-5 text-slate-100 shadow-glow">
      <button
        type="button"
        onClick={onClear}
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-400"
        title="Limpar filtro de odd"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="mx-auto max-w-2xl pr-10">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Parametro de odd {mode === 'live' ? 'live' : 'pre-live'}</span>
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

      <div className="mt-5 grid items-end gap-5 md:grid-cols-[1fr_auto_1fr]">
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Odd minima de entrada</span>
          <input
            type="number"
            min={1.01}
            max={50}
            step={0.01}
            value={from}
            onChange={(event) => onChange({ oddMarket, minOdd: toOptionalNumber(event.target.value), maxOdd })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
        <span className="pb-2 text-xl text-slate-500">-&gt;</span>
        <label>
          <span className="mb-2 block text-sm font-medium text-slate-300">Odd maxima de entrada</span>
          <input
            type="number"
            min={1.01}
            max={50}
            step={0.01}
            value={to}
            onChange={(event) => onChange({ oddMarket, minOdd, maxOdd: toOptionalNumber(event.target.value) })}
            className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
      </div>

      <RangeLine min={1.01} max={50} from={from || '1.5'} to={to || '20'} />
    </div>
  );
}

function LeagueSelector({
  title,
  selected,
  onChange,
}: {
  title: string;
  selected: string[];
  onChange: (leagues: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLeagues = mainLeagues.filter((league) => league.toLowerCase().includes(normalizedQuery));

  const addLeague = (league: string) => {
    if (!selected.includes(league)) onChange([...selected, league]);
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
        placeholder="Buscar liga"
        className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
      />

      <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-white/10 bg-ink-950">
        {filteredLeagues.map((league) => (
          <button
            key={league}
            type="button"
            onClick={() => addLeague(league)}
            className={`block w-full px-3 py-2 text-left text-sm transition ${
              selected.includes(league) ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {league}
          </button>
        ))}
        {filteredLeagues.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">Nenhuma liga encontrada.</p>}
      </div>
    </div>
  );
}

export function BotForm({ initialBot, defaultStake, onSave }: BotFormProps) {
  const defaultBot = createDefaultBot(defaultStake);
  const [bot, setBot] = useState<Bot>(() => ({
    ...(initialBot ?? defaultBot),
    oddMarket: initialBot?.oddMarket ?? initialBot?.market,
    cashOut: initialBot?.cashOut ?? defaultBot.cashOut,
    includedLeagues: initialBot?.includedLeagues ?? [],
    excludedLeagues: initialBot?.excludedLeagues ?? [],
  }));

  const activeRules = bot.rules.filter((rule) => rule.mode === bot.mode);

  const updateBot = (patch: Partial<Bot>) => setBot((current) => ({ ...current, ...patch }));

  const changeMode = (nextMode: BotMode) => {
    setBot((current) => ({
      ...current,
      mode: nextMode,
      rules: current.rules.some((rule) => rule.mode === nextMode)
        ? current.rules
        : [...current.rules, createRule(nextMode, nextMode === 'live' ? 'minute' : 'averageGoals')],
    }));
  };

  const switchMode = () => changeMode(bot.mode === 'live' ? 'pre-live' : 'live');

  const updateRule = <TKey extends keyof BotRule>(ruleId: string, field: TKey, value: BotRule[TKey]) => {
    updateBot({
      rules: bot.rules.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule)),
    });
  };

  const addRule = () => updateBot({ rules: [...bot.rules, createRule(bot.mode)] });

  const removeRule = (ruleId: string) => updateBot({ rules: bot.rules.filter((rule) => rule.id !== ruleId) });

  const updateCashOutRule = <TKey extends keyof BotRule>(ruleId: string, field: TKey, value: BotRule[TKey]) => {
    const cashOut = bot.cashOut ?? { enabled: false, exitRules: [] };
    const exitRules = cashOut.exitRules ?? [];
    updateBot({
      cashOut: {
        ...cashOut,
        exitRules: exitRules.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule)),
      },
    });
  };

  const addCashOutRule = () => {
    const cashOut = bot.cashOut ?? { enabled: false, exitRules: [] };
    updateBot({
      cashOut: {
        ...cashOut,
        enabled: true,
        exitRules: [...(cashOut.exitRules ?? []), createCashOutRule(bot.mode)],
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
    const market = String(form.get('market') ?? '').trim();
    const operation = String(form.get('operation') ?? '').trim() as TradeSide | '';

    onSave({
      ...bot,
      name: String(form.get('name') ?? '').trim() || 'Metodo sem nome',
      description: String(form.get('description') ?? ''),
      isActive: form.get('isActive') === 'on',
      market: market || undefined,
      oddMarket: bot.oddMarket || undefined,
      operation: operation || undefined,
      rules: bot.rules.filter((rule) => rule.parameter),
      includedLeagues: bot.includedLeagues ?? [],
      excludedLeagues: bot.excludedLeagues ?? [],
      cashOut: {
        enabled: Boolean(bot.cashOut?.enabled),
        fromMinute: bot.cashOut?.fromMinute,
        toMinute: bot.cashOut?.toMinute,
        exitRules: bot.cashOut?.exitRules.filter((rule) => rule.parameter) ?? [],
      },
      updatedAt: now,
      createdAt: bot.createdAt || now,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Card title="Identidade do metodo" subtitle="Defina nome, status e modo operacional.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Nome">
            <Input name="name" value={bot.name} onChange={(event) => updateBot({ name: event.target.value })} placeholder="Ex: Over pressao 65+" required />
          </Field>
          <Field label="Status">
            <div className="flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-ink-900 px-3">
              <input name="isActive" type="checkbox" checked={bot.isActive} onChange={(event) => updateBot({ isActive: event.target.checked })} className="h-4 w-4 accent-electric-500" />
              <span className="text-sm text-slate-300">Ativo para simulacoes</span>
            </div>
          </Field>
          <Field label="Modo atual">
            <Select value={bot.mode} onChange={(event) => changeMode(event.target.value as BotMode)}>
              <option value="live">Ao vivo</option>
              <option value="pre-live">Pre-live</option>
            </Select>
          </Field>
          <div className="lg:col-span-3">
            <Field label="Descricao">
              <Textarea name="description" value={bot.description ?? ''} onChange={(event) => updateBot({ description: event.target.value })} placeholder="Resumo do racional do metodo" />
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex justify-center">
        <label className="w-full max-w-sm">
          <span className="mb-2 block text-sm font-semibold text-slate-300">Classificar por:</span>
          <Select defaultValue="favorito-underdog">
            <option value="favorito-underdog">Favorito/Underdog</option>
            <option value="casa-fora">Casa/Fora</option>
            <option value="mandante-visitante">Mandante/Visitante</option>
          </Select>
        </label>
      </div>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">1o passo: escolha dos parametros gerais</h2>
        {activeRules.map((rule, index) => (
          <RangeRuleCard
            key={rule.id}
            rule={rule}
            mode={bot.mode}
            index={index}
            onSwitchMode={switchMode}
            onRemove={() => removeRule(rule.id)}
            onChange={(field, value) => updateRule(rule.id, field, value)}
          />
        ))}
        <button type="button" onClick={addRule} className="mx-auto flex h-24 w-full max-w-sm items-center justify-center rounded-lg border border-white/10 bg-ink-900 text-green-400 shadow-glow transition hover:border-green-500/70 hover:bg-green-500/10">
          <Plus className="h-12 w-12" />
        </button>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">
          2o passo: escolha um mercado (opcional) e filtre a odd {bot.mode === 'live' ? 'live' : 'pre-live'} (opcional)
        </h2>
        <div className="rounded-lg border border-violet-500/80 bg-ink-850/95 p-5 shadow-glow">
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Mercado da aposta</span>
              <select name="market" value={bot.market ?? ''} onChange={(event) => updateBot({ market: event.target.value || undefined })} className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
                {markets.map((market) => (
                  <option key={market} value={market}>{market || 'Sem mercado'}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">BACK ou LAY</span>
              <select name="operation" value={bot.operation ?? ''} onChange={(event) => updateBot({ operation: (event.target.value || undefined) as TradeSide | undefined })} className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500">
                <option value="">Opcional</option>
                <option value="BACK">BACK</option>
                <option value="LAY">LAY</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Stake</span>
              <input type="number" step="0.01" value={bot.stake ?? ''} onChange={(event) => updateBot({ stake: toOptionalNumber(event.target.value) })} className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" />
            </label>
          </div>
          <div className="mt-5">
            <OddRangeCard
              mode={bot.mode}
              oddMarket={bot.oddMarket}
              minOdd={bot.minOdd}
              maxOdd={bot.maxOdd}
              onChange={(patch) => updateBot(patch)}
              onClear={() => updateBot({ oddMarket: undefined, minOdd: undefined, maxOdd: undefined })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">3o passo: filtro por liga (opcional)</h2>
        <div className="grid gap-4 rounded-lg border border-violet-500/80 bg-ink-850/95 p-5 shadow-glow lg:grid-cols-2">
          <LeagueSelector
            title="Inserir ligas selecionadas"
            selected={bot.includedLeagues ?? []}
            onChange={(includedLeagues) => updateBot({ includedLeagues })}
          />
          <LeagueSelector
            title="Excluir ligas selecionadas"
            selected={bot.excludedLeagues ?? []}
            onChange={(excludedLeagues) => updateBot({ excludedLeagues })}
          />
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="text-xl font-semibold text-white">4o passo: cash-out (opcional)</h2>
        <div className="rounded-lg border border-violet-500/80 bg-ink-850/95 p-5 shadow-glow">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(bot.cashOut?.enabled)}
              onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { exitRules: [] }), enabled: event.target.checked } })}
              className="h-4 w-4 accent-violet-600"
            />
            Ativar cash-out por janela de tempo e parametros de saida
          </label>

          <div className="mt-5 grid items-end gap-5 md:grid-cols-[1fr_auto_1fr]">
            <label>
              <span className="mb-2 block text-sm font-medium text-slate-300">Cash-out de minuto</span>
              <input
                type="number"
                min={0}
                max={150}
                value={bot.cashOut?.fromMinute ?? ''}
                onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { enabled: true, exitRules: [] }), fromMinute: toOptionalNumber(event.target.value) } })}
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
                onChange={(event) => updateBot({ cashOut: { ...(bot.cashOut ?? { enabled: true, exitRules: [] }), toMinute: toOptionalNumber(event.target.value) } })}
                className="min-h-10 w-full rounded-md border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>
          </div>

          <div className="mt-5 space-y-5">
            {(bot.cashOut?.exitRules ?? []).map((rule, index) => (
              <RangeRuleCard
                key={rule.id}
                rule={rule}
                mode={bot.mode}
                index={index}
                onRemove={() => removeCashOutRule(rule.id)}
                onChange={(field, value) => updateCashOutRule(rule.id, field, value)}
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
