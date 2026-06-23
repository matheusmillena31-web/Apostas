# Apostas

Aplicacao React/Vite para simulacao de trading esportivo com backend Node para consultar a API-Football e gravar snapshots de replay.

## Desenvolvimento local

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

## Deploy: Vercel somente para o site

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

Configure as variaveis no host do backend:

```env
API_FOOTBALL_TOKEN=sua_chave_da_api_football
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_SNAPSHOT_PATH=server/storage/api-football-snapshots.jsonl
API_FOOTBALL_COLLECTOR_STATE_PATH=server/storage/api-football-collector-state.json
API_FOOTBALL_COLLECTOR_ENABLED=true
API_FOOTBALL_COLLECTOR_INTERVAL_MS=90000
API_FOOTBALL_COLLECTOR_MAX_FIXTURES=2
API_FOOTBALL_COLLECTOR_REQUEST_DELAY_MS=1200
API_FOOTBALL_COLLECTOR_DAILY_REQUEST_LIMIT=7200
API_FOOTBALL_COLLECTOR_STATS_ENABLED=true
API_FOOTBALL_COLLECTOR_EVENTS_ENABLED=true
API_FOOTBALL_COLLECTOR_ODDS_ENABLED=true
BACKEND_ALLOWED_ORIGIN=https://seu-site.vercel.app
BACKEND_PORT=3333
```

Use uma chave nova da API-Football se a chave anterior ja foi compartilhada em conversas, prints ou logs.
