import { evaluateBotRules } from './evaluateBotRules';
import { ConditionGroup, MatchApiType } from '../types/rules';

const assertEqual = (actual: boolean, expected: boolean, scenario: string) => {
  if (actual !== expected) {
    throw new Error(`${scenario}: esperado ${String(expected)}, recebido ${String(actual)}`);
  }
};

const matchStats: MatchApiType = {
  minuto: 28,
  placar_mandante: 0,
  placar_visitante: 0,
  posse_mandante: 62,
  ataques_perigosos_mandante: 24,
  finalizacoes_mandante: 9,
  finalizacoes_no_alvo_mandante: 4,
  escanteios_mandante: 5,
  eventos_recentes: ['finalizacao', 'escanteio'],
};

export const runEvaluateBotRulesTests = () => {
  const andRules: ConditionGroup = {
    operator: 'AND',
    conditions: [
      { field: 'minuto', operator: 'between', value: [20, 35] },
      { field: 'ataques_perigosos_mandante', operator: 'gte', value: 20 },
      { field: 'finalizacoes_mandante', operator: 'gte', value: 8 },
      { field: 'placar_mandante', operator: 'eq', value: 0 },
      { field: 'placar_visitante', operator: 'eq', value: 0 },
    ],
  };

  const orRules: ConditionGroup = {
    operator: 'OR',
    conditions: [
      { field: 'posse_mandante', operator: 'gte', value: 70 },
      { field: 'escanteios_mandante', operator: 'gte', value: 5 },
    ],
  };

  const notRules: ConditionGroup = {
    operator: 'AND',
    conditions: [
      { field: 'eventos_recentes', operator: 'contains', value: 'escanteio' },
      {
        operator: 'NOT',
        conditions: [{ field: 'eventos_recentes', operator: 'contains', value: 'cartao_vermelho' }],
      },
    ],
  };

  const failingRules: ConditionGroup = {
    operator: 'AND',
    conditions: [
      { field: 'posse_mandante', operator: 'gte', value: 65 },
      { field: 'finalizacoes_no_alvo_mandante', operator: 'gte', value: 5 },
    ],
  };

  assertEqual(evaluateBotRules(matchStats, andRules), true, 'aprova regras AND de entrada ao vivo');
  assertEqual(evaluateBotRules(matchStats, orRules), true, 'aprova quando uma regra OR passa');
  assertEqual(evaluateBotRules(matchStats, notRules), true, 'aprova regra NOT sem evento bloqueador');
  assertEqual(evaluateBotRules(matchStats, failingRules), false, 'reprova quando uma regra AND falha');

  return true;
};

runEvaluateBotRulesTests();
