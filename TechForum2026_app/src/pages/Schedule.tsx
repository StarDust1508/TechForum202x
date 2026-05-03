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

import { SESSIONS, TRACKS, HALLS, DAYS, SPEAKERS, getTrackById, type Session } from '../data';
import { MapPin, Filter, Cpu, Calendar, AlertTriangle, Download, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

const MY_TAB_ID = 'my';
const RECOMMENDED_TAB_ID = 'recommended';
const LEGACY_LOCALSTORAGE_KEY = 'techforum_registrations';

/**
 * Score сессии для Recommended-таба.
 * Считаем размер пересечения интересов всех её спикеров с интересами юзера.
 * Если 0 пересечений — score 0; сортировка fallback-ит на дату+время.
 */
function recommendedScore(session: Session, myInterestSet: Set<string>): number {
  if (myInterestSet.size === 0) return 0;
  const speakerInterests = new Set<string>();
  for (const sid of session.speakerIds) {
    const sp = SPEAKERS.find(s => s.id === sid);
    if (!sp) continue;
    for (const ii of sp.interestIds) speakerInterests.add(ii);
  }
  let score = 0;
  for (const ii of speakerInterests) {
    if (myInterestSet.has(ii)) score += 1;
  }
  return score;
}

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
  const [selectedDayId, setSelectedDayId] = useState<string>(DAYS[0]?.id ?? '');
  const [activeHallId, setActiveHallId] = useState<string>('all');
  const [activeTrackId, setActiveTrackId] = useState<string>('all');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [myInterestIds, setMyInterestIds] = useState<string[]>([]);
  const [conflictTarget, setConflictTarget] = useState<{ session: Session; conflicts: Session[] } | null>(null);

  // Загружаем интересы пользователя для ранжирования "Recommended".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(resolveApiUrl('/me/interests'), { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.interestIds)) {
          setMyInterestIds(data.interestIds);
        }
      } catch {
        // network — молча оставляем []. Recommended вырождается в дата+время сорт.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  // BUG_FIX_CONTEXT: v1 использовал s.location.includes(activeHall) с Cyrillic vs
  // Latin рассинхроном. Сейчас сравниваем строго по hallId.
  const isMyTab = selectedDayId === MY_TAB_ID;
  const isRecommendedTab = selectedDayId === RECOMMENDED_TAB_ID;
  const myInterestSet = new Set<string>(myInterestIds);

  let filteredSessions = SESSIONS.filter(s => {
    const isDayMatch = isMyTab
      ? registeredIds.includes(s.id)
      : isRecommendedTab
        ? true // на табе Recommended показываем все сессии (отсортированные по score)
        : s.dayId === selectedDayId;
    const isHallMatch = activeHallId === 'all' || s.hallId === activeHallId;
    const isTrackMatch = activeTrackId === 'all' || s.trackId === activeTrackId;
    return isDayMatch && isHallMatch && isTrackMatch;
  });

  if (isRecommendedTab) {
    // Сортируем по убыванию score. При равенстве — по дате (dayId) + времени.
    filteredSessions = [...filteredSessions].sort((a, b) => {
      const scoreA = recommendedScore(a, myInterestSet);
      const scoreB = recommendedScore(b, myInterestSet);
      if (scoreA !== scoreB) return scoreB - scoreA;
      if (a.dayId !== b.dayId) return a.dayId.localeCompare(b.dayId);
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }

  return (
    <div className="flex-1 pb-24 pt-6 px-6 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            ДАННЫЕ ГРАФИКА
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary">Расписание</h1>
        </div>

        {/* Day tabs.
            BUG_FIX_CONTEXT: По требованию заказчика добавлен таб "Recommended"
            между "20 мая" и "21 мая" — ранжирует сессии по интересам юзера.
            Таб "Мои записи" остаётся справа. */}
        <div className="flex bg-[#0a2f38] p-1.5 rounded-[1.75rem] border border-card-border shadow-inner">
          {[
            ...(DAYS[0] ? [{ id: DAYS[0].id, label: DAYS[0].label }] : []),
            { id: RECOMMENDED_TAB_ID, label: 'Для меня' },
            ...DAYS.slice(1).map(d => ({ id: d.id, label: d.label })),
            { id: MY_TAB_ID, label: 'Мои записи' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedDayId(tab.id)}
              className={cn(
                'flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest leading-none transition-all',
                selectedDayId === tab.id
                  ? 'bg-accent text-surface shadow-xl shadow-accent/20'
                  : 'text-muted hover:text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* «Скачать всю мою программу в календарь» — показываем только в табе "Мои записи" */}
        {selectedDayId === MY_TAB_ID && registeredIds.length > 0 && (
          <a
            href={resolveApiUrl('/sessions/calendar')}
            download="techforum2026-my.ics"
            className="flex items-center justify-center gap-2 bg-[#4ec9c0]/10 border border-[#4ec9c0]/30 text-[#4ec9c0] py-3 rounded-2xl text-[12px] font-semibold uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            <Download className="w-4 h-4" />
            Все мои сессии в календарь
          </a>
        )}

        {/* Hall filter pills */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все залы' }, ...HALLS.map(h => ({ id: h.id, name: h.name }))].map((h) => {
            const active = activeHallId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setActiveHallId(h.id)}
                className={cn(
                  'px-6 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap border uppercase tracking-widest leading-none',
                  active ? 'bg-primary border-primary text-surface' : 'bg-surface border-card-border text-muted/60',
                )}
              >
                {h.name}
              </button>
            );
          })}
        </div>

        {/* Track filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все треки', color: '#4ec9c0' }, ...TRACKS.map(t => ({ id: t.id, name: t.name, color: t.color }))].map((t) => {
            const active = activeTrackId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTrackId(t.id)}
                className={cn(
                  'px-4 py-2 rounded-2xl text-[10px] font-black whitespace-nowrap border uppercase tracking-widest leading-none transition-all',
                  active ? 'text-surface' : 'bg-surface text-muted/70 border-card-border',
                )}
                style={active ? { backgroundColor: t.color, borderColor: t.color, boxShadow: `0 0 18px ${t.color}55` } : undefined}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </header>

      <div className="space-y-5">
        <div>
          {filteredSessions.map((session) => {
            const track = getTrackById(session.trackId);
            const trackColor = track?.color ?? '#4ec9c0';
            const isRegistered = registeredIds.includes(session.id);
            const isCommonFormat = session.format === 'break' || session.format === 'opening' || session.format === 'closing';

            return (
              <div
                key={session.id}
                className="mb-5 bg-[#0a2f38]/40 backdrop-blur-xl border border-card-border p-6 rounded-3xl space-y-5 hover:border-accent/40 group relative overflow-hidden"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                  style={{ backgroundColor: trackColor, boxShadow: `0 0 12px ${trackColor}88` }}
                />

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-sm font-bold text-accent">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                    <span className="font-mono tracking-tighter text-primary/80">
                      {session.startTime} — {session.endTime}
                    </span>
                  </div>
                  {session.status === 'Live' && (
                    <span className="bg-red-500/10 text-red-500 text-[10px] font-black px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-widest">
                      В ЭФИРЕ
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black leading-tight tracking-tight text-white">
                  {session.title}
                </h3>

                {session.speakerIds.length > 0 && (
                  <div className="flex flex-wrap gap-5 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-surface border border-card-border flex items-center justify-center text-accent font-black text-[11px] shadow-sm">
                        {session.speakerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-primary tracking-tight">{session.speakerName}</span>
                        <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                          {session.format === 'workshop' ? 'Воркшоп' : session.format === 'panel' ? 'Панель' : session.format === 'keynote' ? 'Keynote' : 'Доклад'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted text-xs font-medium bg-surface/40 px-3 py-1.5 rounded-xl border border-card-border/50">
                      <MapPin className="w-3 h-3 text-accent" />
                      <span className="tracking-tight">{session.location}</span>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-between items-center bg-surface/30 -mx-6 -mb-6 px-6 py-4 border-t border-card-border/50 gap-3">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest pl-2 border-l-2 truncate max-w-[40%]"
                    style={{ borderColor: trackColor, color: trackColor }}
                  >
                    {session.track}
                  </span>
                  <div className="flex gap-2 items-center">
                    {!isCommonFormat && (
                      <a
                        href={resolveApiUrl(`/sessions/${session.id}/calendar`)}
                        download={`techforum2026-${session.id}.ics`}
                        title="Добавить в календарь"
                        className="text-[10px] font-black uppercase tracking-widest p-2.5 rounded-2xl bg-card border border-card-border text-muted/70 hover:text-accent hover:border-accent/30 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {!isCommonFormat && (
                      <button
                        onClick={() => handleRegisterClick(session)}
                        className={cn(
                          'text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-2xl shadow-lg transition-all active:scale-95',
                          isRegistered
                            ? 'bg-card border border-accent/40 text-accent'
                            : 'bg-accent text-surface shadow-accent/10 hover:brightness-110',
                        )}
                      >
                        {isRegistered ? 'Уже иду' : 'Пойду'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-card border border-card-border rounded-3xl flex items-center justify-center mx-auto text-muted/30">
              {selectedDayId === MY_TAB_ID ? <Calendar className="w-8 h-8" /> : <Filter className="w-8 h-8" />}
            </div>
            <p className="text-muted font-medium">
              {selectedDayId === MY_TAB_ID
                ? 'Вы ещё не записались ни на одну сессию'
                : selectedDayId === RECOMMENDED_TAB_ID
                  ? 'Нет рекомендаций — попробуй сменить фильтры или выбрать больше интересов'
                  : 'Нет докладов по выбранным фильтрам'}
            </p>
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
                  <h2 className="text-base font-black text-white tracking-tight">Конфликт времени</h2>
                </div>
                <button
                  onClick={() => setConflictTarget(null)}
                  className="w-8 h-8 rounded-xl bg-card border border-card-border flex items-center justify-center text-muted hover:text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-white/75 leading-relaxed">
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
                  className="flex-1 py-3 rounded-2xl bg-card border border-card-border text-[12px] font-semibold text-white/75 active:scale-[0.98]"
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
    </div>
  );
}
