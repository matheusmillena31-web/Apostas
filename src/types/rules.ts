export type LogicalOperator = 'AND' | 'OR' | 'NOT';

export type ComparisonOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'not_contains';

export type ComparableValue = string | number | boolean | [number, number];

export interface MatchApiType {
  minuto?: number;
  placar_mandante?: number;
  placar_visitante?: number;
  posse_mandante?: number;
  posse_visitante?: number;
  ataques_mandante?: number;
  ataques_visitante?: number;
  ataques_perigosos_mandante?: number;
  ataques_perigosos_visitante?: number;
  finalizacoes_mandante?: number;
  finalizacoes_visitante?: number;
  finalizacoes_no_alvo_mandante?: number;
  finalizacoes_no_alvo_visitante?: number;
  escanteios_mandante?: number;
  escanteios_visitante?: number;
  cartoes_mandante?: number;
  cartoes_visitante?: number;
  eventos_recentes?: string[];
  [key: string]: unknown;
}

export interface RuleCondition {
  field: string;
  operator: ComparisonOperator;
  value: ComparableValue;
}

export type RuleNode = RuleCondition | ConditionGroup;

export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: RuleNode[];
}

export type BotFilterOperator = '>=' | '<=';

export interface BotFilterRule {
  id: string;
  field: keyof MatchApiType & string;
  operator: BotFilterOperator;
  value: number;
}

export interface BotConfig {
  id: string;
  name: string;
  description: string;
  market: string;
  operation: 'BACK' | 'LAY';
  stake: number;
  logic: Extract<LogicalOperator, 'AND' | 'OR'>;
  filters: BotFilterRule[];
}
