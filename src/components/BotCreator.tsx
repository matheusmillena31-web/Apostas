import { Bot, Plus, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BotConfig, BotFilterOperator, BotFilterRule } from '../types';
import { uid } from '../utils/formatters';

type BotCreatorProps = {
  initialConfig?: BotConfig;
  onChange?: (config: BotConfig) => void;
  onSave?: (config: BotConfig) => void;
};

type FilterFieldOption = {
  label: string;
  value: BotFilterRule['field'];
};

const filterFields: FilterFieldOption[] = [
  { label: 'Minuto', value: 'minuto' },
  { label: 'Posse mandante', value: 'posse_mandante' },
  { label: 'Posse visitante', value: 'posse_visitante' },
  { label: 'Ataques mandante', value: 'ataques_mandante' },
  { label: 'Ataques visitante', value: 'ataques_visitante' },
  { label: 'Ataques perigosos mandante', value: 'ataques_perigosos_mandante' },
  { label: 'Ataques perigosos visitante', value: 'ataques_perigosos_visitante' },
  { label: 'Finalizacoes mandante', value: 'finalizacoes_mandante' },
  { label: 'Finalizacoes visitante', value: 'finalizacoes_visitante' },
  { label: 'Finalizacoes no alvo mandante', value: 'finalizacoes_no_alvo_mandante' },
  { label: 'Finalizacoes no alvo visitante', value: 'finalizacoes_no_alvo_visitante' },
  { label: 'Escanteios mandante', value: 'escanteios_mandante' },
  { label: 'Escanteios visitante', value: 'escanteios_visitante' },
  { label: 'Cartoes mandante', value: 'cartoes_mandante' },
  { label: 'Cartoes visitante', value: 'cartoes_visitante' },
];

const marketOptions = ['Over 1.5', 'Over 2.5', 'Under 2.5', 'Ambas Marcam', 'Match Odds', 'Empate'];
const operatorOptions: BotFilterOperator[] = ['>=', '<='];

const createFilterRule = (): BotFilterRule => ({
  id: uid('filter'),
  field: 'ataques_perigosos_mandante',
  operator: '>=',
  value: 20,
});

const createBotConfig = (): BotConfig => ({
  id: uid('bot-config'),
  name: '',
  description: '',
  market: 'Over 2.5',
  side: 'BACK',
  stake: 10,
  logic: 'AND',
  filters: [createFilterRule()],
});

export function BotCreator({ initialConfig, onChange, onSave }: BotCreatorProps) {
  const [config, setConfig] = useState<BotConfig>(() => initialConfig ?? createBotConfig());

  const jsonPreview = useMemo(() => JSON.stringify(config, null, 2), [config]);

  const updateConfig = (nextConfig: BotConfig) => {
    setConfig(nextConfig);
    onChange?.(nextConfig);
  };

  const updateField = <TKey extends keyof BotConfig>(field: TKey, value: BotConfig[TKey]) => {
    updateConfig({
      ...config,
      [field]: value,
    });
  };

  const addFilter = () => {
    updateConfig({
      ...config,
      filters: [...config.filters, createFilterRule()],
    });
  };

  const removeFilter = (filterId: string) => {
    updateConfig({
      ...config,
      filters: config.filters.filter((filter) => filter.id !== filterId),
    });
  };

  const updateFilter = <TKey extends keyof BotFilterRule>(
    filterId: string,
    field: TKey,
    value: BotFilterRule[TKey],
  ) => {
    updateConfig({
      ...config,
      filters: config.filters.map((filter) => (filter.id === filterId ? { ...filter, [field]: value } : filter)),
    });
  };

  const handleSave = () => {
    onSave?.(config);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/30">
      <div className="border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">Criador de robos</h2>
              <p className="text-sm text-zinc-500">Monte regras ao vivo sem programacao.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!onSave}
          >
            <Save className="h-4 w-4" />
            Salvar configuracao
          </button>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <div className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/45 p-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Nome do robo</span>
              <input
                value={config.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Ex: Over pressao 20-35"
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Descricao</span>
              <textarea
                value={config.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Resumo do criterio de entrada"
                className="min-h-24 w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Mercado</span>
              <select
                value={config.market}
                onChange={(event) => updateField('market', event.target.value)}
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {marketOptions.map((market) => (
                  <option key={market}>{market}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">BACK ou LAY</span>
              <select
                value={config.side}
                onChange={(event) => updateField('side', event.target.value as BotConfig['side'])}
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option>BACK</option>
                <option>LAY</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Stake</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.stake}
                onChange={(event) => updateField('stake', Number(event.target.value))}
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">Combinacao dos filtros</span>
              <select
                value={config.logic}
                onChange={(event) => updateField('logic', event.target.value as BotConfig['logic'])}
                className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option>AND</option>
                <option>OR</option>
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/45">
            <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-blue-300" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">Filtros dinamicos</h3>
              </div>

              <button
                type="button"
                onClick={addFilter}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-blue-500/35 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200 transition hover:bg-blue-500/20"
              >
                <Plus className="h-4 w-4" />
                Adicionar regra
              </button>
            </div>

            <div className="space-y-3 p-4">
              {config.filters.map((filter, index) => (
                <div
                  key={filter.id}
                  className="grid gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3 md:grid-cols-[minmax(0,1fr)_110px_140px_44px]"
                >
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Estatistica {index + 1}
                    </span>
                    <select
                      value={filter.field}
                      onChange={(event) => updateFilter(filter.id, 'field', event.target.value as BotFilterRule['field'])}
                      className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {filterFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Operador
                    </span>
                    <select
                      value={filter.operator}
                      onChange={(event) => updateFilter(filter.id, 'operator', event.target.value as BotFilterOperator)}
                      className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {operatorOptions.map((operator) => (
                        <option key={operator}>{operator}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                      Valor
                    </span>
                    <input
                      type="number"
                      value={filter.value}
                      onChange={(event) => updateFilter(filter.id, 'value', Number(event.target.value))}
                      className="min-h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </label>

                  <button
                    type="button"
                    title="Remover regra"
                    onClick={() => removeFilter(filter.id)}
                    disabled={config.filters.length === 1}
                    className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-zinc-800 bg-zinc-900/45">
          <div className="border-b border-zinc-800 px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-300">BotConfig</p>
          </div>
          <pre className="max-h-[620px] overflow-auto p-4 text-xs leading-relaxed text-zinc-300">{jsonPreview}</pre>
        </aside>
      </div>
    </section>
  );
}
