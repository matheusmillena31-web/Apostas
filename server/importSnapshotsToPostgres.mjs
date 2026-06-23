import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { createSnapshotStore } from './snapshotStore.mjs';

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

const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL !== 'false';
const snapshotPath = resolve(
  process.cwd(),
  process.env.SNAPSHOT_IMPORT_PATH ??
    process.env.API_FOOTBALL_SNAPSHOT_PATH ??
    'server/storage/api-football-snapshots.jsonl',
);

if (!databaseUrl || databaseUrl.includes('usuario:senha@host') || databaseUrl.includes('user:password@host')) {
  console.error('DATABASE_URL ausente. Configure a URL do PostgreSQL antes de importar.');
  process.exit(1);
}

if (!existsSync(snapshotPath)) {
  console.error(`Arquivo JSONL nao encontrado: ${snapshotPath}`);
  process.exit(1);
}

const store = createSnapshotStore({
  snapshotPath,
  databaseUrl,
  databaseSsl,
});

let imported = 0;
let invalid = 0;
let processed = 0;

try {
  await store.ensureDatabase();

  const reader = createInterface({
    input: createReadStream(snapshotPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of reader) {
    if (!line.trim()) continue;
    processed += 1;

    try {
      const snapshot = JSON.parse(line);
      await store.persistSnapshot({
        capturedAt: snapshot.capturedAt,
        provider: snapshot.provider ?? 'api-football',
        kind: snapshot.kind,
        apiPath: snapshot.apiPath,
        query: snapshot.query ?? {},
        payload: snapshot.payload,
      });
      imported += 1;
    } catch {
      invalid += 1;
    }

    if (processed % 1000 === 0) {
      console.log(`Processados ${processed} snapshots...`);
    }
  }

  const total = await store.getSnapshotCount();
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: snapshotPath,
        processed,
        imported,
        invalid,
        databaseSnapshotCount: total,
      },
      null,
      2,
    ),
  );
} finally {
  await store.close();
}
