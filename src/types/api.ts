export interface ApiFootballEnvelope<TResponse> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown[] | Record<string, unknown>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: TResponse;
}

export interface ApiFootballProxyStatus {
  ok: boolean;
  service: string;
  provider: 'api-football';
  hasToken: boolean;
  baseUrl: string;
  snapshotPath: string;
  snapshotCount: number;
}

export interface ApiFootballLeague {
  id: number;
  name: string;
  type: string;
  logo: string;
}

export interface ApiFootballCountry {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface ApiFootballLeagueSeason {
  year: number;
  start: string;
  end: string;
  current: boolean;
  coverage: {
    fixtures: {
      events: boolean;
      lineups: boolean;
      statistics_fixtures: boolean;
      statistics_players: boolean;
    };
    standings: boolean;
    players: boolean;
    top_scorers: boolean;
    top_assists: boolean;
    top_cards: boolean;
    injuries: boolean;
    predictions: boolean;
    odds: boolean;
  };
}

export interface ApiFootballLeagueItem {
  league: ApiFootballLeague;
  country: ApiFootballCountry;
  seasons: ApiFootballLeagueSeason[];
}

export interface ApiFootballTeam {
  id: number;
  name: string;
  logo: string;
  winner?: boolean | null;
}

export interface ApiFootballFixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
  extra: number | null;
}

export interface ApiFootballFixtureVenue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface ApiFootballFixtureItem {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: ApiFootballFixtureVenue;
    status: ApiFootballFixtureStatus;
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: ApiFootballTeam;
    away: ApiFootballTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ApiFootballFixtureStatistic {
  type: string;
  value: number | string | null;
}

export interface ApiFootballFixtureStatisticsItem {
  team: ApiFootballTeam;
  statistics: ApiFootballFixtureStatistic[];
}

export interface ApiFootballFixtureEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: ApiFootballTeam;
  player: {
    id: number | null;
    name: string | null;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string;
  detail: string;
  comments: string | null;
}

export interface ApiFootballStandingItem {
  rank: number;
  team: ApiFootballTeam;
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  home: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  away: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  update: string;
}

export interface ApiFootballStandingsLeague {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    standings: ApiFootballStandingItem[][];
  };
}

export interface ApiFootballOddsValue {
  value: string;
  odd: string;
  handicap?: string | null;
  main?: boolean;
  suspended?: boolean;
}

export interface ApiFootballOddsBet {
  id: number;
  name: string;
  values: ApiFootballOddsValue[];
}

export interface ApiFootballBookmaker {
  id: number;
  name: string;
  bets: ApiFootballOddsBet[];
}

export interface ApiFootballOddsItem {
  league: ApiFootballFixtureItem['league'];
  fixture: ApiFootballFixtureItem['fixture'];
  update: string;
  bookmakers: ApiFootballBookmaker[];
}

export interface ApiFootballLiveOddsItem {
  fixture?: ApiFootballFixtureItem['fixture'];
  league?: ApiFootballFixtureItem['league'];
  teams?: ApiFootballFixtureItem['teams'];
  update?: string;
  odds?: ApiFootballOddsBet[];
  bookmakers?: ApiFootballBookmaker[];
}
