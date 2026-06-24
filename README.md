# Apostas

Aplicacao React/Vite para simulacao de trading esportivo com backend Node para consultar a API-Football e gravar snapshots de replay.

## Desenvolvimento local

Este e o modo prioritario do projeto no momento. O backend local grava e le os snapshots em:

```text
server/storage/api-football-snapshots.jsonl
```

Nao configure `DATABASE_URL` para rodar localmente em modo arquivo.

1. Instale as dependencias:

```bash
npm install
```

2. Crie `.env.local` a partir de `.env.example` e configure `API_FOOTBALL_TOKEN`.

3. Rode frontend e backend juntos:

```bash
npm run dev
```

O frontend usa `/api/football` localmente e o Vite redireciona para o backend em `http://localhost:3333`.

Para conferir se o backend esta vivo:

```text
http://localhost:3333/api/football/health
```

## Deploy: Vercel somente para o site

Deploy pausado por enquanto. As instrucoes abaixo ficam como referencia futura.

O Vercel deve hospedar apenas o frontend estatico. O backend atual precisa continuar em um host Node persistente, como Render, Railway, Fly.io ou VPS, porque ele usa um servidor continuo e grava os snapshots em `server/storage`.

### Variavel no Vercel

Configure no projeto do Vercel:

```env
VITE_API_FOOTBALL_PROXY_URL=https://seu-backend.com/api/football
```

Nao coloque `API_FOOTBALL_TOKEN` no Vercel com prefixo `VITE_`. Variaveis `VITE_` ficam visiveis no navegador.

### Configuracao do projeto no Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

O arquivo `vercel.json` ja deixa esses valores definidos.

## Backend atual fora do Vercel

Hospede o backend Node com estes comandos:

```bash
npm install
node server/apiFootballProxy.mjs
```

No Render, crie um Web Service apontando para este repositorio:

- Build command: `npm install`
- Start command: `node server/apiFootballProxy.mjs`
- Persistent Disk: recomendado, montado em `/var/data`

Configure as variaveis no Render:

```env
API_FOOTBALL_TOKEN=sua_chave_da_api_football
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
DATABASE_SSL=true
API_FOOTBALL_COLLECTOR_ENABLED=true
API_FOOTBALL_COLLECTOR_INTERVAL_MS=90000
API_FOOTBALL_COLLECTOR_MAX_FIXTURES=2
API_FOOTBALL_COLLECTOR_REQUEST_DELAY_MS=1200
API_FOOTBALL_COLLECTOR_DAILY_REQUEST_LIMIT=7200
API_FOOTBALL_COLLECTOR_HALFTIME_INTERVAL_MS=240000
API_FOOTBALL_COLLECTOR_STATS_ENABLED=true
API_FOOTBALL_COLLECTOR_EVENTS_ENABLED=true
API_FOOTBALL_COLLECTOR_ODDS_ENABLED=true
SNAPSHOT_KEEP_SCORE_ONLY=true
SNAPSHOT_SKIP_SCORE_ONLY_DUPLICATES=true
SNAPSHOT_SCORE_ONLY_MIN_INTERVAL_MS=600000
BACKEND_ALLOWED_ORIGIN=https://seu-site.vercel.app
```

O Render fornece a porta automaticamente pela variavel `PORT`, entao nao precisa configurar `BACKEND_PORT` la. Use `BACKEND_PORT=3333` apenas localmente ou em hospedagens que nao fornecem `PORT`.

Use uma chave nova da API-Football se a chave anterior ja foi compartilhada em conversas, prints ou logs.

Por padrao, jogos com apenas placar continuam sendo guardados, mas de forma resumida e sem repetir snapshots identicos em intervalos curtos. Isso preserva historico simples de resultado final sem ocupar o mesmo espaco de jogos com odds e estatisticas.

### Banco historico PostgreSQL

O backend usa PostgreSQL quando `DATABASE_URL` esta configurada. Sem essa variavel, ele volta ao modo local e grava snapshots em JSONL.

No Render, crie um banco em **New > Postgres** e use a **Internal Database URL** no Web Service quando o banco e o backend estiverem na mesma conta/regiao. Se usar Supabase, Neon ou outro provedor, use a connection string PostgreSQL fornecida por ele.

O backend cria automaticamente a tabela `raw_api_snapshots` e os indices necessarios na primeira execucao.

Para importar o arquivo JSONL local para o banco, configure `DATABASE_URL` em `.env.local` e rode:

```bash
npm run db:import-snapshots
```

Se quiser importar outro arquivo, informe:

```env
SNAPSHOT_IMPORT_PATH=caminho/para/api-football-snapshots.jsonl
```
