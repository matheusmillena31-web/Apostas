import { ComparableValue, ConditionGroup, MatchApiType, RuleCondition, RuleNode } from '../types/rules';

const isConditionGroup = (node: RuleNode): node is ConditionGroup => 'conditions' in node;

const getFieldValue = (matchStats: MatchApiType, field: string): unknown =>
  field.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }

    return undefined;
  }, matchStats);

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const compareBetween = (actual: unknown, expected: ComparableValue) => {
  const actualNumber = toNumber(actual);
  if (actualNumber === null || !Array.isArray(expected)) return false;

  const [min, max] = expected;
  return actualNumber >= min && actualNumber <= max;
};

const compareContains = (actual: unknown, expected: ComparableValue) => {
  if (Array.isArray(actual)) return actual.includes(expected);
  return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());
};

const compareNumeric = (
  actual: unknown,
  expected: ComparableValue,
  comparator: (actualNumber: number, expectedNumber: number) => boolean,
) => {
  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);

  if (actualNumber === null || expectedNumber === null) return false;
  return comparator(actualNumber, expectedNumber);
};

const evaluateCondition = (matchStats: MatchApiType, condition: RuleCondition): boolean => {
  const actual = getFieldValue(matchStats, condition.field);

  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'gt':
      return compareNumeric(actual, condition.value, (current, target) => current > target);
    case 'gte':
      return compareNumeric(actual, condition.value, (current, target) => current >= target);
    case 'lt':
      return compareNumeric(actual, condition.value, (current, target) => current < target);
    case 'lte':
      return compareNumeric(actual, condition.value, (current, target) => current <= target);
    case 'between':
      return compareBetween(actual, condition.value);
    case 'contains':
      return compareContains(actual, condition.value);
    case 'not_contains':
      return !compareContains(actual, condition.value);
    default:
      return false;
  }
};

const evaluateNode = (matchStats: MatchApiType, node: RuleNode): boolean => {
  if (!isConditionGroup(node)) {
    return evaluateCondition(matchStats, node);
  }

  switch (node.operator) {
    case 'AND':
      return node.conditions.every((condition) => evaluateNode(matchStats, condition));
    case 'OR':
      return node.conditions.some((condition) => evaluateNode(matchStats, condition));
    case 'NOT':
      return node.conditions.length > 0 && !node.conditions.every((condition) => evaluateNode(matchStats, condition));
    default:
      return false;
  }
};

export const evaluateBotRules = (matchStats: MatchApiType, rules: ConditionGroup): boolean =>
  evaluateNode(matchStats, rules);
