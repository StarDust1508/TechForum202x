// FILE: src/pages/MyRecords.tsx
// VERSION: 3.0.0 — две вкладки: Сессии + Розыгрыши

import { useEffect, useState } from 'react';
import { CalendarCheck2, Clock3, MapPin, Download, Trophy, Award, X } from 'lucide-react';
import { SESSIONS, DAYS, getDayById } from '../data';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { GIVEAWAYS, LS_KEY as GIVEAWAYS_LS_KEY, readJoinedGiveaways } from './Giveaways';
import { cn } from '@/src/lib/utils';

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

type Tab = 'sessions' | 'giveaways';

export default function MyRecords() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [joinedGiveaways, setJoinedGiveaways] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Сессии
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
      } catch { /* offline → legacy */ }
      if (!cancelled) setRegisteredIds(readLegacyRegistrations());
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Розыгрыши — refresh при заходе на таб
  useEffect(() => {
    setJoinedGiveaways(readJoinedGiveaways());
  }, [tab]);

  const registeredSessions = SESSIONS
    .filter((s) => registeredIds.includes(s.id))
    .sort((a, b) => {
      const aDayIdx = DAYS.findIndex((d) => d.id === a.dayId);
      const bDayIdx = DAYS.findIndex((d) => d.id === b.dayId);
      if (aDayIdx !== bDayIdx) return aDayIdx - bDayIdx;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

  const byDay = registeredSessions.reduce<Record<string, typeof registeredSessions>>((acc, s) => {
    (acc[s.dayId] ??= []).push(s);
    return acc;
  }, {});

  const myGiveaways = GIVEAWAYS.filter((g) => joinedGiveaways.includes(g.id));

  const leaveGiveaway = (id: string) => {
    const next = joinedGiveaways.filter((x) => x !== id);
    setJoinedGiveaways(next);
    try { localStorage.setItem(GIVEAWAYS_LS_KEY, JSON.stringify(next)); } catch { /* noop */ }
  };

  const subtitleText =
    tab === 'sessions'
      ? (registeredSessions.length > 0 ? `${registeredSessions.length} сессий в вашей программе` : undefined)
      : (myGiveaways.length > 0 ? `${myGiveaways.length} активных участий` : undefined);

  return (
    <PageShell kicker="Личный кабинет" title="Мои записи" subtitle={subtitleText}>
      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 p-1 rounded-2xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40">
        <button
          onClick={() => setTab('sessions')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em] transition-all font-display-cyrl flex items-center justify-center gap-2',
            tab === 'sessions'
              ? 'bg-[#4ec9c0]/15 text-[#4ec9c0] border border-[#4ec9c0]/55'
              : 'text-[#7aa8a4] border border-transparent',
          )}
        >
          <CalendarCheck2 className="w-3.5 h-3.5" strokeWidth={1.8} />
          Сессии
          {registeredSessions.length > 0 && (
            <span className="font-mono text-[10px] text-[#4ec9c0]/85">· {registeredSessions.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('giveaways')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em] transition-all font-display-cyrl flex items-center justify-center gap-2',
            tab === 'giveaways'
              ? 'bg-[#4ec9c0]/15 text-[#4ec9c0] border border-[#4ec9c0]/55'
              : 'text-[#7aa8a4] border border-transparent',
          )}
        >
          <Trophy className="w-3.5 h-3.5" strokeWidth={1.8} />
          Розыгрыши
          {myGiveaways.length > 0 && (
            <span className="font-mono text-[10px] text-[#4ec9c0]/85">· {myGiveaways.length}</span>
          )}
        </button>
      </div>

      {/* SESSIONS TAB */}
      {tab === 'sessions' && (
        loading ? (
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
        )
      )}

      {/* GIVEAWAYS TAB */}
      {tab === 'giveaways' && (
        myGiveaways.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#4ec9c0]/25 bg-[#0a2f38]/30 p-8 text-center">
            <Trophy className="w-9 h-9 mx-auto text-[#4ec9c0]/60" strokeWidth={1.4} />
            <p className="mt-3 text-[#d8f0ee]/75">Вы пока не участвуете ни в одном розыгрыше.</p>
            <p className="mt-1 text-[12px] text-[#7aa8a4]">Откройте «Розыгрыши», выберите приз и нажмите «Участвовать».</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myGiveaways.map((g) => (
              <article key={g.id} className="rounded-3xl border border-emerald-500/40 bg-[#0a2f38]/40 overflow-hidden">
                <div className={cn('relative h-28 overflow-hidden flex items-center justify-center bg-gradient-to-br', g.gradient)}>
                  <g.Icon className="relative z-10 w-16 h-16 text-[#d8f0ee] drop-shadow-[0_0_18px_rgba(255,255,255,0.4)]" strokeWidth={1.1} />
                  <span className="absolute top-2.5 left-2.5 bg-[#03161c]/85 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full border border-[#4ec9c0]/40 uppercase tracking-widest">
                    {g.category}
                  </span>
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 bg-emerald-500/85 text-[#03161c] font-mono text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest">
                    Участвую
                  </span>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display-cyrl text-[16px] font-semibold text-[#d8f0ee] leading-tight flex-1">{g.item}</h3>
                    <button
                      onClick={() => leaveGiveaway(g.id)}
                      className="shrink-0 rounded-[10px] border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 active:scale-95 transition-all px-2 py-2"
                      aria-label="Отказаться от участия"
                    >
                      <X className="w-4 h-4" strokeWidth={1.8} />
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#4ec9c0]/22 bg-[#03161c]/40 p-2.5 flex items-start gap-2">
                    <Award className="w-3.5 h-3.5 text-[#4ec9c0] mt-0.5 shrink-0" strokeWidth={1.8} />
                    <p className="text-[11px] leading-relaxed text-[#d8f0ee]/75">{g.condition}</p>
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#7aa8a4]">
                    Итоги: {g.endTime}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )
      )}
    </PageShell>
  );
}
