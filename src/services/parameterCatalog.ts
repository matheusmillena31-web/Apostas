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

const rhythmReferences = [
  ['total', 'Total'],
  ...references,
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
  windows.flatMap((window) => [
    {
      value: `recent:${metric}:${window}:total`,
      label: `${label} ultimos ${window}' - Total`,
      category: 'Estatisticas totais',
      min,
      max,
      defaultFrom,
      defaultTo,
    },
    ...references.map(([reference, referenceLabel]) => ({
      value: `recent:${metric}:${window}:${reference}`,
      label: `${label} ultimos ${window}' - ${referenceLabel}`,
      category: 'Estatisticas recentes',
      min,
      max,
      defaultFrom,
      defaultTo,
    })),
  ]),
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

const rhythmMetrics = [
  ['shots', 'Finalizacoes', 0, 5, 0, 1],
  ['shotsOnTarget', 'Finalizacoes no alvo', 0, 3, 0, 0.5],
  ['corners', 'Escanteios', 0, 2, 0, 0.3],
  ['dangerousAttacks', 'Ataques perigosos', 0, 10, 0, 2],
  ['cards', 'Cartoes', 0, 2, 0, 0.2],
] as const;

const rhythmPerMinuteOptions: ParameterOption[] = rhythmMetrics.flatMap(([metric, label, min, max, defaultFrom, defaultTo]) => [
  ...rhythmReferences.map(([reference, referenceLabel]) => ({
    value: `rhythm:perMinute:${metric}:${reference}`,
    label: `${label} por minuto - ${referenceLabel}`,
    category: 'Ritmo do jogo',
    min,
    max,
    step: 0.01,
    defaultFrom,
    defaultTo,
  })),
  ...windows.flatMap((window) =>
    rhythmReferences.map(([reference, referenceLabel]) => ({
      value: `rhythm:perMinute:${metric}:${reference}:${window}`,
      label: `${label} por minuto ultimos ${window}' - ${referenceLabel}`,
      category: 'Ritmo do jogo',
      min,
      max,
      step: 0.01,
      defaultFrom,
      defaultTo,
    })),
  ),
]);

const rhythmOptions: ParameterOption[] = [
  ...rhythmPerMinuteOptions,
  { value: 'rhythm:minutesSinceShot', label: 'Minutos desde a ultima finalizacao', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 15 },
  { value: 'rhythm:minutesSinceShotOnTarget', label: 'Minutos desde a ultima finalizacao no alvo', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 20 },
  { value: 'rhythm:minutesSinceCorner', label: 'Minutos desde o ultimo escanteio', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 20 },
  { value: 'rhythm:minutesSinceGoal', label: 'Minutos desde o ultimo gol', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 30 },
  { value: 'rhythm:minutesSinceCard', label: 'Minutos desde o ultimo cartao', category: 'Ritmo do jogo', min: 0, max: 120, defaultFrom: 0, defaultTo: 30 },
];

const oddsOptions: ParameterOption[] = [
  { value: 'liveOdds', label: 'Odd live atual do mercado escolhido', category: 'Odds live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'odds:initial', label: 'Odd inicial observada do mercado escolhido', category: 'Odds live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'odds:diff', label: 'Diferenca entre odd live atual e inicial', category: 'Odds live', min: -50, max: 50, step: 0.01, defaultFrom: -1, defaultTo: 1 },
  { value: 'odds:percent', label: 'Variacao percentual da odd live', category: 'Odds live', min: -100, max: 500, step: 0.1, defaultFrom: -20, defaultTo: 20 },
  ...windows.flatMap((window) => [
    { value: `odds:drop:${window}`, label: `Queda da odd live nos ultimos ${window} minutos`, category: 'Odds live', min: 0, max: 50, step: 0.01, defaultFrom: 0, defaultTo: 1 },
    { value: `odds:rise:${window}`, label: `Subida da odd live nos ultimos ${window} minutos`, category: 'Odds live', min: 0, max: 50, step: 0.01, defaultFrom: 0, defaultTo: 1 },
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
  ...rhythmOptions,
];

const cashOutReferences = [
  ['total', 'Total'],
  ['home', 'Mandante'],
  ['away', 'Visitante'],
  ['favorite', 'Favorito'],
  ['underdog', 'Zebra'],
] as const;

const cashOutRelativeMetrics = [
  ['goals', 'Gols', 0, 10, 0, 2],
  ['shots', 'Finalizacoes', 0, 50, 0, 10],
  ['shotsOnTarget', 'Finalizacoes no alvo', 0, 25, 0, 5],
  ['corners', 'Escanteios', 0, 20, 0, 5],
  ['cards', 'Cartoes', 0, 10, 0, 3],
  ['dangerousAttacks', 'Ataques perigosos', 0, 100, 0, 25],
] as const;

const cashOutWindowMetrics = cashOutRelativeMetrics.filter(([metric]) => metric !== 'goals');

const cashOutOption = (
  value: string,
  label: string,
  category: string,
  min = 0,
  max = 100,
  step = 1,
  defaultFrom: number | string = 0,
  defaultTo: number | string = max,
): ParameterOption => ({
  value,
  label,
  category,
  min,
  max,
  step,
  defaultFrom,
  defaultTo,
});

const cashOutCurrentOptions: ParameterOption[] = [
  cashOutOption('cashout.current.odd', 'Odd atual do mercado', 'Regras atuais', 1.01, 50, 0.01, 1.01, 2),
  cashOutOption('cashout.current.minute', 'Tempo atual', 'Regras atuais', 0, 150, 1, 0, 90),
  { value: 'cashout.current.score', label: 'Placar atual', category: 'Regras atuais', valueType: 'text', defaultFrom: '0-0' },
  cashOutOption('cashout.current.goals', 'Gols atuais - total', 'Regras atuais', 0, 15, 1, 0, 5),
  ...liveParameters
    .filter((option) => !option.value.startsWith('odds:') && !['liveOdds', 'minute', 'score', 'goals'].includes(option.value))
    .map((option) => ({ ...option, value: `cashout.current.${option.value}`, category: 'Regras atuais' })),
];

const cashOutSinceEntryOptions: ParameterOption[] = [
  cashOutOption('cashout.entry.minutesSinceEntry', 'Minutos desde a entrada', 'Regras desde a entrada', 0, 150, 1, 1, 30),
  cashOutOption('cashout.entry.odd', 'Odd de entrada', 'Regras desde a entrada', 1.01, 50, 0.01, 1.5, 5),
  cashOutOption('cashout.entry.oddDiff', 'Diferenca entre odd atual e odd de entrada', 'Regras desde a entrada', -50, 50, 0.01, -1, 1),
  cashOutOption('cashout.entry.oddPercent', 'Variacao percentual da odd desde a entrada', 'Regras desde a entrada', -100, 500, 0.1, -30, 30),
  cashOutOption('cashout.entry.oddDrop', 'Queda da odd desde a entrada', 'Regras desde a entrada', 0, 50, 0.01, 0.1, 2),
  cashOutOption('cashout.entry.oddRise', 'Subida da odd desde a entrada', 'Regras desde a entrada', 0, 50, 0.01, 0.1, 2),
  ...cashOutRelativeMetrics.flatMap(([metric, label, min, max, defaultFrom, defaultTo]) =>
    cashOutReferences.map(([reference, referenceLabel]) =>
      cashOutOption(`cashout.sinceEntry.${metric}.${reference}`, `${label} desde a entrada - ${referenceLabel}`, 'Regras desde a entrada', min, max, 1, defaultFrom, defaultTo),
    ),
  ),
];

const cashOutWindowOptions: ParameterOption[] = windows.flatMap((window) =>
  cashOutWindowMetrics.flatMap(([metric, label, min, max, defaultFrom, defaultTo]) =>
    cashOutReferences.map(([reference, referenceLabel]) =>
      cashOutOption(
        `cashout.window${window}.${metric}.${reference}`,
        `${label} ultimos ${window}' desde a entrada - ${referenceLabel}`,
        `Ultimos ${window}' desde a entrada`,
        min,
        max,
        1,
        defaultFrom,
        defaultTo,
      ),
    ),
  ),
);

const cashOutSituationOptions: ParameterOption[] = [
  cashOutOption('cashout.situation.gameDraw', 'Jogo empatado', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.favoriteWinning', 'Favorito vencendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.favoriteDrawing', 'Favorito empatando', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.favoriteLosing', 'Favorito perdendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.underdogWinning', 'Zebra vencendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.underdogDrawing', 'Zebra empatando', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.underdogLosing', 'Zebra perdendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.homeWinning', 'Mandante vencendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.homeDrawing', 'Mandante empatando', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.homeLosing', 'Mandante perdendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.awayWinning', 'Visitante vencendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.awayDrawing', 'Visitante empatando', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.awayLosing', 'Visitante perdendo', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.favoriteComebackSinceEntry', 'Favorito virou o jogo desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.underdogComebackSinceEntry', 'Zebra virou o jogo desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.homeComebackSinceEntry', 'Mandante virou o jogo desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.awayComebackSinceEntry', 'Visitante virou o jogo desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.favoriteConcededSinceEntry', 'Favorito sofreu gol desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.underdogConcededSinceEntry', 'Zebra sofreu gol desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.homeConcededSinceEntry', 'Mandante sofreu gol desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.awayConcededSinceEntry', 'Visitante sofreu gol desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.scoreChangedSinceEntry', 'Placar mudou desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.scoreUnchangedSinceEntry', 'Placar nao mudou desde a entrada', 'Situacao de jogo para cashout', 1, 1, 1, 1, 1),
  cashOutOption('cashout.situation.currentGoalDiff', 'Diferenca de gols atual', 'Situacao de jogo para cashout', -10, 10, 1, 0, 3),
  cashOutOption('cashout.situation.favoriteGoalDiff', 'Diferenca de gols do favorito', 'Situacao de jogo para cashout', -10, 10, 1, 0, 3),
  cashOutOption('cashout.situation.underdogGoalDiff', 'Diferenca de gols da zebra', 'Situacao de jogo para cashout', -10, 10, 1, 0, 3),
  cashOutOption('cashout.situation.homeGoalDiff', 'Diferenca de gols do mandante', 'Situacao de jogo para cashout', -10, 10, 1, 0, 3),
  cashOutOption('cashout.situation.awayGoalDiff', 'Diferenca de gols do visitante', 'Situacao de jogo para cashout', -10, 10, 1, 0, 3),
];

export const cashOutParameters: ParameterOption[] = [
  ...cashOutCurrentOptions,
  ...cashOutSinceEntryOptions,
  ...cashOutWindowOptions,
  ...cashOutSituationOptions,
];

const preLiveReferences = [
  ['home', 'mandante'],
  ['away', 'visitante'],
  ['favorite', 'favorito'],
  ['underdog', 'zebra'],
] as const;

const historicalWindows = [
  ['season', 'na temporada'],
  ['last5', 'nos ultimos 5 jogos'],
  ['last10', 'nos ultimos 10 jogos'],
] as const;

const preLiveStatOption = (
  value: string,
  label: string,
  category: string,
  min = 0,
  max = 100,
  step = 0.1,
  defaultFrom: number | string = 0,
  defaultTo: number | string = max,
): ParameterOption => ({
  value,
  label,
  category,
  min,
  max,
  step,
  defaultFrom,
  defaultTo,
});

const goalsForOptions = preLiveReferences.flatMap(([reference, label]) =>
  historicalWindows.map(([window, windowLabel]) =>
    preLiveStatOption(`pre:goalsFor:${reference}:${window}`, `Media de gols marcados do ${label} ${windowLabel}`, 'Gols marcados', 0, 5, 0.1, 0.8, 2.5),
  ),
);

const goalsAgainstOptions = preLiveReferences.flatMap(([reference, label]) =>
  historicalWindows.map(([window, windowLabel]) =>
    preLiveStatOption(`pre:goalsAgainst:${reference}:${window}`, `Media de gols sofridos do ${label} ${windowLabel}`, 'Gols sofridos', 0, 5, 0.1, 0.8, 2.5),
  ),
);

const totalGoalsOptions: ParameterOption[] = [
  ...preLiveReferences.flatMap(([reference, label]) =>
    historicalWindows.map(([window, windowLabel]) =>
      preLiveStatOption(`pre:totalGoals:${reference}:${window}`, `Media de gols totais do ${label} ${windowLabel}`, 'Gols totais', 0, 7, 0.1, 1.5, 3.5),
    ),
  ),
  ...historicalWindows.map(([window, windowLabel]) =>
    preLiveStatOption(`pre:totalGoals:combined:${window}`, `Media de gols totais combinada dos dois times ${windowLabel}`, 'Gols totais', 0, 7, 0.1, 1.8, 3.5),
  ),
];

const bttsOptions: ParameterOption[] = [
  ...preLiveReferences.flatMap(([reference, label]) =>
    historicalWindows.map(([window, windowLabel]) =>
      preLiveStatOption(`pre:btts:${reference}:${window}`, `Percentual BTTS Sim do ${label} ${windowLabel}`, 'BTTS', 0, 100, 1, 40, 80),
    ),
  ),
  ...historicalWindows.map(([window, windowLabel]) =>
    preLiveStatOption(`pre:btts:combined:${window}`, `Percentual BTTS Sim combinado dos dois times ${windowLabel}`, 'BTTS', 0, 100, 1, 45, 80),
  ),
];

const overUnderLines = ['0.5', '1.5', '2.5', '3.5'] as const;

const overUnderOptions: ParameterOption[] = [
  ...(['home', 'away'] as const).flatMap((reference) =>
    overUnderLines.flatMap((line) =>
      historicalWindows.map(([window, windowLabel]) =>
        preLiveStatOption(
          `pre:over:${reference}:${line}:${window}`,
          `Percentual Over ${line} FT do ${reference === 'home' ? 'mandante' : 'visitante'} ${windowLabel}`,
          'Over/Under',
          0,
          100,
          1,
          50,
          90,
        ),
      ),
    ),
  ),
  ...['1.5', '2.5'].flatMap((line) =>
    historicalWindows.map(([window, windowLabel]) =>
      preLiveStatOption(`pre:over:combined:${line}:${window}`, `Percentual Over ${line} FT combinado ${windowLabel}`, 'Over/Under', 0, 100, 1, 50, 90),
    ),
  ),
  ...['2.5', '3.5'].flatMap((line) =>
    historicalWindows.map(([window, windowLabel]) =>
      preLiveStatOption(`pre:under:combined:${line}:${window}`, `Percentual Under ${line} FT combinado ${windowLabel}`, 'Over/Under', 0, 100, 1, 40, 80),
    ),
  ),
];

const homeAwayOptions: ParameterOption[] = [
  ['goalsForAvg', 'Media de gols marcados em casa', 'homeOnly', 'home'],
  ['goalsAgainstAvg', 'Media de gols sofridos em casa', 'homeOnly', 'home'],
  ['cornersAvg', 'Media de escanteios em casa', 'homeOnly', 'home'],
  ['cardsAvg', 'Media de cartoes em casa', 'homeOnly', 'home'],
  ['pointsAvg', 'Aproveitamento em casa', 'homeOnly', 'home'],
  ['bttsPercent', 'Percentual BTTS em casa', 'homeOnly', 'home'],
  ['over15Percent', 'Percentual Over 1.5 em casa', 'homeOnly', 'home'],
  ['over25Percent', 'Percentual Over 2.5 em casa', 'homeOnly', 'home'],
  ['goalsForAvg', 'Media de gols marcados fora', 'awayOnly', 'away'],
  ['goalsAgainstAvg', 'Media de gols sofridos fora', 'awayOnly', 'away'],
  ['cornersAvg', 'Media de escanteios fora', 'awayOnly', 'away'],
  ['cardsAvg', 'Media de cartoes fora', 'awayOnly', 'away'],
  ['pointsAvg', 'Aproveitamento fora', 'awayOnly', 'away'],
  ['bttsPercent', 'Percentual BTTS fora', 'awayOnly', 'away'],
  ['over15Percent', 'Percentual Over 1.5 fora', 'awayOnly', 'away'],
  ['over25Percent', 'Percentual Over 2.5 fora', 'awayOnly', 'away'],
].map(([field, label, window, reference]) =>
  preLiveStatOption(`pre:homeAway:${reference}:${window}:${field}`, label, 'Casa/Fora', 0, field === 'pointsAvg' ? 3 : 100, field === 'pointsAvg' ? 0.1 : 1, 0, field === 'pointsAvg' ? 3 : 80),
);

const formOptions: ParameterOption[] = [
  ...(['home', 'away'] as const).flatMap((reference) =>
    [
      ['wins', 'Vitorias'],
      ['draws', 'Empates'],
      ['losses', 'Derrotas'],
      ['points', 'Pontos'],
    ].map(([field, label]) =>
      preLiveStatOption(`pre:form:${field}:${reference}:last5`, `${label} do ${reference === 'home' ? 'mandante' : 'visitante'} nos ultimos 5 jogos`, 'Forma recente', 0, field === 'points' ? 15 : 5, 1, 0, field === 'points' ? 10 : 3),
    ),
  ),
  ...(['favorite', 'underdog'] as const).map((reference) =>
    preLiveStatOption(`pre:form:points:${reference}:last5`, `Pontos do ${reference === 'favorite' ? 'favorito' : 'zebra'} nos ultimos 5 jogos`, 'Forma recente', 0, 15, 1, 0, 10),
  ),
  ...(['home', 'away'] as const).flatMap((reference) =>
    [
      ['winningStreak', 'Sequencia de vitorias'],
      ['unbeatenStreak', 'Sequencia sem perder'],
      ['winlessStreak', 'Sequencia sem vencer'],
      ['concedingStreak', 'Sequencia de jogos sofrendo gol'],
      ['scoringStreak', 'Sequencia de jogos marcando gol'],
      ['bttsStreak', 'Sequencia de jogos BTTS'],
      ['over15Streak', 'Sequencia de jogos Over 1.5'],
      ['over25Streak', 'Sequencia de jogos Over 2.5'],
    ].map(([field, label]) =>
      preLiveStatOption(`pre:streak:${field}:${reference}`, `${label} - ${reference === 'home' ? 'mandante' : 'visitante'}`, 'Forma recente', 0, 20, 1, 0, 5),
    ),
  ),
];

const favoriteOptions: ParameterOption[] = [
  { value: 'pre:favorite:isHome', label: 'Favorito e mandante', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'pre:favorite:isAway', label: 'Favorito e visitante', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'pre:underdog:isHome', label: 'Zebra e mandante', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'pre:underdog:isAway', label: 'Zebra e visitante', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  preLiveStatOption('pre:favorite:oddDiff', 'Diferenca de odd entre favorito e zebra', 'Tabela e favoritismo', 0, 20, 0.01, 0.2, 2),
  preLiveStatOption('pre:favorite:percent', 'Percentual de favoritismo', 'Tabela e favoritismo', 0, 100, 1, 50, 80),
  preLiveStatOption('pre:favorite:odd', 'Favorito com odd entre X e Y', 'Tabela e favoritismo', 1.01, 50, 0.01, 1.2, 2),
  preLiveStatOption('pre:underdog:odd', 'Zebra com odd entre X e Y', 'Tabela e favoritismo', 1.01, 50, 0.01, 2, 6),
  { value: 'pre:favorite:betterTablePosition', label: 'Favorito tem melhor posicao na tabela', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  { value: 'pre:underdog:betterTablePosition', label: 'Zebra tem melhor posicao na tabela', category: 'Tabela e favoritismo', min: 1, max: 1, defaultFrom: 1, defaultTo: 1 },
  preLiveStatOption('pre:diff:tablePosition', 'Diferenca de posicoes na tabela', 'Diferencas entre equipes', -30, 30, 1, 0, 10),
  preLiveStatOption('pre:diff:performance', 'Diferenca de aproveitamento', 'Diferencas entre equipes', -100, 100, 1, 0, 30),
  preLiveStatOption('pre:diff:goalsForSeason', 'Diferenca de media de gols marcados', 'Diferencas entre equipes', -5, 5, 0.1, 0, 1.5),
  preLiveStatOption('pre:diff:goalsAgainstSeason', 'Diferenca de media de gols sofridos', 'Diferencas entre equipes', -5, 5, 0.1, 0, 1.5),
  preLiveStatOption('pre:diff:formPointsLast5', 'Diferenca de forma recente', 'Diferencas entre equipes', -15, 15, 1, 0, 6),
];

const preLiveOddsOptions: ParameterOption[] = [
  ['home', 'Mandante'],
  ['draw', 'Empate'],
  ['away', 'Visitante'],
  ['favorite', 'Favorito'],
  ['underdog', 'Zebra'],
  ['over05', 'Over 0.5 FT'],
  ['over15', 'Over 1.5 FT'],
  ['over25', 'Over 2.5 FT'],
  ['over35', 'Over 3.5 FT'],
  ['under05', 'Under 0.5 FT'],
  ['under15', 'Under 1.5 FT'],
  ['under25', 'Under 2.5 FT'],
  ['under35', 'Under 3.5 FT'],
  ['bttsYes', 'BTTS Sim'],
  ['bttsNo', 'BTTS Nao'],
  ['over05HT', 'Over 0.5 HT'],
  ['over15HT', 'Over 1.5 HT'],
  ['under05HT', 'Under 0.5 HT'],
  ['under15HT', 'Under 1.5 HT'],
].map(([field, label]) => preLiveStatOption(`pre:odds:${field}`, `Odd pre-live - ${label}`, 'Odds pre-live', 1.01, 50, 0.01, 1.5, 3));

const cornersCardsOptions: ParameterOption[] = [
  ...(['home', 'away'] as const).flatMap((reference) =>
    historicalWindows.flatMap(([window, windowLabel]) => [
      preLiveStatOption(`pre:corners:${reference}:${window}`, `Media de escanteios do ${reference === 'home' ? 'mandante' : 'visitante'} ${windowLabel}`, 'Escanteios historicos', 0, 20, 0.1, 3, 8),
      preLiveStatOption(`pre:cards:${reference}:${window}`, `Media de cartoes do ${reference === 'home' ? 'mandante' : 'visitante'} ${windowLabel}`, 'Cartoes historicos', 0, 12, 0.1, 1, 5),
    ]),
  ),
  ...historicalWindows.flatMap(([window, windowLabel]) => [
    preLiveStatOption(`pre:corners:combined:${window}`, `Media de escanteios combinada dos dois times ${windowLabel}`, 'Escanteios historicos', 0, 25, 0.1, 6, 14),
    preLiveStatOption(`pre:cards:combined:${window}`, `Media de cartoes combinada dos dois times ${windowLabel}`, 'Cartoes historicos', 0, 16, 0.1, 2, 8),
  ]),
];

const historicalShotsOptions: ParameterOption[] = [
  ...preLiveReferences.flatMap(([reference, label]) =>
    historicalWindows.flatMap(([window, windowLabel]) => [
      preLiveStatOption(`pre:shots:${reference}:${window}`, `Media de finalizacoes do ${label} ${windowLabel}`, 'Finalizacoes historicas', 0, 40, 0.1, 6, 18),
      preLiveStatOption(`pre:shotsOnTarget:${reference}:${window}`, `Media de finalizacoes no alvo do ${label} ${windowLabel}`, 'Finalizacoes historicas', 0, 20, 0.1, 2, 8),
    ]),
  ),
];

export const preLiveParameters: ParameterOption[] = [
  { value: 'championship', label: 'Campeonato', category: 'Identificacao da partida', valueType: 'text' },
  { value: 'season', label: 'Temporada', category: 'Identificacao da partida', valueType: 'text' },
  { value: 'homeTeam', label: 'Time mandante', category: 'Identificacao da partida', valueType: 'text' },
  { value: 'awayTeam', label: 'Time visitante', category: 'Identificacao da partida', valueType: 'text' },
  { value: 'tablePosition', label: 'Posicao na tabela - legado', category: 'Tabela e favoritismo', min: 1, max: 30, defaultFrom: 1, defaultTo: 12 },
  { value: 'performance', label: 'Aproveitamento (%) - legado', category: 'Tabela e favoritismo', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'favoritism', label: 'Favoritismo pre-live (%) - legado', category: 'Tabela e favoritismo', min: 0, max: 100, defaultFrom: 50, defaultTo: 100 },
  { value: 'preLiveOdds', label: 'Odds pre-live - mercado escolhido', category: 'Odds pre-live', min: 1.01, max: 50, step: 0.01, defaultFrom: 1.5, defaultTo: 20 },
  { value: 'averageGoals', label: 'Media de gols - legado', category: 'Gols totais', min: 0, max: 6, step: 0.1, defaultFrom: 1.5, defaultTo: 4 },
  { value: 'averageCorners', label: 'Media de escanteios - legado', category: 'Escanteios historicos', min: 0, max: 20, step: 0.1, defaultFrom: 6, defaultTo: 14 },
  { value: 'averageCards', label: 'Media de cartoes - legado', category: 'Cartoes historicos', min: 0, max: 12, step: 0.1, defaultFrom: 0, defaultTo: 6 },
  { value: 'winningStreak', label: 'Sequencia de vitorias - legado', category: 'Forma recente', min: 0, max: 15, defaultFrom: 0, defaultTo: 5 },
  { value: 'losingStreak', label: 'Sequencia de derrotas - legado', category: 'Forma recente', min: 0, max: 15, defaultFrom: 0, defaultTo: 3 },
  { value: 'headToHead', label: 'Confronto direto', category: 'Confronto direto', min: 0, max: 10, step: 0.1, defaultFrom: 0, defaultTo: 4 },
  { value: 'offensiveStrength', label: 'Forca ofensiva historica - legado', category: 'Finalizacoes historicas', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  { value: 'defensiveStrength', label: 'Forca defensiva historica - legado', category: 'Gols sofridos', min: 0, max: 100, defaultFrom: 40, defaultTo: 100 },
  ...preLiveOddsOptions,
  ...favoriteOptions,
  ...goalsForOptions,
  ...goalsAgainstOptions,
  ...totalGoalsOptions,
  ...bttsOptions,
  ...overUnderOptions,
  ...homeAwayOptions,
  ...formOptions,
  ...cornersCardsOptions,
  ...historicalShotsOptions,
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
