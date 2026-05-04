// FILE: src/pages/Schedule.tsx
// VERSION: 3.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Расписание форума — табы по дням, фильтры по залам и трекам,
//          серверная регистрация на сессии (Postgres), conflict-detection
//          модалка, экспорт .ics для одной сессии или для всех «моих».
// SCOPE: UI расписания + клиентские вызовы API регистрации/календаря.
// INPUT: SESSIONS, TRACKS, HALLS, DAYS, EVENT_META из src/data; API /api/v1.
// OUTPUT: JSX-страница.
// KEYWORDS: DOMAIN(8): ConferenceProgram; CONCEPT(8): FilterableList, ConflictDetect; TECH(7): React, Capacitor
// LINKS: READS_DATA_FROM(8): src/data.ts; CALLS_API(9): /sessions/registered, /sessions/:id/register, /sessions/:id/calendar
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему conflict-detection — warning-modal, а не hard-block?
// A: Юзер мог реально хотеть переключаться между двумя параллельными сессиями
//    (часть одной + часть другой). Warning + кнопка "Всё равно записаться"
//    оставляет свободу выбора.
// Q: Почему регистрации храним и локально (registeredIds state) и на сервере?
// A: Серверный список — источник истины (синхронизация между устройствами,
//    .ics export). Локальный кеш — для мгновенной реакции UI без round-trip.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v3.0.0 - Регистрации на сервере (Postgres) вместо localStorage,
//                       conflict-detection modal, экспорт .ics на сессию и
//                       на всю личную программу.]
// PREV_CHANGE_SUMMARY: [v2.0.0 - ID-based фильтрация, цветные track-pills.]
// END_CHANGE_SUMMARY

import { SESSIONS, TRACKS, HALLS, DAYS, getTrackById, type Session } from '../data';
import { MapPin, Filter, AlertTriangle, X, Coffee, Mic, Hand } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PageShell from '@/src/components/ui/PageShell';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

// Day-tabs убраны — расписание показывает все сессии обоих дней одним
// потоком, отсортированным по дню+времени. Фильтры по залу/треку остаются.
// «Мои записи» / «Для меня» доступны через отдельные плитки Home.
const LEGACY_LOCALSTORAGE_KEY = 'techforum_registrations';

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  return (h * 60) + m;
}

/**
 * Возвращает все сессии того же дня, которые пересекаются по времени с target,
 * и при этом уже в registeredIds (т.е. конфликтуют). Сама target исключается.
 */
function findConflicts(target: Session, registeredIds: string[]): Session[] {
  const targetStart = timeToMinutes(target.startTime);
  const targetEnd = timeToMinutes(target.endTime);
  return SESSIONS.filter(s => {
    if (s.id === target.id) return false;
    if (s.dayId !== target.dayId) return false;
    if (!registeredIds.includes(s.id)) return false;
    const start = timeToMinutes(s.startTime);
    const end = timeToMinutes(s.endTime);
    return start < targetEnd && end > targetStart;
  });
}

export default function Schedule() {
  const [activeHallId, setActiveHallId] = useState<string>('all');
  const [activeTrackId, setActiveTrackId] = useState<string>('all');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [conflictTarget, setConflictTarget] = useState<{ session: Session; conflicts: Session[] } | null>(null);

  // Загружаем регистрации с сервера. Если 401/network-error — fallback к
  // legacy localStorage (миграция со старой версии приложения).
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
      } catch {
        // network down — fallback на legacy localStorage
      }
      const stored = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
      if (stored && !cancelled) {
        try { setRegisteredIds(JSON.parse(stored)); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function persistRegistration(sessionId: string, register: boolean): Promise<void> {
    try {
      const url = resolveApiUrl(`/sessions/${sessionId}/register`);
      await fetch(url, { method: register ? 'POST' : 'DELETE', credentials: 'include' });
    } catch (e) {
      // network error — пишем в localStorage как fallback
      console.error('[Schedule] register failed (offline)', e);
    }
    // Параллельно дублируем в localStorage для оффлайна
    const next = register
      ? Array.from(new Set([...registeredIds, sessionId]))
      : registeredIds.filter(id => id !== sessionId);
    localStorage.setItem(LEGACY_LOCALSTORAGE_KEY, JSON.stringify(next));
  }

  function setRegisteredAndPersist(sessionId: string, register: boolean): void {
    setRegisteredIds(prev => {
      const next = register
        ? Array.from(new Set([...prev, sessionId]))
        : prev.filter(id => id !== sessionId);
      return next;
    });
    void persistRegistration(sessionId, register);
  }

  function handleRegisterClick(session: Session): void {
    const isRegistered = registeredIds.includes(session.id);
    if (isRegistered) {
      // снятие — без подтверждения
      setRegisteredAndPersist(session.id, false);
      return;
    }
    const conflicts = findConflicts(session, registeredIds);
    if (conflicts.length > 0) {
      setConflictTarget({ session, conflicts });
      return;
    }
    setRegisteredAndPersist(session.id, true);
  }

  function confirmConflictRegister(): void {
    if (!conflictTarget) return;
    setRegisteredAndPersist(conflictTarget.session.id, true);
    setConflictTarget(null);
  }

  // Фильтр: только зал + трек. День — не фильтруем, показываем всё подряд,
  // отсортированное по индексу дня и времени начала.
  const filteredSessions = SESSIONS
    .filter((s) => {
      const isHallMatch = activeHallId === 'all' || s.hallId === activeHallId;
      const isTrackMatch = activeTrackId === 'all' || s.trackId === activeTrackId;
      return isHallMatch && isTrackMatch;
    })
    .sort((a, b) => {
      const aIdx = DAYS.findIndex((d) => d.id === a.dayId);
      const bIdx = DAYS.findIndex((d) => d.id === b.dayId);
      if (aIdx !== bIdx) return aIdx - bIdx;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

  return (
    <PageShell hideHeader>
      <div className="space-y-3 mt-2">
        {/* Hall filter pills — тот же шрифт/размер/контраст что и у track-pills.
            Inactive bg/text заметно ярче чем раньше: на blueprint-фоне теперь
            читается без всматривания. */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все залы' }, ...HALLS.map((h) => ({ id: h.id, name: h.name }))].map((h) => {
            const active = activeHallId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setActiveHallId(h.id)}
                className={cn(
                  'px-4 py-2 rounded-2xl text-[10px] font-semibold whitespace-nowrap border uppercase tracking-widest leading-none transition-all',
                  active
                    ? 'bg-[#4ec9c0] border-[#4ec9c0] text-[#03161c] shadow-[0_0_18px_rgba(78,201,192,0.55)]'
                    : 'bg-[#0a2f38]/70 text-[#d8f0ee] border-[#4ec9c0]/45 hover:border-[#4ec9c0]/70',
                )}
              >
                {h.name}
              </button>
            );
          })}
        </div>

        {/* Track filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все треки', color: '#4ec9c0' }, ...TRACKS.map((t) => ({ id: t.id, name: t.name, color: t.color }))].map((t) => {
            const active = activeTrackId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTrackId(t.id)}
                className={cn(
                  'px-4 py-2 rounded-2xl text-[10px] font-semibold whitespace-nowrap border uppercase tracking-widest leading-none transition-all',
                  active ? 'text-[#03161c]' : 'bg-[#0a2f38]/70 text-[#d8f0ee] border-[#4ec9c0]/45 hover:border-[#4ec9c0]/70',
                )}
                style={active ? { backgroundColor: t.color, borderColor: t.color, boxShadow: `0 0 18px ${t.color}55` } : undefined}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 mt-6">
        <div>
          {filteredSessions.map((session) => {
            const track = getTrackById(session.trackId);
            const trackColor = track?.color ?? '#4ec9c0';
            const isRegistered = registeredIds.includes(session.id);
            const isCommonFormat = session.format === 'break' || session.format === 'opening' || session.format === 'closing';
            const CommonIcon = session.format === 'break' ? Coffee
              : session.format === 'opening' ? Mic
              : session.format === 'closing' ? Hand
              : null;

            return (
              <div
                key={session.id}
                className={cn(
                  'mb-5 backdrop-blur-xl p-6 rounded-3xl space-y-5 group relative overflow-hidden transition-all',
                  isCommonFormat
                    ? 'bg-[#0a2f38]/55 border border-[#4ec9c0]/30 shadow-[0_4px_18px_rgba(0,0,0,0.25)]'
                    : 'bg-[#0a2f38]/65 border border-[#4ec9c0]/40 shadow-[0_8px_28px_rgba(0,0,0,0.35)] hover:border-[#4ec9c0]/65',
                )}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                  style={{ backgroundColor: trackColor, boxShadow: `0 0 12px ${trackColor}88` }}
                />

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-sm font-bold text-accent">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                    <span className="font-mono tracking-tighter text-[#d8f0ee]/80">
                      {session.startTime} — {session.endTime}
                    </span>
                  </div>
                  {session.status === 'Live' && (
                    <span className="bg-red-500/10 text-red-500 text-[10px] font-semibold px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">
                      В ЭФИРЕ
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-3">
                  {isCommonFormat && CommonIcon && (
                    <div className="w-11 h-11 rounded-2xl bg-[#4ec9c0]/15 border border-[#4ec9c0]/40 flex items-center justify-center text-[#4ec9c0] shrink-0">
                      <CommonIcon className="w-5 h-5" strokeWidth={1.6} />
                    </div>
                  )}
                  <h3 className="font-display-cyrl text-xl font-semibold leading-tight text-[#d8f0ee] flex-1 min-w-0">
                    {session.title}
                  </h3>
                </div>

                {/* Description — для общих форматов (break/opening/closing) показываем
                    обязательно, чтобы плашка имела содержание. Для обычных сессий
                    тоже показываем (короткое описание темы доклада). */}
                {session.description && (
                  <p className={cn(
                    'text-[13px] leading-relaxed',
                    isCommonFormat ? 'text-[#d8f0ee]/80' : 'text-[#d8f0ee]/65',
                  )}>
                    {session.description}
                  </p>
                )}

                {session.speakerIds.length > 0 && (
                  <div className="flex flex-wrap gap-5 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#03161c] border border-[#4ec9c0]/28 flex items-center justify-center text-accent font-semibold text-[11px] shadow-sm">
                        {session.speakerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#d8f0ee] tracking-tight">{session.speakerName}</span>
                        <span className="text-[10px] font-bold text-[#7aa8a4] uppercase tracking-widest">
                          {session.format === 'workshop' ? 'Воркшоп' : session.format === 'panel' ? 'Панель' : session.format === 'keynote' ? 'Keynote' : 'Доклад'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[#7aa8a4] text-xs font-medium bg-[#03161c]/40 px-3 py-1.5 rounded-xl border border-[#4ec9c0]/22">
                      <MapPin className="w-3 h-3 text-accent" />
                      <span className="tracking-tight">{session.location}</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-between items-center bg-[#03161c]/30 -mx-6 -mb-6 px-6 py-4 border-t border-[#4ec9c0]/22 gap-3">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest pl-2 border-l-2 truncate max-w-[55%]"
                    style={{ borderColor: trackColor, color: trackColor }}
                  >
                    {session.track}
                  </span>
                  {!isCommonFormat && (
                    <button
                      onClick={() => handleRegisterClick(session)}
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-widest py-2.5 px-6 rounded-2xl shadow-lg transition-all active:scale-95',
                        isRegistered
                          ? 'bg-card border border-accent/40 text-accent'
                          : 'bg-accent text-[#03161c] shadow-accent/10 hover:brightness-110',
                      )}
                    >
                      {isRegistered ? 'Уже иду' : 'Пойду'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-[#0a2f38]/55 border border-[#4ec9c0]/28 rounded-3xl flex items-center justify-center mx-auto text-[#7aa8a4]/60">
              <Filter className="w-8 h-8" strokeWidth={1.4} />
            </div>
            <p className="text-[#7aa8a4] font-medium">Нет докладов по выбранным фильтрам</p>
          </div>
        )}
      </div>

      {/* Conflict warning modal */}
      <AnimatePresence>
        {conflictTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-5"
            onClick={() => setConflictTarget(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0a2f38] border border-amber-500/30 rounded-[2rem] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-base font-semibold text-[#d8f0ee] tracking-tight">Конфликт времени</h2>
                </div>
                <button
                  onClick={() => setConflictTarget(null)}
                  className="w-8 h-8 rounded-xl bg-card border border-[#4ec9c0]/28 flex items-center justify-center text-[#7aa8a4] hover:text-[#d8f0ee]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-[#d8f0ee]/75 leading-relaxed">
                «{conflictTarget.session.title}» ({conflictTarget.session.startTime}–{conflictTarget.session.endTime}) пересекается со временем уже выбранных сессий:
              </p>

              <ul className="space-y-1.5">
                {conflictTarget.conflicts.map((c) => (
                  <li key={c.id} className="text-[12px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2">
                    <span className="font-mono">{c.startTime}–{c.endTime}</span> · {c.title}
                  </li>
                ))}
              </ul>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConflictTarget(null)}
                  className="flex-1 py-3 rounded-2xl bg-card border border-[#4ec9c0]/28 text-[12px] font-semibold text-[#d8f0ee]/75 active:scale-[0.98]"
                >
                  Отмена
                </button>
                <button
                  onClick={confirmConflictRegister}
                  className="flex-1 py-3 rounded-2xl bg-amber-500/90 text-black text-[12px] font-bold active:scale-[0.98]"
                >
                  Всё равно записаться
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
