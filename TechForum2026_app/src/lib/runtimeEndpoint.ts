const API_OVERRIDE_KEY = 'techforum_api_base_url_override';

function normalizeApiBase(raw: string): string {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  return cleaned.replace(/\/api$/, '/api/v1');
}

export function getConfiguredApiBase(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(API_OVERRIDE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function getApiBaseUrl(): string {
  const storageOverride = getConfiguredApiBase();
  const envBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const raw = storageOverride || envBase;

  if (raw) {
    return normalizeApiBase(raw);
  }

  if (typeof window !== 'undefined') {
    const { protocol, origin } = window.location;
    if (protocol === 'http:' || protocol === 'https:') {
      return normalizeApiBase(`${origin}/api/v1`);
    }
  }

  return 'http://127.0.0.1:3000/api/v1';
}

export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${base}/`).toString();
}

export function resolveWsUrl(path = '/ws'): string {
  const wsEnv = String(import.meta.env.VITE_WS_BASE_URL || '').trim();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (wsEnv) {
    return `${wsEnv.replace(/\/+$/, '')}${normalizedPath}`;
  }

  const apiBase = getApiBaseUrl();
  const url = new URL(apiBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = url.pathname.replace(/\/api(?:\/v1)?\/?$/, '/');
  url.search = '';
  url.hash = '';

  return new URL(normalizedPath, url).toString();
}
