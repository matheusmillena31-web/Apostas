const baseUrl = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

function getToken() {
  return process.env.API_FOOTBALL_TOKEN || process.env.API_FOOTBALL_KEY || process.env.API_FUTEBOL_KEY;
}

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  const token = getToken();

  if (!token) {
    response.status(500).json({
      ok: false,
      code: 'API_TOKEN_MISSING',
      message: 'A variavel API_FOOTBALL_KEY nao foi encontrada no Vercel.',
    });
    return;
  }

  const pathParam = request.query.path;
  const parts = Array.isArray(pathParam) ? pathParam : [pathParam].filter(Boolean);
  const route = parts.join('/') || 'fixtures';
  const targetUrl = new URL(baseUrl.replace(/\/$/, '') + '/' + route.replace(/^\/+/, ''));

  Object.entries(request.query).forEach(([key, value]) => {
    if (key === 'path') return;
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, String(item)));
      return;
    }
    if (value !== undefined) targetUrl.searchParams.set(key, String(value));
  });

  try {
    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'x-apisports-key': token.trim(),
      },
    });

    const contentType = apiResponse.headers.get('content-type') || 'application/json; charset=utf-8';
    const body = await apiResponse.text();
    response.status(apiResponse.status).setHeader('Content-Type', contentType).send(body);
  } catch (error) {
    response.status(502).json({
      ok: false,
      code: 'API_PROXY_ERROR',
      message: 'Nao foi possivel consultar a API.',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
