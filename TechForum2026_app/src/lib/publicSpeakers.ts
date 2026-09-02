import focusMetadata from '../speakerImageFocus.json';

export interface SpeakerImageFocus {
  xPercent: number;
  yPercent: number;
}

export interface PublicSpeaker {
  id: string;
  name: string;
  role: string;
  company: string;
  bio: string;
  avatarLetter: string;
  avatarUrl?: string | null;
  topic?: string | null;
  trackId: string;
  interestIds: string[];
  imageFocus: SpeakerImageFocus;
}

const clampPercent = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : fallback;
};

const fallbackFocus: SpeakerImageFocus = {
  xPercent: clampPercent(focusMetadata.default.xPercent, 50),
  yPercent: clampPercent(focusMetadata.default.yPercent, 30),
};

export function getSpeakerImageFocus(speakerId: string): SpeakerImageFocus {
  const entry = (focusMetadata.speakers as Record<string, SpeakerImageFocus>)[speakerId];
  if (!entry) return fallbackFocus;
  return {
    xPercent: clampPercent(entry.xPercent, fallbackFocus.xPercent),
    yPercent: clampPercent(entry.yPercent, fallbackFocus.yPercent),
  };
}

export function getSpeakerImageStyle(speakerId: string): { objectPosition: string } {
  const focus = getSpeakerImageFocus(speakerId);
  return { objectPosition: `${focus.xPercent}% ${focus.yPercent}%` };
}

export function normalizePublicSpeakers(value: unknown): PublicSpeaker[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, PublicSpeaker>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const raw = candidate as Record<string, unknown>;
    const id = String(raw.id || '').trim();
    const name = String(raw.name || '').trim();
    if (!id || !name || unique.has(id)) continue;
    unique.set(id, {
      id,
      name,
      role: String(raw.role || ''),
      company: String(raw.company || ''),
      bio: String(raw.bio || ''),
      avatarLetter: String(raw.avatarLetter || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)),
      avatarUrl: typeof raw.avatarUrl === 'string' ? raw.avatarUrl : null,
      topic: typeof raw.topic === 'string' ? raw.topic : null,
      trackId: String(raw.trackId || ''),
      interestIds: Array.isArray(raw.interestIds) ? raw.interestIds.filter((item): item is string => typeof item === 'string') : [],
      imageFocus: getSpeakerImageFocus(id),
    });
  }
  return [...unique.values()];
}

export function selectPublicSpeakers(sources: { live?: unknown; cached?: unknown; bundled?: unknown }): PublicSpeaker[] {
  for (const source of [sources.live, sources.cached, sources.bundled]) {
    const normalized = normalizePublicSpeakers(source);
    if (normalized.length > 0) return normalized;
  }
  return [];
}
