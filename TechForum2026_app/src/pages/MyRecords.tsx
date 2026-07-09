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
import { motion } from 'motion/react';
import { SESSIONS, DAYS, getDayById } from '../data';
import BackButton from '@/src/components/BackButton';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';

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
        const res = await authFetch(resolveApiUrl('/sessions/registered'), { credentials: 'include' });
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
    <div className="flex-1 min-h-full px-5 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="flex items-center gap-3">
        <BackButton />
        <h1
          className="font-display text-[28px] leading-none font-bold"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Мои записи</h1>
      </header>

      {registeredSessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/20 bg-card p-8 text-center">
          <CalendarCheck2 className="w-9 h-9 mx-auto text-foreground/55" />
          <p className="mt-3 text-foreground/75">Пока нет выбранных сессий в расписании.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={async () => {
              const r = await authFetch(resolveApiUrl('/sessions/calendar'), { credentials: 'include' });
              if (!r.ok) return;
              const blob = await r.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'techforum2026-my.ics';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            className="flex items-center justify-center gap-2 bg-primary/10 border border-primary/30 text-primary py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            <Download className="w-4 h-4" />
            Все мои сессии в календарь
          </button>

          <div className="space-y-6">
            {Object.entries(byDay).map(([dayId, list]) => {
              const day = getDayById(dayId);
              return (
                <section key={dayId} className="space-y-3">
                  <h3 className="text-[11px] uppercase tracking-[0.22em] font-semibold text-foreground/55 px-1">
                    {day?.label ?? dayId} · {day?.weekday ?? ''}
                  </h3>
                  {list.map((session, idx) => (
                    <motion.article
                      key={session.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3), ease: [0.32, 0.72, 0, 1] }}
                      className="rounded-2xl border border-border bg-card p-5 space-y-3"
                    >
                      <h2 className="text-xl font-semibold text-foreground/95">{session.title}</h2>
                      <div className="flex flex-wrap gap-4 text-sm text-foreground/70">
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" />{session.startTime} – {session.endTime}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{session.location}</span>
                      </div>
                      {session.speakerName !== '—' && (
                        <p className="text-[12px] text-foreground/55">{session.speakerName} · {session.track}</p>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await authFetch(resolveApiUrl(`/sessions/${session.id}/calendar`), { credentials: 'include' });
                          if (!r.ok) return;
                          const blob = await r.blob();
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `techforum2026-${session.id}.ics`;
                          a.click();
                          URL.revokeObjectURL(a.href);
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] text-primary/80 hover:text-primary font-semibold uppercase tracking-widest"
                      >
                        <Download className="w-3.5 h-3.5" />
                        В календарь
                      </button>
                    </motion.article>
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
