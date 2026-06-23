import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const createSnapshot = ({ capturedAt = new Date().toISOString(), provider = 'api-football', kind, apiPath, query, payload }) => ({
  capturedAt,
  provider,
  kind,
  apiPath,
  query: query ?? {},
  payload,
});

const isUsableDatabaseUrl = (value) =>
  typeof value === 'string' &&
  /^postgres(?:ql)?:\/\//i.test(value) &&
  !value.includes('usuario:senha@host') &&
  !value.includes('user:password@host');

export const createSnapshotStore = ({ snapshotPath, databaseUrl, databaseSsl = true }) => {
  const pool = isUsableDatabaseUrl(databaseUrl)
    ? new Pool({
        connectionString: databaseUrl,
        ssl: databaseSsl ? { rejectUnauthorized: false } : false,
      })
    : null;

  let readyPromise;

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
    `);

    return readyPromise;
  };

  const persistToDatabase = async (snapshot) => {
    await ensureDatabase();
    await pool.query(
      `
        INSERT INTO raw_api_snapshots (captured_at, provider, kind, api_path, query, payload)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
        ON CONFLICT DO NOTHING
      `,
      [
        snapshot.capturedAt,
        snapshot.provider,
        snapshot.kind,
        snapshot.apiPath,
        JSON.stringify(snapshot.query ?? {}),
        JSON.stringify(snapshot.payload ?? null),
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

  const readRawSnapshots = async () => {
    if (pool) {
      await ensureDatabase();
      const result = await pool.query(`
        SELECT
          captured_at AS "capturedAt",
          provider,
          kind,
          api_path AS "apiPath",
          query,
          payload
        FROM raw_api_snapshots
        ORDER BY captured_at ASC, id ASC
      `);

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
          return JSON.parse(line);
        } catch {
          return undefined;
        }
      })
      .filter(Boolean);
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
    readRawSnapshots,
    close,
  };
};
