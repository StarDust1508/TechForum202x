// FILE: src/lib/useNews.ts
// PURPOSE: Единый источник новостей приложения. Истина — БД techforum-api
//          (GET /news, только опубликованные), которой управляет оператор из
//          админки основного сайта. Старые демонстрационные новости намеренно
//          не используются как fallback: пустая БД должна означать пустую ленту.
import { useState, useEffect } from 'react';
import { type NewsItem } from '../data';
import { resolveApiUrl } from './runtimeEndpoint';

export function useNews(): { news: NewsItem[]; loading: boolean } {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/news'));
        if (r.ok && !cancelled) {
          const data = await r.json();
          if (Array.isArray(data)) setNews(data as NewsItem[]);
        }
      } catch {
        /* оффлайн — не подменяем актуальную ленту устаревшими фикстурами */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { news, loading };
}
