import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { classifySnapshotQuality, getScoreOnlySignature, summarizeScoreOnlyPayload } from './snapshotQuality.mjs';

const { Pool } = pg;

const createSnapshot = ({ capturedAt = new Date().toISOString(), provider = 'api-football', kind, apiPath, query, payload }) => {
  const base = {
    capturedAt,
    provider,
    kind,
    apiPath,
    query: query ?? {},
    payload,
  };
  const metadata = classifySnapshotQuality(base);

  return {
    ...base,
    ...metadata,
    payload: metadata.quality === 'score_only' ? summarizeScoreOnlyPayload(payload) : payload,
  };
};

const isUsableDatabaseUrl = (value) =>
  typeof value === 'string' &&
  /^postgres(?:ql)?:\/\//i.test(value) &&
  !value.includes('usuario:senha@host') &&
  !value.includes('user:password@host');

export const createSnapshotStore = ({
  snapshotPath,
  databaseUrl,
  databaseSsl = true,
  keepScoreOnly = true,
  skipScoreOnlyDuplicates = true,
  scoreOnlyMinIntervalMs = 600000,
}) => {
  const pool = isUsableDatabaseUrl(databaseUrl)
    ? new Pool({
        connectionString: databaseUrl,
        ssl: databaseSsl ? { rejectUnauthorized: false } : false,
      })
    : null;

  let readyPromise;
  const lastScoreOnlyBySignature = new Map();

  const ensureDatabase = async () => {
    if (!pool) return;
    if (readyPromise) return readyPromise;

    readyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS raw_api_snapshots (
        id BIGSERIAL PRIMARY KEY,
        captured_at TIMESTAMPTZ NOT NULL,
        provider TEXT NOT NULL,
        kind TEXT NOT NULL,
        api_path TEXT NOT NULL,
        query JSONB NOT NULL DEFAULT '{}'::jsonb,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS quality TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS fixture_id BIGINT;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS league_id BIGINT;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS league_name TEXT;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS has_odds BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS has_statistics BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS has_events BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS has_score BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE raw_api_snapshots ADD COLUMN IF NOT EXISTS payload_size INTEGER NOT NULL DEFAULT 0;

      CREATE UNIQUE INDEX IF NOT EXISTS raw_api_snapshots_dedupe_idx
        ON raw_api_snapshots (
          captured_at,
          provider,
          kind,
          api_path,
          md5(query::text),
          md5(payload::text)
        );

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_kind_time_idx
        ON raw_api_snapshots (kind, captured_at DESC);

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_fixture_query_idx
        ON raw_api_snapshots ((query->>'fixture'), captured_at DESC);

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_fixture_time_idx
        ON raw_api_snapshots (fixture_id, captured_at DESC);

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_quality_time_idx
        ON raw_api_snapshots (quality, captured_at DESC);

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_league_time_idx
        ON raw_api_snapshots (league_id, captured_at DESC);

      CREATE INDEX IF NOT EXISTS raw_api_snapshots_data_flags_time_idx
        ON raw_api_snapshots (has_odds, has_statistics, captured_at DESC);
    `);

    return readyPromise;
  };

  const persistToDatabase = async (snapshot) => {
    await ensureDatabase();
    await pool.query(
      `
        INSERT INTO raw_api_snapshots (
          captured_at,
          provider,
          kind,
          api_path,
          query,
          payload,
          quality,
          fixture_id,
          league_id,
          league_name,
          has_odds,
          has_statistics,
          has_events,
          has_score,
          payload_size
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT DO NOTHING
      `,
      [
        snapshot.capturedAt,
        snapshot.provider,
        snapshot.kind,
        snapshot.apiPath,
        JSON.stringify(snapshot.query ?? {}),
        JSON.stringify(snapshot.payload ?? null),
        snapshot.quality,
        snapshot.fixtureId ?? null,
        snapshot.leagueId ?? null,
        snapshot.leagueName ?? null,
        snapshot.hasOdds,
        snapshot.hasStatistics,
        snapshot.hasEvents,
        snapshot.hasScore,
        snapshot.payloadSize ?? 0,
      ],
    );
  };

  const persistToFile = async (snapshot) => {
    await mkdir(dirname(snapshotPath), { recursive: true });
    await appendFile(snapshotPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
  };

  const persistSnapshot = async (data) => {
    if (!data.kind) return false;
    const snapshot = createSnapshot(data);

    if (snapshot.quality === 'empty') return false;
    if (snapshot.quality === 'score_only' && !keepScoreOnly) return false;

    if (snapshot.quality === 'score_only' && skipScoreOnlyDuplicates) {
      const signature = getScoreOnlySignature(snapshot);
      const previous = lastScoreOnlyBySignature.get(signature);
      const capturedAtMs = new Date(snapshot.capturedAt).getTime();
      if (previous && capturedAtMs - previous < scoreOnlyMinIntervalMs) return false;
      lastScoreOnlyBySignature.set(signature, capturedAtMs);
    }

    if (pool) {
      await persistToDatabase(snapshot);
      return true;
    }

    await persistToFile(snapshot);
    return true;
  };

  const getSnapshotCount = async () => {
    if (pool) {
      await ensureDatabase();
      const result = await pool.query('SELECT COUNT(*)::int AS count FROM raw_api_snapshots');
      return result.rows[0]?.count ?? 0;
    }

    if (!existsSync(snapshotPath)) return 0;
    const content = await readFile(snapshotPath, 'utf8');
    return content.trim() ? content.trim().split(/\r?\n/).length : 0;
  };

  const withQuality = (snapshot) => {
    if (snapshot.quality) return snapshot;
    return {
      ...snapshot,
      ...classifySnapshotQuality(snapshot),
    };
  };

  const readRawSnapshots = async ({ limit, fixtureId, quality, since, until } = {}) => {
    if (pool) {
      await ensureDatabase();
      const clauses = [];
      const values = [];
      const addClause = (clause, value) => {
        values.push(value);
        clauses.push(clause.replace('?', `$${values.length}`));
      };
      if (fixtureId) addClause('fixture_id = ?', Number(fixtureId));
      if (quality) addClause('quality = ?', String(quality));
      if (since) addClause('captured_at >= ?', since);
      if (until) addClause('captured_at <= ?', until);

      const result = await pool.query(`
        SELECT
          captured_at AS "capturedAt",
          provider,
          kind,
          api_path AS "apiPath",
          query,
          payload,
          quality,
          fixture_id AS "fixtureId",
          league_id AS "leagueId",
          league_name AS "leagueName",
          has_odds AS "hasOdds",
          has_statistics AS "hasStatistics",
          has_events AS "hasEvents",
          has_score AS "hasScore",
          payload_size AS "payloadSize"
        FROM raw_api_snapshots
        ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
        ORDER BY captured_at ASC, id ASC
        ${limit ? `LIMIT ${Number(limit)}` : ''}
      `, values);

      return result.rows.map((row) => ({
        ...row,
        capturedAt: row.capturedAt instanceof Date ? row.capturedAt.toISOString() : row.capturedAt,
      }));
    }

    if (!existsSync(snapshotPath)) return [];

    const content = await readFile(snapshotPath, 'utf8');
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try {
          return withQuality(JSON.parse(line));
        } catch {
          return undefined;
        }
      })
      .filter(Boolean)
      .filter((snapshot) => !fixtureId || snapshot.fixtureId === Number(fixtureId))
      .filter((snapshot) => !quality || snapshot.quality === quality)
      .filter((snapshot) => !since || new Date(snapshot.capturedAt).getTime() >= new Date(since).getTime())
      .filter((snapshot) => !until || new Date(snapshot.capturedAt).getTime() <= new Date(until).getTime())
      .slice(0, limit ? Number(limit) : undefined);
  };

  const getSnapshotCountByQuality = async () => {
    if (pool) {
      await ensureDatabase();
      const result = await pool.query(`
        SELECT quality, COUNT(*)::int AS count
        FROM raw_api_snapshots
        GROUP BY quality
      `);
      return result.rows.reduce((acc, row) => ({ ...acc, [row.quality ?? 'unknown']: row.count }), {});
    }

    const snapshots = await readRawSnapshots();
    return snapshots.reduce((acc, snapshot) => {
      const key = snapshot.quality ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  };

  const getStorageStats = async () => {
    const byQuality = await getSnapshotCountByQuality();

    if (pool) {
      await ensureDatabase();
      const result = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE has_odds)::int AS "withOdds",
          COUNT(*) FILTER (WHERE has_statistics)::int AS "withStatistics",
          COALESCE(SUM(payload_size), 0)::bigint AS "payloadBytes"
        FROM raw_api_snapshots
      `);
      return {
        mode: 'postgres',
        total: result.rows[0]?.total ?? 0,
        byQuality,
        withOdds: result.rows[0]?.withOdds ?? 0,
        withStatistics: result.rows[0]?.withStatistics ?? 0,
        payloadBytes: Number(result.rows[0]?.payloadBytes ?? 0),
        path: snapshotPath,
      };
    }

    const snapshots = await readRawSnapshots();
    return {
      mode: 'jsonl',
      total: snapshots.length,
      byQuality,
      withOdds: snapshots.filter((snapshot) => snapshot.hasOdds).length,
      withStatistics: snapshots.filter((snapshot) => snapshot.hasStatistics).length,
      payloadBytes: snapshots.reduce((sum, snapshot) => sum + (snapshot.payloadSize ?? 0), 0),
      path: snapshotPath,
    };
  };

  const close = async () => {
    if (pool) await pool.end();
  };

  return {
    mode: pool ? 'postgres' : 'jsonl',
    isDatabaseEnabled: Boolean(pool),
    ensureDatabase,
    persistSnapshot,
    getSnapshotCount,
    getSnapshotCountByQuality,
    getStorageStats,
    readRawSnapshots,
    readReplaySnapshotsByFixture: (fixtureId) => readRawSnapshots({ fixtureId }),
    readUsableSnapshotsForBacktest: (filters = {}) => readRawSnapshots(filters),
    close,
  };
};
