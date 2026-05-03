// FILE: src/lib/log.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Тонкий structured-logger для frontend и Node-backend. Заменяет
//          голые console.log/warn/error на типизированные level-функции с
//          опциональным контекстом.
// SCOPE: Только обёртка над console. Никаких внешних транспортов
//        (Sentry/Logtail) — это инфра-вопрос, не входит в текущий пакет.
// INPUT: msg + optional ctx-object.
// OUTPUT: console-вызов с уровнем + JSON-сериализация контекста.
// KEYWORDS: DOMAIN(6): Observability; CONCEPT(7): StructuredLogging
// LINKS: USED_BY(8): server.ts (replace console.*); USED_BY(7): src/lib/biometric.ts, prefetch.ts
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему не pino/winston на бэке?
// A: Они тянут зависимости и сложную конфигурацию. На single-VPS с systemd
//    + journald нативного structured-логгинга достаточно: console.log из
//    Node идёт в stdout → systemd кладёт в journald с timestamp. Format
//    [Level][Scope] сообщение — читается grep'ом.
//
// Q: Почему frontend share тот же модуль?
// A: Контракт строки лога одинаковый — упрощает поиск проблем в support
//    (юзер шлёт скрин консоли — формат как в server-логах).
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 — Первичная реализация: 4 уровня + опциональный
//                       contextual JSON.]
// END_CHANGE_SUMMARY

type LogContext = Record<string, unknown> | undefined;

function fmt(level: string, scope: string, msg: string, ctx?: LogContext): unknown[] {
  const ts = new Date().toISOString();
  const head = `[${ts}][${level}][${scope}] ${msg}`;
  return ctx ? [head, ctx] : [head];
}

export const log = {
  debug(scope: string, msg: string, ctx?: LogContext): void {
    // В prod debug-уровень не нужен в stdout (засорение journald).
    // На клиенте — Vite инжектит import.meta.env.DEV; на сервере —
    // process.env.NODE_ENV. Используем оба guard'а.
    const isDev =
      (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') ||
      (typeof (globalThis as unknown as { import?: unknown }).import !== 'undefined');
    if (!isDev) return;
    console.debug(...fmt('DEBUG', scope, msg, ctx));
  },
  info(scope: string, msg: string, ctx?: LogContext): void {
    console.log(...fmt('INFO', scope, msg, ctx));
  },
  warn(scope: string, msg: string, ctx?: LogContext): void {
    console.warn(...fmt('WARN', scope, msg, ctx));
  },
  error(scope: string, msg: string, ctx?: LogContext): void {
    console.error(...fmt('ERROR', scope, msg, ctx));
  },
};
