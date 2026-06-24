const asArray = (value) => (Array.isArray(value) ? value : []);

const toNumber = (value) => {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : undefined;
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const getFixtureFromPayload = (payload) => asArray(payload?.response).find((item) => item?.fixture?.id || item?.fixture);

const getFixtureId = (snapshot, fixture = getFixtureFromPayload(snapshot?.payload)) => {
  const queryFixture = Number(snapshot?.query?.fixture);
  if (Number.isFinite(queryFixture) && queryFixture > 0) return queryFixture;
  return firstDefined(fixture?.fixture?.id, fixture?.fixtureId);
};

const flattenOddsValues = (payload) =>
  asArray(payload?.response).flatMap((item) => [
    ...asArray(item?.odds),
    ...asArray(item?.bookmakers).flatMap((bookmaker) => asArray(bookmaker?.bets)),
  ]).flatMap((bet) => asArray(bet?.values));

const hasUsefulOdds = (payload) => flattenOddsValues(payload).some((value) => {
  const odd = toNumber(value?.odd);
  return odd !== undefined && odd > 1.01;
});

const hasUsefulStatistics = (payload) =>
  asArray(payload?.response).some((teamStats) =>
    asArray(teamStats?.statistics).some((stat) => stat?.value !== undefined && stat?.value !== null),
  );

const hasUsefulEvents = (payload) =>
  asArray(payload?.response).some((event) => {
    const type = String(event?.type ?? '').trim();
    return type.length > 0;
  });

const hasUsefulScore = (payload) =>
  asArray(payload?.response).some((fixture) => {
    const status = fixture?.fixture?.status;
    const goals = fixture?.goals;
    return Boolean(
      fixture?.fixture?.id &&
      (status?.short || status?.long || typeof goals?.home === 'number' || typeof goals?.away === 'number'),
    );
  });

export const classifySnapshotQuality = (snapshot) => {
  const payload = snapshot?.payload;
  const response = asArray(payload?.response);
  const fixture = getFixtureFromPayload(payload);
  const hasScore = hasUsefulScore(payload);
  const hasOdds = hasUsefulOdds(payload);
  const hasStatistics = hasUsefulStatistics(payload);
  const hasEvents = hasUsefulEvents(payload);
  const hasUsefulPayload = hasScore || hasOdds || hasStatistics || hasEvents;
  const payloadSize = Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8');

  let quality = 'empty';
  if (hasUsefulPayload) {
    if (hasScore && hasOdds && hasStatistics) quality = 'full';
    else if (hasScore && !hasOdds && !hasStatistics && !hasEvents) quality = 'score_only';
    else quality = 'partial';
  }

  return {
    quality,
    hasOdds,
    hasStatistics,
    hasEvents,
    hasScore,
    hasUsefulPayload,
    payloadSize,
    fixtureId: getFixtureId(snapshot, fixture),
    leagueId: firstDefined(fixture?.league?.id, response[0]?.league?.id),
    leagueName: firstDefined(fixture?.league?.name, response[0]?.league?.name),
    homeTeam: fixture?.teams?.home?.name,
    awayTeam: fixture?.teams?.away?.name,
  };
};

const summarizeFixture = (fixture) => ({
  fixture: {
    id: fixture?.fixture?.id,
    date: fixture?.fixture?.date,
    timestamp: fixture?.fixture?.timestamp,
    status: fixture?.fixture?.status,
  },
  league: fixture?.league
    ? {
        id: fixture.league.id,
        name: fixture.league.name,
        country: fixture.league.country,
        season: fixture.league.season,
        round: fixture.league.round,
      }
    : undefined,
  teams: fixture?.teams
    ? {
        home: fixture.teams.home,
        away: fixture.teams.away,
      }
    : undefined,
  goals: fixture?.goals,
  score: fixture?.score,
});

export const summarizeScoreOnlyPayload = (payload) => ({
  ...payload,
  response: asArray(payload?.response).map(summarizeFixture),
  results: asArray(payload?.response).length,
});

export const getScoreOnlySignature = (snapshot) => {
  const fixtures = asArray(snapshot?.payload?.response).map((fixture) => ({
    fixtureId: fixture?.fixture?.id,
    minute: fixture?.fixture?.status?.elapsed,
    status: fixture?.fixture?.status?.short,
    scoreHome: fixture?.goals?.home,
    scoreAway: fixture?.goals?.away,
  }));

  return JSON.stringify(fixtures);
};
