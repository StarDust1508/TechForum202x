// FILE: src/pages/MyRecords.tsx
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Личный кабинет — список зарегистрированных сессий пользователя
//          с группировкой по дню и кнопкой экспорта всей программы в .ics.
// SCOPE: UI + загрузка регистраций с сервера + .ics download.
// INPUT: SESSIONS, DAYS из src/data; API /sessions/registered, /sessions/calendar.
// OUTPUT: JSX страница.
// KEYWORDS: DOMAIN(7): MyAgenda; CONCEPT(7): SortedList; TECH(6): React
// LINKS: CALLS_API(8): /sessions/registered, /sessions/calendar
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 - Регистрации теперь читаются с /sessions/registered (API),
//                       сортировка по дню+времени, кнопка "В календарь" на всю
//                       программу через /sessions/calendar.]
// PREV_CHANGE_SUMMARY: [v1.0.0 - localStorage-only, без сортировки.]
// END_CHANGE_SUMMARY

import { useEffect, useState } from 'react';
import { CalendarCheck2, Clock3, MapPin, Download } from 'lucide-react';
import { SESSIONS, DAYS, getDayById } from '../data';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

const LEGACY_LOCALSTORAGE_KEY = 'techforum_registrations';

function readLegacyRegistrations(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  return h * 60 + m;
}

export default function MyRecords() {
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/sessions/registered'), { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data?.sessionIds)) {
            setRegisteredIds(data.sessionIds);
            return;
          }
        }
      } catch { /* offline — fall through to legacy */ }
      if (!cancelled) setRegisteredIds(readLegacyRegistrations());
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const registeredSessions = SESSIONS
    .filter(s => registeredIds.includes(s.id))
    .sort((a, b) => {
      // sort by day, then by start time
      const aDayIdx = DAYS.findIndex(d => d.id === a.dayId);
      const bDayIdx = DAYS.findIndex(d => d.id === b.dayId);
      if (aDayIdx !== bDayIdx) return aDayIdx - bDayIdx;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

  // Группировка по дню для UI
  const byDay = registeredSessions.reduce<Record<string, typeof registeredSessions>>((acc, s) => {
    (acc[s.dayId] ??= []).push(s);
    return acc;
  }, {});

  return (
    <PageShell
      kicker="Личный кабинет"
      title="Мои записи"
      subtitle={registeredSessions.length > 0 ? `${registeredSessions.length} сессий в вашей программе` : undefined}
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 space-y-3">
              <Skeleton height={20} width="65%" />
              <div className="flex gap-3">
                <Skeleton height={14} width={80} />
                <Skeleton height={14} width={120} />
              </div>
              <Skeleton height={12} width="40%" />
            </div>
          ))}
        </div>
      ) : registeredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#4ec9c0]/25 bg-[#0a2f38]/30 p-8 text-center">
          <CalendarCheck2 className="w-9 h-9 mx-auto text-[#4ec9c0]/60" strokeWidth={1.4} />
          <p className="mt-3 text-[#d8f0ee]/75">Пока нет выбранных сессий в расписании.</p>
          <p className="mt-1 text-[12px] text-[#7aa8a4]">Откройте «Программу» и нажмите «Записаться» — сессия появится здесь.</p>
        </div>
      ) : (
        <>
          <a
            href={resolveApiUrl('/sessions/calendar')}
            download="techforum2026-my.ics"
            className="flex items-center justify-center gap-2 border border-[#4ec9c0]/55 bg-[#0a2f38]/70 text-[#d8f0ee] py-3.5 rounded-[14px] text-[13px] font-semibold uppercase tracking-[0.14em] active:scale-[0.98] hover:border-[#4ec9c0]/80 transition-all font-display-cyrl"
          >
            <Download className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />
            Все мои сессии в календарь
          </a>

          <div className="mt-6 space-y-6">
            {Object.entries(byDay).map(([dayId, list]) => {
              const day = getDayById(dayId);
              return (
                <section key={dayId} className="space-y-3">
                  <h3 className="font-display-cyrl text-[11px] uppercase tracking-[0.28em] font-semibold text-[#4ec9c0]/85 px-1">
                    {day?.label ?? dayId} · {day?.weekday ?? ''}
                  </h3>
                  {list.map((session) => (
                    <article key={session.id} className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 space-y-3">
                      <h2 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee]">{session.title}</h2>
                      <div className="flex flex-wrap gap-4 text-[13px] text-[#d8f0ee]/75">
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />{session.startTime} – {session.endTime}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />{session.location}</span>
                      </div>
                      {session.speakerName !== '—' && (
                        <p className="text-[12px] text-[#7aa8a4]">{session.speakerName} · {session.track}</p>
                      )}
                      <a
                        href={resolveApiUrl(`/sessions/${session.id}/calendar`)}
                        download={`techforum2026-${session.id}.ics`}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#4ec9c0]/85 hover:text-[#4ec9c0] font-semibold uppercase tracking-widest"
                      >
                        <Download className="w-3.5 h-3.5" strokeWidth={1.6} />
                        В календарь
                      </a>
                    </article>
                  ))}
                </section>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}
