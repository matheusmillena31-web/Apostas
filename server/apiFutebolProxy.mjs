import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

const port = Number(process.env.BACKEND_PORT ?? 3333);
const apiFutebolBaseUrl = process.env.API_FUTEBOL_BASE_URL ?? 'https://api.api-futebol.com.br/v1';
const apiFutebolToken = process.env.API_FUTEBOL_TOKEN;
const allowedOrigin = process.env.BACKEND_ALLOWED_ORIGIN ?? '*';

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

const buildTargetUrl = (requestUrl) => {
  const incomingUrl = new URL(requestUrl, `http://localhost:${port}`);
  const apiPath = incomingUrl.pathname.replace(/^\/api\/futebol/, '') || '/';
  const targetUrl = new URL(`${apiFutebolBaseUrl.replace(/\/$/, '')}${apiPath}`);
  incomingUrl.searchParams.forEach((value, key) => targetUrl.searchParams.append(key, value));
  return targetUrl;
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

  if (incomingUrl.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'api-futebol-proxy',
      hasToken: Boolean(apiFutebolToken),
    });
    return;
  }

  if (!incomingUrl.pathname.startsWith('/api/futebol')) {
    sendJson(response, 404, {
      message: 'Rota nao encontrada.',
    });
    return;
  }

  if (!apiFutebolToken) {
    sendJson(response, 500, {
      code: 'API_FUTEBOL_TOKEN_MISSING',
      message: 'Configure API_FUTEBOL_TOKEN no backend.',
    });
    return;
  }

  try {
    const body = ['GET', 'HEAD'].includes(request.method ?? '') ? undefined : await readBody(request);
    const targetResponse = await fetch(buildTargetUrl(request.url ?? '/'), {
      method: request.method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiFutebolToken}`,
        ...(request.headers['content-type'] ? { 'Content-Type': request.headers['content-type'] } : {}),
      },
      body,
    });

    const responseBody = Buffer.from(await targetResponse.arrayBuffer());
    response.writeHead(targetResponse.status, {
      'Content-Type': targetResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    });
    response.end(responseBody);
  } catch (error) {
    sendJson(response, 502, {
      code: 'API_FUTEBOL_PROXY_ERROR',
      message: 'Nao foi possivel consultar a API Futebol.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

server.listen(port, () => {
  console.log(`API Futebol proxy running at http://localhost:${port}`);
});
