// FILE: src/lib/programData.ts
// Round 3: тонкий слой загрузки контента программы из БД через GET endpoints.
// Раньше pages импортировали SPEAKERS / SESSIONS / NEWS / PARTNERS из
// src/data.ts (хардкод в APK). Теперь — fetch с сервера.
//
// Cтратегия:
//  - In-memory cache (Map по ключу) живёт до перезагрузки приложения.
//    Этого достаточно: контент меняется редко (дни-недели), а splash
//    prefetch'ит /sessions /speakers /partners /news → в HTTP-cache WebView.
//  - Pages вызывают `useProgramFetch('/speakers')` — hook возвращает
//    { data, loading, error }. Первый рендер: loading=true; после resolve —
//    data и loading=false.
//  - Если запрос упал (offline / 500), fallback на статичные SPEAKERS из
//    src/data.ts — это безопасно, юзер увидит хоть какие-то данные.
//    fallback также гарантирует обратную совместимость пока миграция всех
//    pages не завершена.

import { useState, useEffect, useCallback } from 'react';
import { resolveApiUrl, authFetch } from './runtimeEndpoint';
import {
  SPEAKERS, SESSIONS, PARTNERS, NEWS, TRACKS, HALLS, DAYS,
  type Speaker, type Session, type Partner, type NewsItem, type Track, type Hall, type Day,
} from '../data';

type CacheEntry = { data: unknown; ts: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 минут — баланс свежести и трафика

const FALLBACKS: Record<string, unknown> = {
  '/speakers': SPEAKERS,
  '/sessions': SESSIONS,
  '/partners': PARTNERS,
  '/news': NEWS,
  '/tracks': TRACKS,
  '/halls': HALLS,
  '/days': DAYS,
};

export interface ProgramFetchState<T> {
  data: T;
  loading: boolean;
  /** Если true — сейчас отображается fallback из data.ts (offline/server-error). */
  fromFallback: boolean;
  refetch: () => void;
}

export function useProgramFetch<T>(path: string): ProgramFetchState<T> {
  const fallback = FALLBACKS[path] as T;
  const cached = cache.get(path);
  const now = Date.now();
  const fresh = cached && now - cached.ts < CACHE_TTL_MS;
  const initial = fresh ? (cached!.data as T) : fallback;

  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(!fresh);
  const [fromFallback, setFromFallback] = useState<boolean>(!fresh);

  const fetchOnce = useCallback(async (): Promise<void> => {
    try {
      const r = await authFetch(resolveApiUrl(path), { credentials: 'include' });
      if (!r.ok) throw new Error(`http_${r.status}`);
      const arr = (await r.json()) as T;
      cache.set(path, { data: arr, ts: Date.now() });
      setData(arr);
      setFromFallback(false);
    } catch {
      // Fallback уже стоит из initial. Просто отключаем loading.
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (fresh) return;
    void fetchOnce();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, fromFallback, refetch: fetchOnce };
}

// Удобные типизированные обёртки для каждой коллекции.
export const useSpeakers = () => useProgramFetch<Speaker[]>('/speakers');
export const useSessions = () => useProgramFetch<Session[]>('/sessions');
export const usePartners = () => useProgramFetch<Partner[]>('/partners');
export const useNews = () => useProgramFetch<NewsItem[]>('/news');
export const useTracks = () => useProgramFetch<Track[]>('/tracks');
export const useHalls = () => useProgramFetch<Hall[]>('/halls');
export const useDays = () => useProgramFetch<Day[]>('/days');
