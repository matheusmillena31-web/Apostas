import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createSnapshotStore } from './snapshotStore.mjs';
import { createBacktestJobStore } from './backtestJobStore.mjs';

const envFiles = ['.env.local', '.env'];

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) continue;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3333);
const apiFootballBaseUrl = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
const apiFootballToken = process.env.API_FOOTBALL_TOKEN;
const allowedOrigin = process.env.BACKEND_ALLOWED_ORIGIN ?? '*';
const snapshotPath = resolve(process.cwd(), process.env.API_FOOTBALL_SNAPSHOT_PATH ?? 'server/storage/api-football-snapshots.jsonl');
const collectorStatePath = resolve(process.cwd(), process.env.API_FOOTBALL_COLLECTOR_STATE_PATH ?? 'server/storage/api-football-collector-state.json');
const backtestJobsPath = resolve(process.cwd(), process.env.BACKTEST_JOBS_PATH ?? 'server/storage/backtest-jobs.json');
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL !== 'false';
const snapshotStore = createSnapshotStore({
  snapshotPath,
  databaseUrl,
  databaseSsl,
  keepScoreOnly: process.env.SNAPSHOT_KEEP_SCORE_ONLY !== 'false',
  skipScoreOnlyDuplicates: process.env.SNAPSHOT_SKIP_SCORE_ONLY_DUPLICATES !== 'false',
  scoreOnlyMinIntervalMs: Number(process.env.SNAPSHOT_SCORE_ONLY_MIN_INTERVAL_MS ?? 600000),
});
const backtestJobStore = createBacktestJobStore({ filePath: backtestJobsPath, databaseUrl, databaseSsl });
const collectorEnabled = process.env.API_FOOTBALL_COLLECTOR_ENABLED !== 'false';
const collectorIntervalMs = Number(process.env.API_FOOTBALL_COLLECTOR_INTERVAL_MS ?? 60000);
const collectorMaxFixtures = Number(process.env.API_FOOTBALL_COLLECTOR_MAX_FIXTURES ?? 2);
const collectorRequestDelayMs = Number(process.env.API_FOOTBALL_COLLECTOR_REQUEST_DELAY_MS ?? 1200);
const collectorDailyRequestLimit = Number(process.env.API_FOOTBALL_COLLECTOR_DAILY_REQUEST_LIMIT ?? 7200);
const collectorHalftimeIntervalMs = Number(process.env.API_FOOTBALL_COLLECTOR_HALFTIME_INTERVAL_MS ?? 180000);
const collectorStatsEnabled = process.env.API_FOOTBALL_COLLECTOR_STATS_ENABLED !== 'false';
const collectorEventsEnabled = process.env.API_FOOTBALL_COLLECTOR_EVENTS_ENABLED !== 'false';
const collectorOddsEnabled = process.env.API_FOOTBALL_COLLECTOR_ODDS_ENABLED !== 'false';

const collectorState = {
  enabled: collectorEnabled,
  intervalMs: collectorIntervalMs,
  maxFixtures: collectorMaxFixtures,
  requestDelayMs: collectorRequestDelayMs,
  dailyRequestLimit: collectorDailyRequestLimit,
  halftimeIntervalMs: collectorHalftimeIntervalMs,
  requestDay: new Date().toISOString().slice(0, 10),
  requestsUsedToday: 0,
  requestsSkippedToday: 0,
  fixtureCursor: 0,
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  nextRunAt: null,
  lastError: null,
  lastRunSummary: null,
  totalRuns: 0,
  totalSnapshotsSaved: 0,
};

const lastHalftimeSnapshotByFixture = new Map();

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));

const getCollectorDay = () => new Date().toISOString().slice(0, 10);

const persistCollectorBudget = () => {
  if (databaseUrl) return;

  mkdirSync(dirname(collectorStatePath), { recursive: true });
  writeFileSync(
    collectorStatePath,
    JSON.stringify(
      {
        requestDay: collectorState.requestDay,
        requestsUsedToday: collectorState.requestsUsedToday,
        requestsSkippedToday: collectorState.requestsSkippedToday,
      },
      null,
      2,
    ),
    'utf8',
  );
};

const loadCollectorBudget = () => {
  if (databaseUrl) return;
  if (!existsSync(collectorStatePath)) return;

  try {
    const saved = JSON.parse(readFileSync(collectorStatePath, 'utf8'));
    if (saved.requestDay !== getCollectorDay()) return;

    collectorState.requestDay = saved.requestDay;
    collectorState.requestsUsedToday = Number(saved.requestsUsedToday ?? 0);
    collectorState.requestsSkippedToday = Number(saved.requestsSkippedToday ?? 0);
  } catch {
    // Ignore corrupted local collector state; the next save will replace it.
  }
};

loadCollectorBudget();

const resetCollectorBudgetIfNeeded = () => {
  const today = getCollectorDay();
  if (collectorState.requestDay === today) return;

  collectorState.requestDay = today;
  collectorState.requestsUsedToday = 0;
  collectorState.requestsSkippedToday = 0;
  persistCollectorBudget();
};

const reserveCollectorRequest = () => {
  resetCollectorBudgetIfNeeded();

  if (collectorState.requestsUsedToday >= collectorDailyRequestLimit) {
    collectorState.requestsSkippedToday += 1;
    persistCollectorBudget();
    throw new Error(`Orcamento diario do coletor atingido (${collectorDailyRequestLimit} requisicoes).`);
  }

  collectorState.requestsUsedToday += 1;
  persistCollectorBudget();
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  response.end(JSON.stringify(payload));
};

const readBody = (request) =>
  new Promise((resolveBody, reject) => {
    const chunks = [];

    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', reject);
  });

const readJsonBody = async (request) => {
  const body = await readBody(request);
  if (!body.length) return {};

  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new Error('JSON invalido no corpo da requisicao.');
  }
};

const getSnapshotCount = () => snapshotStore.getSnapshotCount();

const readRawSnapshots = () => snapshotStore.readRawSnapshots();

const getStorageStats = () => snapshotStore.getStorageStats();

const asArray = (value) => (Array.isArray(value) ? value : []);

const isHalftimeFixture = (fixture) => fixture?.fixture?.status?.short === 'HT';

const isPlayingFixture = (fixture) => ['1H', '2H'].includes(fixture?.fixture?.status?.short);

const shouldCaptureFixtureNow = (fixture, now = Date.now()) => {
  const fixtureId = fixture?.fixture?.id;
  if (!fixtureId) return false;
  if (isPlayingFixture(fixture)) {
    lastHalftimeSnapshotByFixture.delete(fixtureId);
    return true;
  }
  if (!isHalftimeFixture(fixture)) return true;

  const lastCapturedAt = lastHalftimeSnapshotByFixture.get(fixtureId) ?? 0;
  if (now - lastCapturedAt < collectorHalftimeIntervalMs) return false;

  lastHalftimeSnapshotByFixture.set(fixtureId, now);
  return true;
};

const filterFixturesForSnapshot = (fixtures, now = Date.now()) =>
  fixtures.filter((fixture) => shouldCaptureFixtureNow(fixture, now));

const getSnapshotFixtureId = (snapshot) => {
  const queryFixture = Number(snapshot?.query?.fixture);
  if (Number.isFinite(queryFixture) && queryFixture > 0) return queryFixture;

  const firstFixture = snapshot?.payload?.response?.[0]?.fixture?.id;
  return Number.isFinite(firstFixture) ? firstFixture : undefined;
};

const findNearestPayload = (records, capturedAt) => {
  if (!records.length) return [];

  const target = new Date(capturedAt).getTime();
  const afterWindowMs = collectorIntervalMs;
  const after = records
    .filter((record) => {
      const time = new Date(record.capturedAt).getTime();
      return time >= target && time <= target + afterWindowMs;
    })
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())[0];

  if (after) return asArray(after.payload?.response);

  const before = records
    .filter((record) => new Date(record.capturedAt).getTime() <= target)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];

  return asArray(before?.payload?.response);
};

const getEventAbsoluteMinute = (event) => Number(event?.time?.elapsed ?? 0) + Number(event?.time?.extra ?? 0);

const getSnapshotAbsoluteMinute = (fixture) =>
  Number(fixture?.fixture?.status?.elapsed ?? 0) + Number(fixture?.fixture?.status?.extra ?? 0);

const isEventInSnapshot = (event, fixture) => getEventAbsoluteMinute(event) <= getSnapshotAbsoluteMinute(fixture);

const eventMatches = (event, type, detailIncludes) => {
  const eventType = String(event?.type ?? '').toLowerCase();
  const detail = String(event?.detail ?? '').toLowerCase();
  return eventType === type.toLowerCase() && (!detailIncludes || detail.includes(detailIncludes.toLowerCase()));
};

const countTeamEvents = (events, teamId, type, detailIncludes) =>
  events.filter((event) => event?.team?.id === teamId && eventMatches(event, type, detailIncludes)).length;

const mergeFixtureEvents = (fixture, eventPayload) => {
  const merged = new Map();

  [...asArray(fixture?.events), ...asArray(eventPayload)].forEach((event) => {
    const key = [
      event?.time?.elapsed ?? '',
      event?.time?.extra ?? '',
      event?.team?.id ?? '',
      event?.type ?? '',
      event?.detail ?? '',
      event?.player?.id ?? event?.player?.name ?? '',
    ].join('|');
    merged.set(key, event);
  });

  return [...merged.values()]
    .filter((event) => isEventInSnapshot(event, fixture))
    .sort((a, b) => getEventAbsoluteMinute(a) - getEventAbsoluteMinute(b));
};

const buildDerivedStatistics = (fixture, events) => {
  const teams = [fixture?.teams?.home, fixture?.teams?.away].filter(Boolean);

  return teams.map((team) => {
    const goalsFromScore = team.id === fixture?.teams?.home?.id ? fixture?.goals?.home : fixture?.goals?.away;
    const goalsFromEvents = countTeamEvents(events, team.id, 'Goal');

    return {
      team,
      statistics: [
        { type: 'Gols', value: typeof goalsFromScore === 'number' ? goalsFromScore : goalsFromEvents },
        { type: 'Cartoes Amarelos', value: countTeamEvents(events, team.id, 'Card', 'Yellow') },
        { type: 'Cartoes Vermelhos', value: countTeamEvents(events, team.id, 'Card', 'Red') },
        { type: 'Substituicoes', value: countTeamEvents(events, team.id, 'subst') },
      ],
    };
  });
};

const mergeStatistics = (apiStatistics, derivedStatistics) => {
  if (!apiStatistics.length) return derivedStatistics;

  return apiStatistics.map((apiTeamStats) => {
    const derived = derivedStatistics.find((item) => item.team?.id === apiTeamStats.team?.id);
    const apiStats = asArray(apiTeamStats.statistics);
    const existingTypes = new Set(apiStats.map((stat) => String(stat.type).toLowerCase()));
    const missingDerivedStats = asArray(derived?.statistics).filter((stat) => !existingTypes.has(String(stat.type).toLowerCase()));

    return {
      ...apiTeamStats,
      statistics: [...apiStats, ...missingDerivedStats],
    };
  });
};

const buildReplayGroups = async () => {
  const snapshots = await readRawSnapshots();
  const groups = new Map();

  const ensureGroup = (fixtureId) => {
    if (!groups.has(fixtureId)) {
      groups.set(fixtureId, {
        fixtureId,
        fixtureSnapshots: [],
        statisticsSnapshots: [],
        eventSnapshots: [],
        oddsSnapshots: [],
      });
    }
    return groups.get(fixtureId);
  };

  snapshots.forEach((snapshot) => {
    if (snapshot.kind === 'fixtures-live') {
      asArray(snapshot.payload?.response).forEach((fixture) => {
        const fixtureId = fixture?.fixture?.id;
        if (!fixtureId) return;
        const group = ensureGroup(fixtureId);
        group.fixtureSnapshots.push({
          capturedAt: snapshot.capturedAt,
          quality: snapshot.quality ?? 'unknown',
          hasOdds: snapshot.hasOdds ?? false,
          hasStatistics: snapshot.hasStatistics ?? false,
          hasEvents: snapshot.hasEvents ?? false,
          hasScore: snapshot.hasScore ?? true,
          fixture,
        });
      });
      return;
    }

    const fixtureId = getSnapshotFixtureId(snapshot);
    if (!fixtureId) return;

    const group = ensureGroup(fixtureId);
    if (snapshot.kind === 'fixture-statistics') group.statisticsSnapshots.push(snapshot);
    if (snapshot.kind === 'fixture-events') group.eventSnapshots.push(snapshot);
    if (snapshot.kind === 'odds-live') group.oddsSnapshots.push(snapshot);
  });

  return [...groups.values()].filter((group) => group.fixtureSnapshots.length > 0);
};

const buildReplayGame = (group) => {
  const fixtureSnapshots = group.fixtureSnapshots.sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const first = fixtureSnapshots[0]?.fixture;
  const last = fixtureSnapshots[fixtureSnapshots.length - 1]?.fixture;

  const timeline = fixtureSnapshots.map((item) => {
    const apiStatistics = findNearestPayload(group.statisticsSnapshots, item.capturedAt);
    const events = mergeFixtureEvents(item.fixture, findNearestPayload(group.eventSnapshots, item.capturedAt));
    const derivedStatistics = buildDerivedStatistics(item.fixture, events);

    return {
      capturedAt: item.capturedAt,
      fixtureId: group.fixtureId,
      minute: item.fixture?.fixture?.status?.elapsed ?? 0,
      extra: item.fixture?.fixture?.status?.extra ?? null,
      status: item.fixture?.fixture?.status ?? null,
      score: item.fixture?.goals ?? { home: null, away: null },
      fixture: item.fixture,
      statistics: mergeStatistics(apiStatistics, derivedStatistics),
      events,
      odds: findNearestPayload(group.oddsSnapshots, item.capturedAt),
    };
  });

  const summary = {
    fixtureId: group.fixtureId,
    league: first?.league ?? last?.league ?? null,
    homeTeam: first?.teams?.home ?? last?.teams?.home ?? null,
    awayTeam: first?.teams?.away ?? last?.teams?.away ?? null,
    score: last?.goals ?? { home: null, away: null },
    status: last?.fixture?.status ?? null,
    firstCapturedAt: fixtureSnapshots[0]?.capturedAt,
    lastCapturedAt: fixtureSnapshots[fixtureSnapshots.length - 1]?.capturedAt,
    snapshotCount: timeline.length,
    minuteFrom: timeline[0]?.minute ?? 0,
    minuteTo: timeline[timeline.length - 1]?.minute ?? 0,
    quality: group.oddsSnapshots.length > 0 && group.statisticsSnapshots.length > 0 ? 'full' : group.oddsSnapshots.length > 0 || group.statisticsSnapshots.length > 0 || group.eventSnapshots.length > 0 ? 'partial' : 'score_only',
    hasOdds: group.oddsSnapshots.length > 0,
    hasStatistics: group.statisticsSnapshots.length > 0,
    hasEvents: group.eventSnapshots.length > 0,
    hasScore: true,
  };

  return { summary, timeline };
};

const getReplayGames = async ({ includeScoreOnly = false } = {}) => {
  const groups = await buildReplayGroups();
  return groups
    .map(buildReplayGame)
    .filter((game) => includeScoreOnly || game.summary.quality !== 'score_only')
    .sort((a, b) => new Date(b.summary.lastCapturedAt).getTime() - new Date(a.summary.lastCapturedAt).getTime());
};

const buildTargetUrl = (requestUrl) => {
  const incomingUrl = new URL(requestUrl, `http://localhost:${port}`);
  const apiPath = incomingUrl.pathname.replace(/^\/api\/football/, '') || '/';
  const targetUrl = new URL(`${apiFootballBaseUrl.replace(/\/$/, '')}${apiPath}`);
  incomingUrl.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));
  return { targetUrl, apiPath, incomingUrl };
};

const getSnapshotKind = (apiPath, searchParams) => {
  if (apiPath === '/fixtures' && searchParams.has('live')) return 'fixtures-live';
  if (apiPath === '/fixtures/statistics') return 'fixture-statistics';
  if (apiPath === '/fixtures/events') return 'fixture-events';
  if (apiPath === '/odds/live') return 'odds-live';
  if (apiPath === '/odds') return 'odds-pre-live';
  return undefined;
};

const persistSnapshot = async ({ kind, apiPath, query, payload }) => {
  if (!kind) return false;

  return snapshotStore.persistSnapshot({
    capturedAt: new Date().toISOString(),
    provider: 'api-football',
    kind,
    apiPath,
    query,
    payload,
  });
};

const buildApiUrl = (apiPath, query = {}) => {
  const targetUrl = new URL(`${apiFootballBaseUrl.replace(/\/$/, '')}${apiPath}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      targetUrl.searchParams.set(key, String(value));
    }
  });
  return targetUrl;
};

const hasApiErrors = (payload) => {
  const errors = payload?.errors;
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors).length > 0;
  return Boolean(errors);
};

const callApiFootball = async (apiPath, query = {}, { useCollectorBudget = false } = {}) => {
  const targetUrl = buildApiUrl(apiPath, query);
  let response;

  if (useCollectorBudget) reserveCollectorRequest();

  try {
    response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-apisports-key': apiFootballToken,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? `${error.message}${error.cause ? `: ${String(error.cause)}` : ''}` : String(error);
    throw new Error(`Falha de rede em ${apiPath}: ${detail}`);
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`API-FOOTBALL ${response.status} em ${apiPath}`);
  }

  if (hasApiErrors(payload)) {
    throw new Error(`API-FOOTBALL retornou erro em ${apiPath}: ${JSON.stringify(payload.errors)}`);
  }

  return { payload, query: Object.fromEntries(targetUrl.searchParams.entries()) };
};

const collectEndpoint = async (apiPath, query, kind) => {
  const { payload, query: normalizedQuery } = await callApiFootball(apiPath, query, { useCollectorBudget: true });
  const saved = await persistSnapshot({
    kind,
    apiPath,
    query: normalizedQuery,
    payload,
  });
  return { payload, saved };
};

const isRateLimitError = (error) =>
  error instanceof Error && (error.message.includes('429') || error.message.toLowerCase().includes('rate'));

const collectEndpointSafely = async (apiPath, query, kind) => {
  try {
    return { ok: true, ...(await collectEndpoint(apiPath, query, kind)) };
  } catch (error) {
    return {
      ok: false,
      rateLimited: isRateLimitError(error),
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const selectFixturesForCollector = (fixtures) => {
  const maxFixtures = Math.max(0, collectorMaxFixtures);
  if (fixtures.length <= maxFixtures) return fixtures;

  const selected = [];
  const startIndex = collectorState.fixtureCursor % fixtures.length;

  for (let offset = 0; offset < maxFixtures; offset += 1) {
    selected.push(fixtures[(startIndex + offset) % fixtures.length]);
  }

  collectorState.fixtureCursor = (startIndex + maxFixtures) % fixtures.length;
  return selected;
};

const runCollector = async ({ reason = 'scheduled' } = {}) => {
  if (!apiFootballToken) {
    collectorState.lastError = 'Token da API-FOOTBALL ausente.';
    return { ok: false, reason, error: collectorState.lastError, state: collectorState };
  }

  if (collectorState.running) {
    return { ok: true, reason, skipped: true, message: 'Coleta ja em andamento.', state: collectorState };
  }

  collectorState.running = true;
  collectorState.lastRunAt = new Date().toISOString();
  collectorState.totalRuns += 1;
  collectorState.lastError = null;

  const errors = [];
  let snapshotsSaved = 0;
  let fixtures = [];

  try {
    const live = await callApiFootball(
      '/fixtures',
      { live: 'all', timezone: 'America/Sao_Paulo' },
      { useCollectorBudget: true },
    );
    fixtures = Array.isArray(live.payload?.response) ? live.payload.response : [];
    const fixturesToSnapshot = filterFixturesForSnapshot(fixtures);

    if (fixturesToSnapshot.length > 0 || fixtures.length === 0) {
      const saved = await persistSnapshot({
        kind: 'fixtures-live',
        apiPath: '/fixtures',
        query: live.query,
        payload: {
          ...live.payload,
          response: fixturesToSnapshot,
          results: fixturesToSnapshot.length,
        },
      });
      snapshotsSaved += saved ? 1 : 0;
    }

    const fixturesToCollect = selectFixturesForCollector(fixturesToSnapshot);

    let rateLimited = false;

    for (const fixture of fixturesToCollect) {
      if (rateLimited) break;
      const fixtureId = fixture?.fixture?.id;
      if (!fixtureId) continue;

      const endpointJobs = [
        collectorStatsEnabled ? ['/fixtures/statistics', { fixture: fixtureId }, 'fixture-statistics'] : undefined,
        collectorEventsEnabled ? ['/fixtures/events', { fixture: fixtureId }, 'fixture-events'] : undefined,
        collectorOddsEnabled ? ['/odds/live', { fixture: fixtureId }, 'odds-live'] : undefined,
      ].filter(Boolean);

      for (const [apiPath, query, kind] of endpointJobs) {
        await wait(collectorRequestDelayMs);
        const result = await collectEndpointSafely(apiPath, query, kind);

        if (result.ok) {
          snapshotsSaved += result.saved ? 1 : 0;
          continue;
        }

        errors.push(result.error);
        if (result.rateLimited) {
          rateLimited = true;
          break;
        }
      }
    }

    collectorState.totalSnapshotsSaved += snapshotsSaved;
    collectorState.lastSuccessAt = new Date().toISOString();
    collectorState.lastRunSummary = {
      reason,
      fixturesFound: fixtures.length,
      fixturesCollected: fixturesToCollect.length,
      fixturesSnapshotted: fixturesToSnapshot.length,
      snapshotsSaved,
      halftimeIntervalMs: collectorHalftimeIntervalMs,
      requestsUsedToday: collectorState.requestsUsedToday,
      dailyRequestLimit: collectorDailyRequestLimit,
      errors,
    };

    return { ok: true, state: collectorState };
  } catch (error) {
    collectorState.lastError = error instanceof Error ? error.message : 'Erro desconhecido na coleta.';
    collectorState.lastRunSummary = {
      reason,
      fixturesFound: fixtures.length,
      fixturesCollected: 0,
      fixturesSnapshotted: 0,
      snapshotsSaved,
      halftimeIntervalMs: collectorHalftimeIntervalMs,
      requestsUsedToday: collectorState.requestsUsedToday,
      dailyRequestLimit: collectorDailyRequestLimit,
      errors: [collectorState.lastError],
    };
    return { ok: false, error: collectorState.lastError, state: collectorState };
  } finally {
    collectorState.running = false;
    collectorState.nextRunAt = collectorEnabled ? new Date(Date.now() + collectorIntervalMs).toISOString() : null;
  }
};

const startCollector = () => {
  if (!collectorEnabled || !apiFootballToken) return;

  collectorState.nextRunAt = new Date(Date.now() + 1500).toISOString();
  setTimeout(() => runCollector({ reason: 'startup' }), 1500);
  setInterval(() => runCollector({ reason: 'scheduled' }), collectorIntervalMs);
};

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const incomingUrl = new URL(request.url ?? '/', `http://localhost:${port}`);

  if (incomingUrl.pathname === '/health' || incomingUrl.pathname === '/api/football/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'api-football-proxy',
      provider: 'api-football',
      hasToken: Boolean(apiFootballToken),
      baseUrl: apiFootballBaseUrl,
      storageMode: snapshotStore.mode,
      backtestJobStorageMode: backtestJobStore.mode,
      snapshotPath,
      backtestJobsPath,
      collectorStatePath,
      snapshotCount: await getSnapshotCount(),
      storageStats: await getStorageStats(),
      collector: collectorState,
    });
    return;
  }

  if (incomingUrl.pathname === '/api/football/collector/status') {
    sendJson(response, 200, {
      ok: true,
      snapshotCount: await getSnapshotCount(),
      collector: collectorState,
    });
    return;
  }

  if (incomingUrl.pathname === '/api/football/collector/run') {
    const result = await runCollector({ reason: 'manual' });
    sendJson(response, result.ok ? 200 : 502, {
      ...result,
      snapshotCount: await getSnapshotCount(),
    });
    return;
  }

  if (incomingUrl.pathname === '/api/football/backtest/jobs') {
    try {
      if (request.method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.listJobs(),
        });
        return;
      }

      if (request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!body?.job?.id) {
          sendJson(response, 400, { ok: false, message: 'Chamado de backtest invalido.' });
          return;
        }

        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.upsertJob(body.job),
        });
        return;
      }

      if (request.method === 'DELETE') {
        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.deleteAllJobs(),
        });
        return;
      }
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: 'Nao foi possivel acessar os chamados de backtest.',
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  if (incomingUrl.pathname === '/api/football/backtest/jobs/batch') {
    try {
      if (request.method === 'POST') {
        const body = await readJsonBody(request);
        const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
        if (jobs.some((job) => !job?.id)) {
          sendJson(response, 400, { ok: false, message: 'Lote de chamados de backtest invalido.' });
          return;
        }

        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.upsertJobs(jobs),
        });
        return;
      }
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: 'Nao foi possivel criar o lote de chamados de backtest.',
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  const backtestJobMatch = incomingUrl.pathname.match(/^\/api\/football\/backtest\/jobs\/([^/]+)$/);
  if (backtestJobMatch) {
    const jobId = decodeURIComponent(backtestJobMatch[1]);

    try {
      if (request.method === 'PATCH') {
        const body = await readJsonBody(request);
        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.patchJob(jobId, body?.patch ?? {}),
        });
        return;
      }

      if (request.method === 'DELETE') {
        sendJson(response, 200, {
          ok: true,
          storageMode: backtestJobStore.mode,
          jobs: await backtestJobStore.deleteJob(jobId),
        });
        return;
      }
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        message: 'Nao foi possivel atualizar o chamado de backtest.',
        detail: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  if (incomingUrl.pathname === '/api/football/replay/games') {
    const includeScoreOnly = incomingUrl.searchParams.get('includeScoreOnly') === 'true';
    const games = await getReplayGames({ includeScoreOnly });
    sendJson(response, 200, {
      ok: true,
      games: games.map((game) => game.summary),
    });
    return;
  }

  const replayGameMatch = incomingUrl.pathname.match(/^\/api\/football\/replay\/games\/(\d+)$/);
  if (replayGameMatch) {
    const fixtureId = Number(replayGameMatch[1]);
    const games = await getReplayGames({ includeScoreOnly: true });
    const game = games.find((item) => item.summary.fixtureId === fixtureId);

    if (!game) {
      sendJson(response, 404, {
        ok: false,
        message: 'Partida nao encontrada na base historica.',
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      game,
    });
    return;
  }

  if (!incomingUrl.pathname.startsWith('/api/football')) {
    sendJson(response, 404, {
      message: 'Rota nao encontrada.',
    });
    return;
  }

  if (!apiFootballToken) {
    sendJson(response, 500, {
      code: 'API_FOOTBALL_TOKEN_MISSING',
      message: 'Configure API_FOOTBALL_TOKEN no backend.',
    });
    return;
  }

  try {
    const body = ['GET', 'HEAD'].includes(request.method ?? '') ? undefined : await readBody(request);
    const { targetUrl, apiPath } = buildTargetUrl(request.url ?? '/');
    const targetResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'x-apisports-key': apiFootballToken,
        ...(request.headers['content-type'] ? { 'Content-Type': request.headers['content-type'] } : {}),
      },
      body,
    });

    const contentType = targetResponse.headers.get('content-type') ?? 'application/json; charset=utf-8';
    const responseBody = Buffer.from(await targetResponse.arrayBuffer());

    if (request.method === 'GET' && targetResponse.ok && contentType.includes('application/json')) {
      const payload = JSON.parse(responseBody.toString('utf8'));
      await persistSnapshot({
        kind: getSnapshotKind(apiPath, targetUrl.searchParams),
        apiPath,
        query: Object.fromEntries(targetUrl.searchParams.entries()),
        payload,
      });
    }

    response.writeHead(targetResponse.status, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    response.end(responseBody);
  } catch (error) {
    sendJson(response, 502, {
      code: 'API_FOOTBALL_PROXY_ERROR',
      message: 'Nao foi possivel consultar a API-FOOTBALL.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

server.listen(port, () => {
  console.log(`API-FOOTBALL proxy running at http://localhost:${port}`);
  startCollector();
});
