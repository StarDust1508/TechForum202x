// FILE: src/lib/ics.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Генератор iCalendar (.ics) v2.0 файлов из доменных Session-объектов.
//          Используется backend-эндпоинтами /sessions/calendar и
//          /sessions/:id/calendar.
// SCOPE: Только построение текста ICS, без I/O и сети.
// INPUT: Session[], EventMeta, Day[]; для одной сессии — Session, Day, EventMeta.
// OUTPUT: Строка в формате ICS (CRLF line endings, EXTENDED).
// KEYWORDS: DOMAIN(8): CalendarExport; CONCEPT(8): RFC5545; TECH(7): TypeScript
// LINKS: USED_BY(9): server.ts (calendar endpoints)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему руками формат, а не lib типа ical-generator?
// A: ICS — простой текстовый формат, требует меньше зависимостей. Lib добавит
//    +500KB бандла за фичу, которую можно описать в 60 строк.
// Q: Почему CRLF (\r\n) вместо \n?
// A: RFC 5545 требует \r\n. Apple Calendar и Google Calendar терпят \n,
//    но Outlook не разбирает \n-only ICS.
// END_RATIONALE
//
// START_INVARIANTS:
// - Каждое событие имеет UID (стабильный для одной и той же сессии).
// - DTSTART/DTEND в формате "YYYYMMDDTHHMMSS" с TZID (Europe/Saratov).
// - Long lines (>75 chars) не складываются — большинство клиентов терпят.
// END_INVARIANTS

interface IcsEvent {
  uid: string;
  /** "20260520T103000" */
  dtstart: string;
  /** "20260520T113000" */
  dtend: string;
  summary: string;
  description: string;
  location: string;
  organizer: { name: string; email: string };
  url?: string;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * Конвертирует "25 сентября" + "10:30" + ISO date "2026-09-25" в "20260925T103000".
 * Часовой пояс выносится в TZID секции; DTSTART сам без TZ-suffix.
 */
export function formatIcsDateTime(isoDate: string, timeHHmm: string): string {
  const [hh, mm] = timeHHmm.split(':');
  const compactDate = isoDate.replace(/-/g, '');
  return `${compactDate}T${hh}${mm}00`;
}

export function buildIcsEvent(ev: IcsEvent, timezone: string): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;TZID=${timezone}:${ev.dtstart}`,
    `DTEND;TZID=${timezone}:${ev.dtend}`,
    `SUMMARY:${escapeIcsText(ev.summary)}`,
    `DESCRIPTION:${escapeIcsText(ev.description)}`,
    `LOCATION:${escapeIcsText(ev.location)}`,
    `ORGANIZER;CN=${escapeIcsText(ev.organizer.name)}:mailto:${ev.organizer.email}`,
  ];
  if (ev.url) lines.push(`URL:${ev.url}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function buildIcsCalendar(
  events: IcsEvent[],
  meta: { name: string; timezone: string },
): string {
  const head = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ТехнологИИ Права 2026//Event App//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(meta.name)}`,
    `X-WR-TIMEZONE:${meta.timezone}`,
    // Минимальный VTIMEZONE для Europe/Saratov (UTC+4, без DST с 2014)
    'BEGIN:VTIMEZONE',
    `TZID:${meta.timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:20140101T000000',
    'TZOFFSETFROM:+0400',
    'TZOFFSETTO:+0400',
    'TZNAME:MSK+1',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  const body = events.map(e => buildIcsEvent(e, meta.timezone));
  const tail = ['END:VCALENDAR', ''];
  return [...head, ...body, ...tail].join('\r\n');
}
