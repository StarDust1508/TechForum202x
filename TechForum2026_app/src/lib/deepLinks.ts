export const DEEP_LINK_SCHEME = 'conference-app:';

export type DeepLinkResolution =
  | { ok: true; route: string; canonicalUrl: string }
  | { ok: false; route: '/'; reason: 'invalid_url' | 'unsupported_scheme' | 'unsupported_route' };

const SIMPLE_ROUTES = new Set([
  '/',
  '/about',
  '/attendees',
  '/diagnostics',
  '/faq',
  '/feed',
  '/giveaways',
  '/map',
  '/my-card',
  '/my-records',
  '/partners',
  '/profile',
  '/settings',
  '/speakers',
  '/ticket',
]);

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function routePath(url: URL): string {
  // Both conference-app://schedule and conference-app:///schedule are valid.
  const hostPart = url.hostname ? `/${url.hostname}` : '';
  const pathname = url.pathname === '/' ? '' : url.pathname;
  const combined = `${hostPart}${pathname}` || '/';
  return combined.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
}

function safeId(value: string | null): string | null {
  const normalized = String(value || '').trim();
  return SAFE_ID.test(normalized) ? normalized : null;
}

export function resolveDeepLink(rawUrl: string): DeepLinkResolution {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, route: '/', reason: 'invalid_url' };
  }
  if (url.protocol !== DEEP_LINK_SCHEME) {
    return { ok: false, route: '/', reason: 'unsupported_scheme' };
  }

  const path = routePath(url);
  if (SIMPLE_ROUTES.has(path)) {
    return { ok: true, route: path, canonicalUrl: `${DEEP_LINK_SCHEME}//${path}` };
  }

  if (path === '/schedule') {
    const session = safeId(url.searchParams.get('session'));
    const route = session ? `/schedule?session=${encodeURIComponent(session)}` : '/schedule';
    return { ok: true, route, canonicalUrl: `${DEEP_LINK_SCHEME}//${route}` };
  }

  if (path === '/chat') {
    const dm = safeId(url.searchParams.get('dm'));
    const route = dm ? `/chat?dm=${encodeURIComponent(dm)}` : '/chat';
    return { ok: true, route, canonicalUrl: `${DEEP_LINK_SCHEME}//${route}` };
  }

  const detail = /^\/(speakers|news|users)\/([^/]+)$/.exec(path);
  if (detail) {
    const id = safeId(decodeURIComponent(detail[2]));
    if (id) {
      const route = `/${detail[1]}/${encodeURIComponent(id)}`;
      return { ok: true, route, canonicalUrl: `${DEEP_LINK_SCHEME}//${route}` };
    }
  }

  return { ok: false, route: '/', reason: 'unsupported_route' };
}

export function createDeepLinkDeduper(windowMs = 1_500): (canonicalUrl: string, now?: number) => boolean {
  let lastUrl = '';
  let lastAt = 0;
  return (canonicalUrl: string, now = Date.now()) => {
    if (canonicalUrl === lastUrl && now - lastAt < windowMs) return false;
    lastUrl = canonicalUrl;
    lastAt = now;
    return true;
  };
}
