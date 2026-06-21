import { Game, GameSnapshot, LiveStats } from '../types';

type GoalEvent = {
  minute: number;
  side: 'home' | 'away';
};

type GameSeed = {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  status: Game['status'];
  currentMinute: number;
  goals: GoalEvent[];
  preLive: Game['preLive'];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const roundOdd = (value: number) => Number(value.toFixed(2));

const createStats = (minute: number, seed: number, homeGoals: number, awayGoals: number): LiveStats => {
  const pressureBias = homeGoals <= awayGoals ? 1.12 : 0.96;
  const pace = minute / 90;

  return {
    shots: Math.floor(pace * (8 + seed) + homeGoals + awayGoals),
    shotsOnTarget: Math.floor(pace * (3 + (seed % 5)) + homeGoals + awayGoals),
    dangerousAttacks: Math.floor(pace * (34 + seed * 4) * pressureBias),
    corners: Math.floor(pace * (5 + (seed % 6))),
    possession: clamp(47 + ((seed * 7) % 12) + homeGoals - awayGoals, 39, 66),
    cards: Math.floor(pace * (2 + (seed % 4))),
    offensivePressure: clamp(Math.floor(pace * 80 + seed * 3 + (homeGoals <= awayGoals ? 8 : 0)), 0, 100),
    recentShots: Math.floor(((minute + seed) % 12) / 3) + (minute > 55 ? 1 : 0),
  };
};

const getScoreAtMinute = (goals: GoalEvent[], minute: number) =>
  goals.reduce(
    (score, goal) => {
      if (goal.minute <= minute) {
        score[goal.side === 'home' ? 'home' : 'away'] += 1;
      }
      return score;
    },
    { home: 0, away: 0 },
  );

const createSnapshots = (seed: GameSeed): GameSnapshot[] => {
  const goalMap = new Map(seed.goals.map((goal) => [goal.minute, goal.side]));

  return Array.from({ length: 91 }, (_, minute) => {
    const score = getScoreAtMinute(seed.goals, minute);
    const totalGoals = score.home + score.away;
    const timeDecay = minute / 140;
    const pressure = createStats(minute, Number(seed.id.replace(/\D/g, '')) || 1, score.home, score.away);
    const goalEvent = goalMap.get(minute);

    return {
      minute,
      scoreHome: score.home,
      scoreAway: score.away,
      homeOdd: roundOdd(clamp(seed.preLive.homeOdd - score.home * 0.55 + score.away * 0.55 + timeDecay, 1.18, 8.5)),
      drawOdd: roundOdd(clamp(seed.preLive.drawOdd + totalGoals * 0.4 - minute / 180, 1.75, 7.5)),
      awayOdd: roundOdd(clamp(seed.preLive.awayOdd - score.away * 0.55 + score.home * 0.55 + timeDecay, 1.18, 8.5)),
      over15Odd: roundOdd(clamp(seed.preLive.over15Odd - totalGoals * 0.58 + (90 - minute) / 240, 1.08, 4.2)),
      over25Odd: roundOdd(clamp(seed.preLive.over25Odd - totalGoals * 0.48 + (90 - minute) / 170, 1.16, 5.2)),
      under25Odd: roundOdd(clamp(seed.preLive.under25Odd + totalGoals * 0.56 - minute / 190, 1.1, 4.8)),
      bttsOdd: roundOdd(clamp(seed.preLive.bttsOdd - (score.home > 0 && score.away > 0 ? 1.1 : totalGoals * 0.25), 1.12, 4.6)),
      stats: pressure,
      events: goalEvent ? [`Gol do ${goalEvent === 'home' ? seed.homeTeam : seed.awayTeam}`] : [],
    };
  });
};

const seeds: GameSeed[] = [
  {
    id: 'game-01',
    league: 'Brasileirao Serie A',
    homeTeam: 'Flamengo',
    awayTeam: 'Fortaleza',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 18, side: 'home' },
      { minute: 64, side: 'away' },
      { minute: 78, side: 'home' },
    ],
    preLive: {
      homeOdd: 1.82,
      drawOdd: 3.55,
      awayOdd: 4.4,
      over15Odd: 1.38,
      over25Odd: 2.02,
      under25Odd: 1.84,
      bttsOdd: 1.92,
      averageGoals: 2.65,
      averageCorners: 9.4,
      h2hGoals: 2.8,
      tablePositionGap: 6,
      favoritism: 67,
    },
  },
  {
    id: 'game-02',
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Aston Villa',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 29, side: 'home' },
      { minute: 52, side: 'home' },
    ],
    preLive: {
      homeOdd: 1.68,
      drawOdd: 3.9,
      awayOdd: 5.2,
      over15Odd: 1.29,
      over25Odd: 1.74,
      under25Odd: 2.18,
      bttsOdd: 1.78,
      averageGoals: 2.9,
      averageCorners: 10.1,
      h2hGoals: 2.4,
      tablePositionGap: 4,
      favoritism: 72,
    },
  },
  {
    id: 'game-03',
    league: 'La Liga',
    homeTeam: 'Real Sociedad',
    awayTeam: 'Valencia',
    status: 'historico',
    currentMinute: 90,
    goals: [{ minute: 71, side: 'away' }],
    preLive: {
      homeOdd: 2.15,
      drawOdd: 3.2,
      awayOdd: 3.65,
      over15Odd: 1.48,
      over25Odd: 2.28,
      under25Odd: 1.66,
      bttsOdd: 2.04,
      averageGoals: 2.1,
      averageCorners: 8.2,
      h2hGoals: 1.9,
      tablePositionGap: 3,
      favoritism: 55,
    },
  },
  {
    id: 'game-04',
    league: 'Serie A Italia',
    homeTeam: 'Atalanta',
    awayTeam: 'Bologna',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 9, side: 'away' },
      { minute: 37, side: 'home' },
      { minute: 58, side: 'home' },
      { minute: 84, side: 'away' },
    ],
    preLive: {
      homeOdd: 1.95,
      drawOdd: 3.45,
      awayOdd: 3.95,
      over15Odd: 1.35,
      over25Odd: 1.9,
      under25Odd: 1.95,
      bttsOdd: 1.74,
      averageGoals: 2.75,
      averageCorners: 9.7,
      h2hGoals: 2.6,
      tablePositionGap: 2,
      favoritism: 61,
    },
  },
  {
    id: 'game-05',
    league: 'Bundesliga',
    homeTeam: 'Leverkusen',
    awayTeam: 'Mainz',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 22, side: 'home' },
      { minute: 44, side: 'home' },
      { minute: 66, side: 'home' },
    ],
    preLive: {
      homeOdd: 1.48,
      drawOdd: 4.35,
      awayOdd: 6.8,
      over15Odd: 1.22,
      over25Odd: 1.62,
      under25Odd: 2.42,
      bttsOdd: 1.86,
      averageGoals: 3.05,
      averageCorners: 10.6,
      h2hGoals: 3.1,
      tablePositionGap: 10,
      favoritism: 81,
    },
  },
  {
    id: 'game-06',
    league: 'Ligue 1',
    homeTeam: 'Lyon',
    awayTeam: 'Nice',
    status: 'historico',
    currentMinute: 90,
    goals: [],
    preLive: {
      homeOdd: 2.42,
      drawOdd: 3.05,
      awayOdd: 3.1,
      over15Odd: 1.56,
      over25Odd: 2.42,
      under25Odd: 1.58,
      bttsOdd: 2.1,
      averageGoals: 1.95,
      averageCorners: 7.9,
      h2hGoals: 1.7,
      tablePositionGap: 1,
      favoritism: 51,
    },
  },
  {
    id: 'game-07',
    league: 'Liga Portugal',
    homeTeam: 'Benfica',
    awayTeam: 'Braga',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 16, side: 'home' },
      { minute: 33, side: 'away' },
      { minute: 76, side: 'home' },
    ],
    preLive: {
      homeOdd: 1.72,
      drawOdd: 3.75,
      awayOdd: 4.75,
      over15Odd: 1.31,
      over25Odd: 1.82,
      under25Odd: 2.05,
      bttsOdd: 1.72,
      averageGoals: 2.85,
      averageCorners: 9.9,
      h2hGoals: 2.9,
      tablePositionGap: 5,
      favoritism: 69,
    },
  },
  {
    id: 'game-08',
    league: 'Argentina Primera',
    homeTeam: 'River Plate',
    awayTeam: 'Lanus',
    status: 'historico',
    currentMinute: 90,
    goals: [
      { minute: 49, side: 'home' },
      { minute: 89, side: 'away' },
    ],
    preLive: {
      homeOdd: 1.88,
      drawOdd: 3.35,
      awayOdd: 4.6,
      over15Odd: 1.44,
      over25Odd: 2.12,
      under25Odd: 1.76,
      bttsOdd: 1.98,
      averageGoals: 2.25,
      averageCorners: 8.6,
      h2hGoals: 2.2,
      tablePositionGap: 7,
      favoritism: 64,
    },
  },
  {
    id: 'game-09',
    league: 'MLS',
    homeTeam: 'Inter Miami',
    awayTeam: 'Atlanta United',
    status: 'ao-vivo',
    currentMinute: 63,
    goals: [
      { minute: 12, side: 'home' },
      { minute: 41, side: 'away' },
      { minute: 57, side: 'home' },
    ],
    preLive: {
      homeOdd: 1.9,
      drawOdd: 3.85,
      awayOdd: 3.8,
      over15Odd: 1.24,
      over25Odd: 1.69,
      under25Odd: 2.28,
      bttsOdd: 1.62,
      averageGoals: 3.2,
      averageCorners: 9.1,
      h2hGoals: 3.4,
      tablePositionGap: 4,
      favoritism: 63,
    },
  },
  {
    id: 'game-10',
    league: 'Copa Libertadores',
    homeTeam: 'Palmeiras',
    awayTeam: 'Colo-Colo',
    status: 'ao-vivo',
    currentMinute: 38,
    goals: [{ minute: 27, side: 'home' }],
    preLive: {
      homeOdd: 1.58,
      drawOdd: 3.9,
      awayOdd: 6.1,
      over15Odd: 1.34,
      over25Odd: 1.96,
      under25Odd: 1.88,
      bttsOdd: 2.06,
      averageGoals: 2.55,
      averageCorners: 9.5,
      h2hGoals: 2.1,
      tablePositionGap: 8,
      favoritism: 76,
    },
  },
];

export const mockGames: Game[] = seeds.map((seed) => {
  const snapshots = createSnapshots(seed);
  const finalScore = getScoreAtMinute(seed.goals, 90);

  return {
    id: seed.id,
    league: seed.league,
    homeTeam: seed.homeTeam,
    awayTeam: seed.awayTeam,
    status: seed.status,
    currentMinute: seed.currentMinute,
    finalScoreHome: finalScore.home,
    finalScoreAway: finalScore.away,
    preLive: seed.preLive,
    snapshots,
  };
});

export const historicalGames = mockGames.filter((game) => game.status === 'historico');
export const liveGames = mockGames.filter((game) => game.status === 'ao-vivo');
