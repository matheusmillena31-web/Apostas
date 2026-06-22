const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_FUTEBOL_PROXY_BASE_URL = viteEnv?.VITE_API_FUTEBOL_PROXY_URL ?? '/api/futebol';
const AUTH_ERROR_EVENT = 'api-futebol:auth-error';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

export interface ApiClientRequestOptions extends Omit<RequestInit, 'body' | 'headers' | 'method'> {
  method?: HttpMethod;
  headers?: HeadersInit;
  query?: Record<string, QueryValue>;
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
}

export interface ApiAuthErrorDetail {
  status: 401;
  message: string;
  payload: unknown;
}

export class ApiClientError extends Error {
  status: number;
  payload: unknown;
  response: Response;

  constructor(message: string, response: Response, payload: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = response.status;
    this.payload = payload;
    this.response = response;
  }

  get isAuthError() {
    return this.status === 401;
  }
}

export const onApiFutebolAuthError = (handler: (detail: ApiAuthErrorDetail) => void) => {
  const listener = (event: Event) => handler((event as CustomEvent<ApiAuthErrorDetail>).detail);
  window.addEventListener(AUTH_ERROR_EVENT, listener);
  return () => window.removeEventListener(AUTH_ERROR_EVENT, listener);
};

const buildUrl = (path: string, query?: Record<string, QueryValue>) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBaseUrl = API_FUTEBOL_PROXY_BASE_URL.replace(/\/$/, '');
  const url = new URL(`${normalizedBaseUrl}${normalizedPath}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
};

const isJsonBody = (body: ApiClientRequestOptions['body']) =>
  body !== undefined && body !== null && !(body instanceof FormData) && !(body instanceof Blob);

const prepareBody = (body: ApiClientRequestOptions['body']): BodyInit | null | undefined => {
  if (!isJsonBody(body)) return body as BodyInit | null | undefined;
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
};

const parseResponse = async (response: Response) => {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  return response.text();
};

const dispatchAuthError = (payload: unknown) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<ApiAuthErrorDetail>(AUTH_ERROR_EVENT, {
      detail: {
        status: 401,
        message: 'Token da API Futebol invalido, expirado ou ausente.',
        payload,
      },
    }),
  );
};

export const apiClient = async <TResponse>(
  path: string,
  { method = 'GET', headers, query, body, ...init }: ApiClientRequestOptions = {},
): Promise<TResponse> => {
  const requestHeaders = new Headers(headers);
  const serializedBody = prepareBody(body);

  requestHeaders.set('Accept', 'application/json');

  if (isJsonBody(body) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json; charset=utf-8');
  }

  const response = await fetch(buildUrl(path, query), {
    ...init,
    method,
    headers: requestHeaders,
    body: serializedBody,
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const error = new ApiClientError(`Erro ${response.status} ao consultar a API Futebol.`, response, payload);

    if (error.isAuthError) {
      dispatchAuthError(payload);
    }

    throw error;
  }

  return payload as TResponse;
};

export const apiFutebolBaseUrl = API_FUTEBOL_PROXY_BASE_URL;
export const apiFutebolAuthErrorEvent = AUTH_ERROR_EVENT;
