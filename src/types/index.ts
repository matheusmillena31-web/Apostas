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

export interface PreLiveOdds {
  home?: number;
  draw?: number;
  away?: number;
  favorite?: number;
  underdog?: number;
  over05?: number;
  over15?: number;
  over25?: number;
  over35?: number;
  under05?: number;
  under15?: number;
  under25?: number;
  under35?: number;
  bttsYes?: number;
  bttsNo?: number;
  over05HT?: number;
  over15HT?: number;
  under05HT?: number;
  under15HT?: number;
}

export interface TeamHistoricalStats {
  games: number;
  wins?: number;
  draws?: number;
  losses?: number;
  points?: number;
  pointsAvg?: number;
  goalsForAvg?: number;
  goalsAgainstAvg?: number;
  totalGoalsAvg?: number;
  bttsPercent?: number;
  over05Percent?: number;
  over15Percent?: number;
  over25Percent?: number;
  over35Percent?: number;
  under25Percent?: number;
  under35Percent?: number;
  cornersAvg?: number;
  cardsAvg?: number;
  shotsAvg?: number;
  shotsOnTargetAvg?: number;
  cleanSheetsPercent?: number;
  failedToScorePercent?: number;
  winningStreak?: number;
  unbeatenStreak?: number;
  winlessStreak?: number;
  scoringStreak?: number;
  concedingStreak?: number;
  bttsStreak?: number;
  over15Streak?: number;
  over25Streak?: number;
}

export interface TeamPreLiveHistory {
  season?: TeamHistoricalStats;
  last5?: TeamHistoricalStats;
  last10?: TeamHistoricalStats;
  homeOnly?: TeamHistoricalStats;
  awayOnly?: TeamHistoricalStats;
}

export interface FavoritePreLiveInfo {
  side: 'home' | 'away' | 'none';
  odd?: number;
  underdogOdd?: number;
  favoritismPercent?: number;
}

export interface PreLiveDifferences {
  tablePosition?: number;
  formPointsLast5?: number;
  goalsForSeason?: number;
  goalsAgainstSeason?: number;
  bttsPercent?: number;
  over25Percent?: number;
  performance?: number;
}

export interface LiveStats {
  shots?: number;
  shotsOnTarget?: number;
  dangerousAttacks?: number;
  attacks?: number;
  corners?: number;
  possession?: number;
  cards?: number;
  offensivePressure?: number;
  recentShots?: number;
  home?: TeamLiveStats;
  away?: TeamLiveStats;
}

export interface GameSnapshot {
  capturedAt?: string;
  fixtureDate?: string;
  minute: number;
  scoreHome: number;
  scoreAway: number;
  halfTimeScoreHome?: number | null;
  halfTimeScoreAway?: number | null;
  homeOdd?: number;
  drawOdd?: number;
  awayOdd?: number;
  over15Odd?: number;
  over25Odd?: number;
  under25Odd?: number;
  bttsOdd?: number;
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
  fixtureDate?: string;
  preLive: {
    homeOdd?: number;
    drawOdd?: number;
    awayOdd?: number;
    over15Odd?: number;
    over25Odd?: number;
    under25Odd?: number;
    bttsOdd?: number;
    averageGoals?: number;
    averageCorners?: number;
    h2hGoals?: number;
    tablePositionGap?: number;
    favoritism?: number;
    season?: number;
    odds?: PreLiveOdds;
    home?: TeamPreLiveHistory;
    away?: TeamPreLiveHistory;
    favorite?: FavoritePreLiveInfo;
    differences?: PreLiveDifferences;
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
  exitLogic?: 'AND' | 'OR';
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
  cashOutApplied?: boolean;
  cashOutMinute?: number;
  cashOutOdd?: number;
  cashOutProfit?: number;
  cashOutReason?: string;
  cashOutRulesMatched?: string[];
  cashOutRulesFailed?: string[];
  entryScoreHome?: number;
  entryScoreAway?: number;
  exitScoreHome?: number;
  exitScoreAway?: number;
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

export type BacktestJobStatus = 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface BacktestJob {
  id: string;
  botId: string;
  botSnapshot: Bot;
  name: string;
  createdBy: string;
  type: 'Pre-Live' | 'Live';
  market?: string;
  parametersSummary: string;
  status: BacktestJobStatus;
  createdAt: string;
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: number;
  resultId?: string;
  result?: BacktestResult;
  logs?: BotLog[];
  errorMessage?: string;
  entries?: number;
  accuracy?: number;
  profit?: number;
  roi?: number;
  automation?: {
    source: 'autonomous';
    hash: string;
    baseBotId?: string;
    variantIndex?: number;
  };
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
