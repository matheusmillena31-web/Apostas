# Plano de armazenamento escalavel para odds e replay

## Estado atual

O backend grava snapshots em JSONL para iniciar a base historica rapidamente:

```text
server/storage/api-football-snapshots.jsonl
```

Cada linha contem:

- `capturedAt`: horario exato da captura.
- `provider`: `api-football`.
- `kind`: tipo do snapshot, como `fixtures-live`, `fixture-statistics`, `fixture-events` ou `odds-live`.
- `apiPath`: endpoint consultado.
- `query`: parametros enviados.
- `payload`: resposta bruta da API.

Esse formato e bom para comecar e auditar, mas nao e ideal para meses de dados, consultas rapidas, backtests e replay.

## Banco recomendado

Use PostgreSQL com TimescaleDB quando a coleta for ficar ligada todos os dias.

Motivo:

- suporta JSONB para guardar payload bruto;
- suporta tabelas relacionais para consultas rapidas;
- TimescaleDB ajuda em dados temporais minuto a minuto;
- e simples migrar depois para analytics, dashboards e backtests.

## Docker local sugerido

```bash
docker run --name apostas-timescale \
  -e POSTGRES_PASSWORD=apostas \
  -e POSTGRES_USER=apostas \
  -e POSTGRES_DB=apostas \
  -p 5432:5432 \
  -d timescale/timescaledb:latest-pg16
```

## Esquema inicial

```sql
CREATE TABLE raw_api_snapshots (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  api_path TEXT NOT NULL,
  query JSONB NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX raw_api_snapshots_kind_time_idx
  ON raw_api_snapshots (kind, captured_at DESC);

CREATE TABLE fixture_snapshots (
  captured_at TIMESTAMPTZ NOT NULL,
  fixture_id BIGINT NOT NULL,
  league_id BIGINT,
  season INT,
  status_short TEXT,
  elapsed INT,
  extra INT,
  home_team_id BIGINT,
  away_team_id BIGINT,
  home_goals INT,
  away_goals INT,
  payload JSONB NOT NULL,
  PRIMARY KEY (fixture_id, captured_at)
);

CREATE TABLE odds_snapshots (
  captured_at TIMESTAMPTZ NOT NULL,
  fixture_id BIGINT NOT NULL,
  bookmaker_id BIGINT,
  bookmaker_name TEXT,
  market_id BIGINT,
  market_name TEXT,
  selection TEXT,
  odd NUMERIC(10, 4),
  suspended BOOLEAN,
  payload JSONB NOT NULL
);

CREATE INDEX odds_snapshots_fixture_time_idx
  ON odds_snapshots (fixture_id, captured_at DESC);

CREATE INDEX odds_snapshots_market_time_idx
  ON odds_snapshots (market_name, captured_at DESC);

CREATE TABLE statistic_snapshots (
  captured_at TIMESTAMPTZ NOT NULL,
  fixture_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  stat_type TEXT NOT NULL,
  stat_value TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX statistic_snapshots_fixture_time_idx
  ON statistic_snapshots (fixture_id, captured_at DESC);

CREATE TABLE fixture_events (
  captured_at TIMESTAMPTZ NOT NULL,
  fixture_id BIGINT NOT NULL,
  elapsed INT,
  extra INT,
  team_id BIGINT,
  player_id BIGINT,
  event_type TEXT,
  detail TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX fixture_events_fixture_time_idx
  ON fixture_events (fixture_id, elapsed, extra);
```

## Fluxo recomendado

1. Mantenha o JSONL como backup bruto.
2. Crie um gravador PostgreSQL no backend.
3. A cada snapshot salvo, grave tambem:
   - a resposta bruta em `raw_api_snapshots`;
   - dados normalizados em `fixture_snapshots`, `odds_snapshots`, `statistic_snapshots` e `fixture_events`.
4. Use `fixture_id + captured_at` como base para replay.
5. Use `odds_snapshots` filtrando por `market_name`, `selection` e intervalo de tempo para backtests.

## Operacao 24/7

Para base historica confiavel:

- rode o backend em VPS ou servidor sempre ligado;
- use PM2, Docker Compose ou servico do Windows;
- monitore erros `429`;
- ajuste `API_FOOTBALL_COLLECTOR_INTERVAL_MS` e `API_FOOTBALL_COLLECTOR_MAX_FIXTURES` conforme o limite do plano;
- faca backup diario do PostgreSQL.

## Configuracao atual do coletor

```text
API_FOOTBALL_COLLECTOR_ENABLED=true
API_FOOTBALL_COLLECTOR_INTERVAL_MS=90000
API_FOOTBALL_COLLECTOR_MAX_FIXTURES=2
API_FOOTBALL_COLLECTOR_REQUEST_DELAY_MS=1200
API_FOOTBALL_COLLECTOR_DAILY_REQUEST_LIMIT=7200
```

Com 2 fixtures por ciclo e intervalo de 90 segundos, o pior caso fica perto de 6720 requisicoes/dia:

```text
1 chamada fixtures live + (2 fixtures x 3 chamadas de detalhe) = 7 chamadas/ciclo
960 ciclos/dia x 7 = 6720 chamadas/dia
```

O limite de seguranca fica em 7200 chamadas/dia para deixar margem dentro do plano de 7500. O coletor usa rodizio de fixtures; quando houver mais jogos ao vivo do que o limite por ciclo, ele alterna os jogos coletados nos ciclos seguintes.

Se quiser recalcular:

```text
chamadas_por_dia = (86400000 / intervalo_ms) * (1 + fixtures_por_ciclo * endpoints_por_fixture)
```
