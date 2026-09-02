import { resolveApiUrl } from './runtimeEndpoint';
import bootstrap from '../bootstrapPublicData.json';
import { normalizePublicSpeakers } from './publicSpeakers';
import { normalizePublishedSessions } from './publicSessions';

// v6 invalidates pre-publication caches. Without a namespace change, an
// upgraded client could render one of the two hidden sessions before the first
// successful network refresh. All reads are normalized as a second boundary.
const prefix = 'tp_public_cache_v6:';

const bundledByPath: Record<string, unknown> = {
  '/days': bootstrap.days,
  '/tracks': bootstrap.tracks,
  '/speakers': bootstrap.speakers,
  '/sessions': bootstrap.sessions,
  '/partners': bootstrap.partners,
};

function normalizeByPath(path: string, data: unknown): unknown {
  if (path === '/speakers') return normalizePublicSpeakers(data);
  if (path === '/sessions') return normalizePublishedSessions(data);
  return data;
}

/** Мгновенный снимок для экранов, которые не должны мигать skeleton-ом при возврате. */
export function readCachedPublicJson<T>(path: string): T | undefined {
  const key = `${prefix}${path}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null') as { data?: T } | null;
    if (cached?.data !== undefined) return normalizeByPath(path, cached.data) as T;
  } catch { /* corrupted cache */ }
  return normalizeByPath(path, bundledByPath[path]) as T | undefined;
}

export async function fetchCachedJson<T>(path: string): Promise<{ data: T; stale: boolean }> {
  const key = `${prefix}${path}`;
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    let response: Response;
    try {
      response = await fetch(resolveApiUrl(path), { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(String(response.status));
    const data = normalizeByPath(path, await response.json()) as T;
    try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* noop */ }
    return { data, stale: false };
  } catch (error) {
    try {
      const cached = readCachedPublicJson<T>(path);
      if (cached !== undefined) return { data: cached, stale: true };
    } catch { /* corrupted cache */ }
    const bundled = bundledByPath[path] as T | undefined;
    if (bundled !== undefined) return { data: bundled, stale: true };
    throw error;
  }
}
