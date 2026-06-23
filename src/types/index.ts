export type BotMode = 'pre-live' | 'live';
export type TradeSide = 'BACK' | 'LAY';
export type Sport = 'Futebol';
export type GameStatus = 'ao-vivo' | 'historico' | 'agendado';
export type BotRuleOperator = '>=' | '<=' | '=' | '!=' | 'between';
export type BotRuleConnector = 'AND' | 'OR' | 'NOT';

export type TeamReference = 'home' | 'away' | 'favorite' | 'underdog';

export interface TeamLiveStats {
  shots?: number;
  shotsOnTarget?: number;
  dangerousAttacks?: number;
  attacks?: number;
  corners?: number;
  possession?: number;
  cards?: number;
  yellowCards?: number;
  redCards?: number;
}

export interface HistoricalOdd {
  marketName: string;
  value: string;
  odd: number;
  handicap?: string | null;
}

export interface LiveStats {
  shots: number;
  shotsOnTarget: number;
  dangerousAttacks: number;
  attacks?: number;
  corners: number;
  possession: number;
  cards: number;
  offensivePressure: number;
  recentShots: number;
  home?: TeamLiveStats;
  away?: TeamLiveStats;
}

export interface GameSnapshot {
  minute: number;
  scoreHome: number;
  scoreAway: number;
  halfTimeScoreHome?: number | null;
  halfTimeScoreAway?: number | null;
  homeOdd: number;
  drawOdd: number;
  awayOdd: number;
  over15Odd: number;
  over25Odd: number;
  under25Odd: number;
  bttsOdd: number;
  stats: LiveStats;
  events: string[];
  odds?: HistoricalOdd[];
}

export interface Game {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  status: GameStatus;
  currentMinute: number;
  finalScoreHome: number;
  finalScoreAway: number;
  preLive: {
    homeOdd: number;
    drawOdd: number;
    awayOdd: number;
    over15Odd: number;
    over25Odd: number;
    under25Odd: number;
    bttsOdd: number;
    averageGoals: number;
    averageCorners: number;
    h2hGoals: number;
    tablePositionGap: number;
    favoritism: number;
  };
  snapshots: GameSnapshot[];
}

export interface BotRule {
  id: string;
  mode: BotMode;
  parameter: string;
  operator: BotRuleOperator;
  value: string | number;
  secondValue?: string | number;
  connector?: BotRuleConnector;
}

export interface BotCashOutConfig {
  enabled: boolean;
  fromMinute?: number;
  toMinute?: number;
  exitRules: BotRule[];
}

export interface Bot {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  mode: BotMode;
  sport?: Sport;
  market?: string;
  oddMarket?: string;
  operation?: TradeSide;
  minOdd?: number;
  maxOdd?: number;
  stake?: number;
  rules: BotRule[];
  includedLeagues?: string[];
  excludedLeagues?: string[];
  cashOut?: BotCashOutConfig;
  createdAt: string;
  updatedAt: string;
}

export interface TradeEntry {
  id: string;
  botId: string;
  botName: string;
  gameId: string;
  game: string;
  league: string;
  minute: number;
  market: string;
  operation: TradeSide;
  odd: number;
  stake: number;
  result: 'green' | 'red';
  profit: number;
  reason: string;
  date: string;
}

export interface BacktestResult {
  botId: string;
  botName: string;
  entries: TradeEntry[];
  totalEntries: number;
  greens: number;
  reds: number;
  profit: number;
  roi: number;
  averageOdd: number;
  averageMinute: number;
  bestLeague: string;
  worstLeague: string;
}

export interface BotLog {
  id: string;
  date: string;
  botId: string;
  botName: string;
  gameId: string;
  game: string;
  minute: number;
  checkedRule: string;
  rulePassed: boolean;
  entryMade: boolean;
  reason: string;
}

export interface MethodRanking {
  botId: string;
  botName: string;
  roi: number;
  profit: number;
  entries: number;
  greens: number;
  reds: number;
  accuracy: number;
  mode: BotMode;
  market?: string;
}

export interface AppSettings {
  bankroll: number;
  defaultStake: number;
  currency: 'BRL';
  simulationDelay: number;
}

export * from './rules';
