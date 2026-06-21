export const formatCurrency = (value: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);

export const formatPercent = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`;

export const formatNumber = (value: number, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

export const includesAny = (source: string, filters: string[]) =>
  filters.length === 0 || filters.some((filter) => source.toLowerCase().includes(filter));
