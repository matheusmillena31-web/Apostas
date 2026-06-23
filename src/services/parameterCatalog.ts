import { BotMode } from '../types';

export type ParameterValueType = 'text' | 'number';

export type ParameterOption = {
  value: string;
  label: string;
  category?: string;
  valueType?: ParameterValueType;
  min?: number;
  max?: number;
  step?: number;
  defaultFrom?: number | string;
  defaultTo?: number | string;
};

export type ParameterGroup = {
  label: string;
  options: ParameterOption[];
};

const references = [
  ['home', 'Mandante'],
  ['away', 'Visitante'],
  ['favorite', 'Favorito'],
  ['underdog', 'Zebra'],
] as const;

const statMetrics = [
  ['shots', 'Finalizacoes', 0, 60, 0, 20],
  ['shotsOnTarget', 'Finalizacoes no alvo', 0, 30, 0, 8],
  ['possession', 'Posse de bola', 0, 100, 45, 65],
  ['corners', 'Escanteios', 0, 30, 0, 12],
  ['dangerousAttacks', 'Ataques perigosos', 0, 160, 0, 50],
  ['cards', 'Cartoes', 0, 15, 0, 6],
] as const;

const recentMetrics = [
  ['shots', 'Finalizacoes', 0, 30, 0, 10],
  ['shotsOnTarget', 'Finalizacoes no alvo', 0, 20, 0, 5],
  ['corners', 'Escanteios', 0, 15, 0, 5],
  ['dangerousAttacks', 'Ataques perigosos', 0, 80, 0, 25],
  ['cards', 'Cartoes', 0, 8, 0, 3],
] as const;

const windows = [5, 10, 15] as const;

const byReferenceOptions = statMetrics.flatMap(([metric, label, min, max, defaultFrom, defaultTo]) =>
  references.map(([reference, referenceLabel]) => ({
    value: `stat:${metric}:${reference}`,
    label: `${label} - ${referenceLabel}`,
    category: 'Estatisticas por equipe',
    min,
    max,
    defaultFrom,
    defaultTo,
  })),
);

const recentOptions = recentMetrics.flatMap(([metric, label, min, max, defaultFrom, defaultTo]) =>
  windows.flatMap((window) =>
    references.map(([reference, referenceLabel]) => ({
      value: `recent:${metric}:${window}:${reference}`,
      label: `${label} ultimos ${window}' - ${referenceLabel}`,
      category: 'Estatisticas recentes',
      min,
      max,
      defaultFrom,
      defaultTo,
    })),
  ),
);

const diffOptions = [
  ['favorite', 'underdog', 'favorito - zebra'],
  ['home', 'away', 'mandante - visitante'],
] as const;

const differenceOptions = statMetrics.flatMap(([metric, label, , max]) =>
  diffOptions.map(([left, right, description]) => ({
    value: `diff:${metric}:${left}:${right}`,
    label: `Diferenca de ${label.toLowerCase()}: ${description}`,
    category: 'Diferencas entre equipes',
    min: -max,
    max,
    defaultFrom: 0,
    defaultTo: max,
  })),
);

const contextOptions: ParameterOption[] = [
  { value: 'favoriteWinning', label: 'Favorito vencendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteDrawing', label: 'Favorito empatando', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteLosing', label: 'Favorito perdendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogWinning', label: 'Zebra vencendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogDrawing', label: 'Zebra empatando', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'underdogLosing', label: 'Zebra perdendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'homeWinning', label: 'Mandante vencendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'homeDrawing', label: 'Mandante empatando', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'homeLosing', label: 'Mandante perdendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayWinning', label: 'Visitante vencendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayDrawing', label: 'Visitante empatando', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'awayLosing', label: 'Visitante perdendo', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'favoriteGoalDiff', label: 'Diferenca de gols do favorito', category: 'Contexto favorito/zebra', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'underdogGoalDiff', label: 'Diferenca de gols da zebra', category: 'Contexto favorito/zebra', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'homeGoalDiff', label: 'Diferenca de gols do mandante', category: 'Contexto favorito/zebra', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'awayGoalDiff', label: 'Diferenca de gols do visitante', category: 'Contexto favorito/zebra', min: -10, max: 10, defaultFrom: 0, defaultTo: 3 },
  { value: 'gameDraw', label: 'Jogo empatado', category: 'Contexto favorito/zebra', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'anyTeamWinningGoalDiff', label: 'Qualquer time vencendo por X gols', category: 'Contexto favorito/zebra', min: 1, max: 20, defaultFrom: 1, defaultTo: 3 },
];

const rhythmOptions: ParameterOption[] = [
  { value: 'rhythm:shotsPerMinute', label: 'Finalizacoes por minuto', category: 'Ritmo do jogo', min: 0, max: 5, step: 0.01, defaultFrom: 0, defaultTo: 1 },
  { value: 'rhythm:shotsOnTargetPerMinute', label: 'Finalizacoes no alvo por minuto', category: 'Ritmo do jogo', min: 0, max: 3, step: 0.01, defaultFrom: 0, defaultTo: 0.5 },
  { value: 'rhythm:cornersPerMinute', label: 'Escanteios por minuto', category: 'Ritmo do jogo', min: 0, max: 2, step: 0.01, defaultFrom: 0, defaultTo: 0.3 },
  { value: 'rhythm:dangerousAttacksPerMinute', label: 'Ataques perigosos por minuto', category: 'Ritmo do jogo', min: 0, max: 10, step: 0.01, defaultFrom: 0, defaultTo: 2 },
  { value: 'rhythm:minutesSinceShot', label: 'Minutos desde a ultima finalizacao', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 15 },
  { value: 'rhythm:minutesSinceShotOnTarget', label: 'Minutos desde a ultima finalizacao no alvo', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 20 },
  { value: 'rhythm:minutesSinceCorner', label: 'Minutos desde o ultimo escanteio', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 20 },
  { value: 'rhythm:minutesSinceGoal', label: 'Minutos desde o ultimo gol', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 30 },
  { value: 'rhythm:minutesSinceCard', label: 'Minutos desde o ultimo cartao', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 30 },
];

const oddsOptions: ParameterOption[] = [
  { value: 'liveOdds', label: 'Odd atual do mercado escolhido', category: 'Odds', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'odds:initial', label: 'Odd inicial pre-live do mercado escolhido', category: 'Odds', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'odds:diff', label: 'Diferenca entre odd atual e inicial', category: 'Odds', min: -50, max: 50, step: 0.01, defaultFrom: -1, defaultTo: 1 },
  { value: 'odds:percent', label: 'Variacao percentual da odd', category: 'Odds', min: -100, max: 500, step: 0.1, defaultFrom: -20, defaultTo: 20 },
  ...windows.flatMap((window) => [
    { value: `odds:drop:${window}`, label: `Queda da odd nos ultimos ${window} minutos`, category: 'Odds', min: 0, max: 50, step: 0.01, defaultFrom: 0, defaultTo: 1 },
    { value: `odds:rise:${window}`, label: `Subida da odd nos ultimos ${window} minutos`, category: 'Odds', min: 0, max: 50, step: 0.01, defaultFrom: 0, defaultTo: 1 },
  ]),
];

export const liveParameters: ParameterOption[] = [
  { value: 'minute', label: 'Tempo (min.)', category: 'Tempo e placar', min: 0, max: 150, defaultFrom: 0, defaultTo: 150 },
  { value: 'score', label: 'Placar', category: 'Tempo e placar', valueType: 'text', defaultFrom: '0-0' },
  { value: 'goals', label: 'Gols - Total', category: 'Tempo e placar', min: 0, max: 15, defaultFrom: 0, defaultTo: 15 },
  ...oddsOptions,
  { value: 'corners', label: 'Escanteios - Total', category: 'Estatisticas totais', min: 0, max: 30, defaultFrom: 0, defaultTo: 12 },
  { value: 'possession', label: 'Posse de bola (%) - Total antigo', category: 'Estatisticas totais', min: 0, max: 100, defaultFrom: 45, defaultTo: 100 },
  { value: 'shots', label: 'Finalizacoes - Total', category: 'Estatisticas totais', min: 0, max: 40, defaultFrom: 0, defaultTo: 15 },
  { value: 'shotsOnTarget', label: 'Finalizacoes no alvo - Total', category: 'Estatisticas totais', min: 0, max: 20, defaultFrom: 0, defaultTo: 5 },
  { value: 'attacks', label: 'Ataques - Total', category: 'Estatisticas totais', min: 0, max: 200, defaultFrom: 0, defaultTo: 100 },
  { value: 'dangerousAttacks', label: 'Ataques perigosos - Total', category: 'Estatisticas totais', min: 0, max: 120, defaultFrom: 0, defaultTo: 40 },
  { value: 'cards', label: 'Cartoes - Total', category: 'Estatisticas totais', min: 0, max: 15, defaultFrom: 0, defaultTo: 6 },
  { value: 'substitutions', label: 'Substituicoes', category: 'Estatisticas totais', min: 0, max: 12, defaultFrom: 0, defaultTo: 6 },
  { value: 'offensivePressure', label: 'Pressao ofensiva', category: 'Estatisticas totais', min: 0, max: 100, defaultFrom: 0, defaultTo: 70 },
  { value: 'recentEvents', label: 'Eventos recentes', category: 'Estatisticas totais', valueType: 'text', defaultFrom: 'finalizacao' },
  { value: 'statDifference', label: 'Diferenca estatistica entre equipes - antigo', category: 'Diferencas entre equipes', min: 0, max: 100, defaultFrom: 0, defaultTo: 30 },
  ...byReferenceOptions,
  ...recentOptions,
  ...differenceOptions,
  ...contextOptions,
  ...rhythmOptions,
];

export const preLiveParameters: ParameterOption[] = [
  { value: 'championship', label: 'Campeonato', category: 'Pre-live', valueType: 'text' },
  { value: 'season', label: 'Temporada', category: 'Pre-live', valueType: 'text' },
  { value: 'homeTeam', label: 'Time mandante', category: 'Pre-live', valueType: 'text' },
  { value: 'awayTeam', label: 'Time visitante', category: 'Pre-live', valueType: 'text' },
  { value: 'tablePosition', label: 'Posicao na tabela', category: 'Pre-live', min: 1, max: 30, defaultFrom: 1, defaultTo: 12 },
  { value: 'performance', label: 'Aproveitamento (%)', category: 'Pre-live', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'averageGoals', label: 'Media de gols', category: 'Pre-live', min: 0, max: 6, step: 0.1, defaultFrom: 1.5, defaultTo: 4 },
  { value: 'averageCorners', label: 'Media de escanteios', category: 'Pre-live', min: 0, max: 20, step: 0.1, defaultFrom: 6, defaultTo: 14 },
  { value: 'averageCards', label: 'Media de cartoes', category: 'Pre-live', min: 0, max: 12, step: 0.1, defaultFrom: 0, defaultTo: 6 },
  { value: 'winningStreak', label: 'Sequencia de vitorias', category: 'Pre-live', min: 0, max: 15, defaultFrom: 0, defaultTo: 5 },
  { value: 'losingStreak', label: 'Sequencia de derrotas', category: 'Pre-live', min: 0, max: 15, defaultFrom: 0, defaultTo: 3 },
  { value: 'headToHead', label: 'Confronto direto', category: 'Pre-live', min: 0, max: 10, step: 0.1, defaultFrom: 0, defaultTo: 4 },
  { value: 'offensiveStrength', label: 'Forca ofensiva', category: 'Pre-live', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'defensiveStrength', label: 'Forca defensiva', category: 'Pre-live', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'favoritism', label: 'Favoritismo (%)', category: 'Pre-live', min: 0, max: 100, defaultFrom: 50, defaultTo: 100 },
  { value: 'preLiveOdds', label: 'Odds pre-live', category: 'Pre-live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
];

export const getParameterOptions = (mode: BotMode) => (mode === 'live' ? liveParameters : preLiveParameters);

export const groupParameterOptions = (options: ParameterOption[]): ParameterGroup[] => {
  const groups = new Map<string, ParameterOption[]>();
  options.forEach((option) => {
    const category = option.category ?? 'Outros';
    const current = groups.get(category) ?? [];
    current.push(option);
    groups.set(category, current);
  });

  return [...groups.entries()].map(([label, groupOptions]) => ({ label, options: groupOptions }));
};

export const getParameterOption = (mode: BotMode, parameter: string) =>
  getParameterOptions(mode).find((option) => option.value === parameter);
