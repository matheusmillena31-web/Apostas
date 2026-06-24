import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const isUsableDatabaseUrl = (value) =>
  typeof value === 'string' &&
  /^postgres(?:ql)?:\/\//i.test(value) &&
  !value.includes('usuario:senha@host') &&
  !value.includes('user:password@host');

const sortJobs = (jobs) =>
  [...jobs].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

export const createBacktestJobStore = ({ filePath, databaseUrl, databaseSsl = true }) => {
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
      CREATE TABLE IF NOT EXISTS backtest_jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS backtest_jobs_status_idx
        ON backtest_jobs (status);

      CREATE INDEX IF NOT EXISTS backtest_jobs_created_at_idx
        ON backtest_jobs (created_at DESC);
    `);

    return readyPromise;
  };

  const readFileJobs = async () => {
    if (!existsSync(filePath)) return [];

    const content = await readFile(filePath, 'utf8');
    if (!content.trim()) return [];

    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeFileJobs = async (jobs) => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(sortJobs(jobs), null, 2), 'utf8');
  };

  const listJobs = async () => {
    if (pool) {
      await ensureDatabase();
      const result = await pool.query(`
        SELECT payload
        FROM backtest_jobs
        ORDER BY created_at DESC
      `);
      return result.rows.map((row) => row.payload);
    }

    return sortJobs(await readFileJobs());
  };

  const upsertJob = async (job) => {
    const normalized = {
      ...job,
      status: job.status ?? 'pending',
      createdAt: job.createdAt ?? new Date().toISOString(),
    };

    if (pool) {
      await ensureDatabase();
      await pool.query(
        `
          INSERT INTO backtest_jobs (id, status, payload, created_at, updated_at)
          VALUES ($1, $2, $3::jsonb, $4, now())
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            payload = EXCLUDED.payload,
            updated_at = now()
        `,
        [normalized.id, normalized.status, JSON.stringify(normalized), normalized.createdAt],
      );
      return sortJobs(await listJobs());
    }

    const jobs = await readFileJobs();
    const next = [normalized, ...jobs.filter((item) => item.id !== normalized.id)];
    await writeFileJobs(next);
    return sortJobs(next);
  };

  const patchJob = async (jobId, patch) => {
    const jobs = await listJobs();
    const current = jobs.find((job) => job.id === jobId);
    if (!current) return sortJobs(jobs);
    return upsertJob({ ...current, ...patch });
  };

  const deleteJob = async (jobId) => {
    if (pool) {
      await ensureDatabase();
      await pool.query('DELETE FROM backtest_jobs WHERE id = $1', [jobId]);
      return sortJobs(await listJobs());
    }

    const next = (await readFileJobs()).filter((job) => job.id !== jobId);
    await writeFileJobs(next);
    return sortJobs(next);
  };

  const deleteAllJobs = async () => {
    if (pool) {
      await ensureDatabase();
      await pool.query('DELETE FROM backtest_jobs');
      return [];
    }

    await writeFileJobs([]);
    return [];
  };

  return {
    mode: pool ? 'postgres' : 'json-file',
    isDatabaseEnabled: Boolean(pool),
    ensureDatabase,
    listJobs,
    upsertJob,
    patchJob,
    deleteJob,
    deleteAllJobs,
  };
};
