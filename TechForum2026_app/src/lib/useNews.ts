// FILE: src/lib/useNews.ts
// PURPOSE: Единый источник новостей приложения. Истина — БД techforum-api
//          (GET /news, только опубликованные), которой управляет оператор из
//          админки основного сайта. Статика NEWS из data.ts — мгновенный
//          фолбэк (первый рендер + оффлайн), чтобы лента и деталь-страница
//          никогда не были пустыми.
import { useState, useEffect } from 'react';
import { NEWS as STATIC_NEWS, type NewsItem } from '../data';
import { resolveApiUrl } from './runtimeEndpoint';

export function useNews(): { news: NewsItem[]; loading: boolean } {
  const [news, setNews] = useState<NewsItem[]>(STATIC_NEWS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/news'));
        if (r.ok && !cancelled) {
          const data = await r.json();
          // Пустой ответ (БД ещё не засеяна / все скрыты) НЕ затираем статикой —
          // так лента не станет пустой на холодном старте до сида.
          if (Array.isArray(data) && data.length) setNews(data as NewsItem[]);
        }
      } catch {
        /* оффлайн — остаётся статический фолбэк */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { news, loading };
}
