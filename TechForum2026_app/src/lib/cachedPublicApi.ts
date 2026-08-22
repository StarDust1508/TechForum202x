import { resolveApiUrl } from './runtimeEndpoint';
import bootstrap from '../bootstrapPublicData.json';

const prefix = 'tp_public_cache_v3:';

const bundledByPath: Record<string, unknown> = {
  '/days': bootstrap.days,
  '/tracks': bootstrap.tracks,
  '/speakers': bootstrap.speakers,
  '/sessions': bootstrap.sessions,
  '/partners': bootstrap.partners,
};

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
    const data = await response.json() as T;
    try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* noop */ }
    return { data, stale: false };
  } catch (error) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null') as { data?: T } | null;
      if (cached?.data !== undefined) return { data: cached.data, stale: true };
    } catch { /* corrupted cache */ }
    const bundled = bundledByPath[path] as T | undefined;
    if (bundled !== undefined) return { data: bundled, stale: true };
    throw error;
  }
}
