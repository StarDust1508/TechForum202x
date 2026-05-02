// FILE: src/lib/prefetch.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Параллельный pre-fetch ключевых ресурсов программы во время
//          1-секундного blueprint-splash. К моменту входа в Home браузерный
//          HTTP-кэш уже прогрет → мгновенный рендер без скелетонов.
// SCOPE: Только запуск fetch'ей. Никакого state-store — полагаемся на HTTP-кэш
//        WebView (тот же URL → тот же ответ из кэша). Pages вызывают fetch
//        как обычно, получают instant response.
// INPUT: Нет (читает endpoint'ы через resolveApiUrl).
// OUTPUT: Promise<void> — резолвится после старта всех запросов (не дожидаясь).
// KEYWORDS: DOMAIN(7): NetworkOptimization; CONCEPT(8): HTTPCacheWarmup; TECH(6): fetch
// LINKS: USED_BY(8): src/App.tsx (paralel с /auth/me на splash);
//        USES_API(7): src/lib/runtimeEndpoint.ts
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему просто fetch без сохранения в Map/Store?
// A: Pages всё равно запрашивают данные через свои useEffect'ы. Если у нас
//    HTTP-кэш (Cache-Control / ETag), второй запрос подхватит ответ за <5ms.
//    Любая попытка сделать собственный store породит проблемы инвалидации
//    и расхождение state'а — лишние строки кода без выгоды.
//
// Q: Что если эндпоинт требует auth?
// A: Делаем prefetch ТОЛЬКО для публичных эндпоинтов (sessions, speakers,
//    posts public-feed, partners). Для авторизованных (/me/registrations
//    и т.п.) prefetch не нужен — они дёргаются после захода в Home, в
//    рамках обычного flow.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 — Параллельный prefetch /sessions, /speakers, /posts,
//                       /partners во время splash. Ошибки игнорируются —
//                       prefetch best-effort.]
// END_CHANGE_SUMMARY

import { resolveApiUrl } from './runtimeEndpoint';

// START_FUNCTION_prefetchPublicData
// START_CONTRACT:
// PURPOSE: Стартует параллельные fetch'и публичных эндпоинтов конференции.
// INPUTS: Нет.
// OUTPUTS: Promise<void> — резолвится сразу после kick-off всех запросов.
// SIDE_EFFECTS: HTTP-запросы, которые осядут в WebView HTTP-cache.
// KEYWORDS: PATTERN(6): FireAndForget; CONCEPT(8): CacheWarmup
// COMPLEXITY_SCORE: 2
// END_CONTRACT
export function prefetchPublicData(): void {
  /**
   * Список эндпоинтов выбран по принципу "что рендерится сразу после Home":
   * - /sessions — расписание (главный экран Schedule)
   * - /speakers — список спикеров (Speakers + reference на Home)
   * - /posts — лента (Feed)
   * - /partners — партнёры (Partners + reference на Home).
   * Каждый запрос — независимый. Ошибки логируем тихо, не пробрасываем.
   */

  const endpoints = ['/sessions', '/speakers', '/posts', '/partners'];

  for (const path of endpoints) {
    const url = resolveApiUrl(path);
    fetch(url, { credentials: 'include', cache: 'default' })
      .then((res) => {
        if (!res.ok) return;
        // Триггерим парсинг тела чтобы браузер действительно скэшировал ответ.
        // Без .text()/.json() некоторые WebView оставляют тело непрочитанным
        // и не кладут в HTTP-cache.
        return res.text().catch(() => undefined);
      })
      .catch(() => { /* offline / 5xx — следующий fetch на странице покажет ошибку */ });
  }
}
// END_FUNCTION_prefetchPublicData
