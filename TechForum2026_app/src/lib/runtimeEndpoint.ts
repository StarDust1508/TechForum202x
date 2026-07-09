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
  // BUG_FIX_CONTEXT: Раньше использовали `new URL(normalizedPath, `${base}/`)`,
  // но new URL с absolute-path (начинающимся с '/') СТИРАЕТ pathname базы:
  //   new URL('/auth/me', 'http://localhost:3000/api/v1/') → 'http://localhost:3000/auth/me'
  // Из-за этого все API-вызовы из фронта попадали на SPA-fallback (HTML) и парсились
  // как JSON → SyntaxError "Unexpected token '<'". Теперь конкатенируем явно.
  const base = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

/**
 * Преобразует относительный URL ассета (например, '/uploads/abc.jpg') в абсолютный,
 * используя origin из API base URL. Если URL уже абсолютный (http/https/data) — возвращает как есть.
 *
 * BUG_FIX_CONTEXT: Avatar возвращается с бэкенда как '/uploads/<file>'. Когда фронт
 * собран с VITE_API_BASE_URL=http://72.56.9.90:3100/api/v1 и работает в Capacitor APK,
 * относительный путь резолвится в `capacitor://localhost/uploads/...` и не находит файл.
 * Хелпер берёт origin (scheme+host+port) из API base и склеивает.
 */
export function resolveAssetUrl(pathOrUrl: string | null | undefined): string {
  if (!pathOrUrl) return '';
  const value = String(pathOrUrl);
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const apiBase = getApiBaseUrl();
  try {
    const url = new URL(apiBase);
    const origin = `${url.protocol}//${url.host}`;
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${origin}${normalizedPath}`;
  } catch {
    return value;
  }
}

const TOKEN_KEY = 'techforum_session_token';

export function saveSessionToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }
}

export function getSessionToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function clearSessionToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
}

export function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...init, credentials: 'include', headers });
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
