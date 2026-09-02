export const HIDDEN_PUBLIC_SESSION_IDS = new Set([
  'ev_64df4b6eef3776',
  'ev_cc2ac4fb7154b4',
]);

export const IVAN_BONDARENKO_SPEAKER_ID = 'ss_9549f3332e335f3a';
export const IVAN_BONDARENKO_SESSION_ID = 'ev_4ed0cf7acbbceb';
export const IVAN_BONDARENKO_SESSION_TITLE = 'Локальная модель + графовый RAG: проверяемый ИИ-контур без сверхмощной инфраструктуры';

/**
 * Publication boundary shared by live responses, persisted cache and bundled
 * first-launch data. Hidden rows remain on the server for audit/history, but
 * no visible client surface may render them.
 *
 * The Ivan Bondarenko link is the only client-side reconciliation in this
 * release. It is backed by the canonical programme and speaker registry. The
 * title guard prevents silently attaching him if that stable session id is
 * ever repurposed.
 */
export function normalizePublishedSessions<T extends Record<string, unknown>>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, T>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const raw = candidate as Record<string, unknown>;
    const id = String(raw.id || '').trim();
    if (!id || HIDDEN_PUBLIC_SESSION_IDS.has(id) || unique.has(id)) continue;

    if (id === IVAN_BONDARENKO_SESSION_ID && raw.title === IVAN_BONDARENKO_SESSION_TITLE) {
      const existingIds = Array.isArray(raw.speakerIds)
        ? raw.speakerIds.filter((item): item is string => typeof item === 'string')
        : [];
      unique.set(id, ({
        ...raw,
        speakerIds: Array.from(new Set([...existingIds, IVAN_BONDARENKO_SPEAKER_ID])),
        ...((!raw.speakerName || raw.speakerName === '—') ? { speakerName: 'Иван Бондаренко' } : {}),
      } as unknown) as T);
      continue;
    }

    unique.set(id, raw as T);
  }
  return [...unique.values()];
}
