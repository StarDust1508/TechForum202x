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
import BackButton from '@/src/components/BackButton';
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
    })();
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
    <div className="flex-1 min-h-full px-5 pt-8 pb-10 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold flex items-center gap-2">
          <CalendarCheck2 className="w-3.5 h-3.5" />
          Личный кабинет
        </p>
        <h1 className="font-elite text-3xl leading-none text-white">Мои записи</h1>
      </header>

      {registeredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center">
          <CalendarCheck2 className="w-9 h-9 mx-auto text-white/55" />
          <p className="mt-3 text-white/75">Пока нет выбранных сессий в расписании.</p>
        </div>
      ) : (
        <>
          <a
            href={resolveApiUrl('/sessions/calendar')}
            download="techforum2026-my.ics"
            className="flex items-center justify-center gap-2 bg-[#00ffff]/10 border border-[#00ffff]/30 text-[#00ffff] py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            <Download className="w-4 h-4" />
            Все мои сессии в календарь
          </a>

          <div className="space-y-6">
            {Object.entries(byDay).map(([dayId, list]) => {
              const day = getDayById(dayId);
              return (
                <section key={dayId} className="space-y-3">
                  <h3 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-white/55 px-1">
                    {day?.label ?? dayId} · {day?.weekday ?? ''}
                  </h3>
                  {list.map((session) => (
                    <article key={session.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                      <h2 className="text-xl font-semibold text-white/95">{session.title}</h2>
                      <div className="flex flex-wrap gap-4 text-sm text-white/70">
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" />{session.startTime} – {session.endTime}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{session.location}</span>
                      </div>
                      {session.speakerName !== '—' && (
                        <p className="text-[12px] text-white/55">{session.speakerName} · {session.track}</p>
                      )}
                      <a
                        href={resolveApiUrl(`/sessions/${session.id}/calendar`)}
                        download={`techforum2026-${session.id}.ics`}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#00ffff]/80 hover:text-[#00ffff] font-semibold uppercase tracking-widest"
                      >
                        <Download className="w-3.5 h-3.5" />
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
    </div>
  );
}
