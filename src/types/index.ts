export type BotMode = 'pre-live' | 'ao-vivo';
export type TradeSide = 'BACK' | 'LAY';
export type Sport = 'Futebol';
export type GameStatus = 'ao-vivo' | 'historico' | 'agendado';

export interface LiveStats {
  shots: number;
  shotsOnTarget: number;
  dangerousAttacks: number;
  corners: number;
  possession: number;
  cards: number;
  offensivePressure: number;
  recentShots: number;
}

export interface GameSnapshot {
  minute: number;
  scoreHome: number;
  scoreAway: number;
  homeOdd: number;
  drawOdd: number;
  awayOdd: number;
  over15Odd: number;
  over25Odd: number;
  under25Odd: number;
  bttsOdd: number;
  stats: LiveStats;
  events: string[];
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

export interface LiveRuleSet {
  minShots?: number;
  minShotsOnTarget?: number;
  minDangerousAttacks?: number;
  minCorners?: number;
  minPossession?: number;
  maxCards?: number;
  minOffensivePressure?: number;
  minRecentShots?: number;
  score?: string;
  currentOddMin?: number;
  currentOddMax?: number;
}

export interface PreLiveRuleSet {
  minPreLiveOdd?: number;
  maxPreLiveOdd?: number;
  leagues?: string;
  teams?: string;
  minAverageGoals?: number;
  minAverageCorners?: number;
  minH2HGoals?: number;
  maxTablePositionGap?: number;
  minFavoritism?: number;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  mode: BotMode;
  sport: Sport;
  market: string;
  side: TradeSide;
  minOdd: number;
  maxOdd: number;
  targetOdd: number;
  entryMinute: number;
  limitMinute: number;
  exitMinute: number;
  stake: number;
  scoreFilter: string;
  leagues: string;
  teams: string;
  liveRules: LiveRuleSet;
  preLiveRules: PreLiveRuleSet;
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
  side: TradeSide;
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
  market: string;
}

export interface AppSettings {
  bankroll: number;
  defaultStake: number;
  currency: 'BRL';
  simulationDelay: number;
}

export * from './rules';
