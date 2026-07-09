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

import { SESSIONS, TRACKS, HALLS, DAYS, SPEAKERS, getTrackById, EVENT_META, type Session } from '../data';
import { MapPin, Filter, Calendar, AlertTriangle, Download, X, Building, Coffee, Wifi, Phone, Info, Navigation, Map as MapIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';

const MY_TAB_ID = 'my';
const RECOMMENDED_TAB_ID = 'recommended';
const MAP_TAB_ID = 'map';
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
        const res = await authFetch(resolveApiUrl('/me/interests'), { credentials: 'include' });
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
        const res = await authFetch(resolveApiUrl('/sessions/registered'), { credentials: 'include' });
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
      await authFetch(url, { method: register ? 'POST' : 'DELETE', credentials: 'include' });
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
  const isMapTab = selectedDayId === MAP_TAB_ID;
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
    <div className="flex-1 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      {/* Sticky header with title + day tabs */}
      <div className="sticky top-0 z-20 bg-background border-b border-white/[0.06] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
        <div className="px-5 pt-4 pb-4 space-y-4">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1
            className="font-display text-[28px] leading-none font-bold"
            style={{
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Программа
          </h1>
          </div>

          {/* Day tabs — compact horizontal scroll */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
            {[
              ...(DAYS[0] ? [{ id: DAYS[0].id, label: DAYS[0].label }] : []),
              { id: RECOMMENDED_TAB_ID, label: 'Для меня' },
              ...DAYS.slice(1).map(d => ({ id: d.id, label: d.label })),
              { id: MY_TAB_ID, label: 'Мои' },
              { id: MAP_TAB_ID, label: 'Схема' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedDayId(tab.id)}
                className={cn(
                  'px-4 py-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all',
                  selectedDayId === tab.id
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-white/[0.04] text-foreground/45 border border-white/[0.06]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map tab — venue schema */}
      {isMapTab && (
        <div className="px-5 pt-5 space-y-6">
          <p className="text-[13px] text-foreground/40">{EVENT_META.location}, {EVENT_META.city}</p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="aspect-[4/5] rounded-2xl border border-primary/15 bg-background relative overflow-hidden"
          >
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'linear-gradient(rgba(0,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,255,255,0.08),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,51,153,0.05),transparent_50%)]" />

            <div className="absolute inset-6 flex flex-col gap-3">
              <div className="flex-[3] rounded-xl border border-primary/20 bg-primary/[0.03] flex items-center justify-center relative">
                <div className="absolute top-2 left-3 text-[8px] uppercase tracking-[0.2em] text-primary/40 font-bold">Главный зал</div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-[10px] text-foreground/50 font-semibold">600 мест</p>
                </div>
              </div>
              <div className="flex gap-3 flex-[2]">
                <div className="flex-1 rounded-xl border border-[#ff3399]/15 bg-[#ff3399]/[0.03] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[#ff3399]/50 font-bold">Альфа</p>
                    <p className="text-[10px] text-foreground/40 mt-0.5">220 мест</p>
                  </div>
                </div>
                <div className="flex-1 rounded-xl border border-[#a855f7]/15 bg-[#a855f7]/[0.03] flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[#a855f7]/50 font-bold">Бета</p>
                    <p className="text-[10px] text-foreground/40 mt-0.5">180 мест</p>
                  </div>
                </div>
              </div>
              <div className="flex-[1] rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center gap-6">
                <div className="flex items-center gap-1.5 text-[9px] text-foreground/30 uppercase tracking-wider">
                  <Coffee className="w-3 h-3" /> Фойе
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-foreground/30 uppercase tracking-wider">
                  <Building className="w-3 h-3" /> Выставка
                </div>
              </div>
            </div>

            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.06]">
              <Navigation className="w-3 h-3 text-primary/50" />
              <span className="text-[8px] text-foreground/30 font-mono tracking-wide">51.5339°N 46.0014°E</span>
            </div>
          </motion.div>

          <section className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-foreground/40 font-bold">Инфраструктура</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Выставка', icon: Building, desc: 'Фойе, этаж 1', accent: '#00ffff' },
                { label: 'Кофе-брейк', icon: Coffee, desc: 'Правое крыло', accent: '#ff3399' },
                { label: 'Wi-Fi', icon: Wifi, desc: 'TF_Guests', accent: '#00ffff' },
                { label: 'Поддержка', icon: Phone, desc: 'Стойка регистрации', accent: '#ff3399' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: [0.32, 0.72, 0, 1] }}
                  className="bg-white/[0.03] border border-white/[0.06] p-4 rounded-2xl flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.accent}10`, borderColor: `${item.accent}20` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.accent }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-foreground/90 truncate">{item.label}</div>
                    <div className="text-[10px] text-foreground/40 truncate">{item.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="bg-primary/[0.05] border border-primary/15 p-5 rounded-2xl flex items-start gap-4">
            <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-[#0f1118]" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-foreground/90 text-[13px]">Регистрация</h4>
              <p className="text-[11px] text-foreground/50 leading-relaxed">Стойка у главного входа. Получите бейдж и стартовый пакет до 10:00 первого дня.</p>
            </div>
          </section>
        </div>
      )}

      {/* Filters + content */}
      {!isMapTab && <div className="px-5 pt-4 space-y-4">
        {/* Download all — only in "Мои" tab */}
        {selectedDayId === MY_TAB_ID && registeredIds.length > 0 && (
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
            className="flex items-center justify-center gap-2 bg-accent/[0.08] border border-accent/20 text-accent py-3 rounded-2xl text-[12px] font-semibold active:scale-[0.98] transition-transform w-full"
          >
            <Download className="w-4 h-4" />
            Скачать всё в календарь
          </button>
        )}

        {/* Combined filter row: halls + tracks */}
        <div className="space-y-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
            {[{ id: 'all', name: 'Все залы' }, ...HALLS.map(h => ({ id: h.id, name: h.name }))].map((h) => (
              <button
                key={h.id}
                onClick={() => setActiveHallId(h.id)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all',
                  activeHallId === h.id
                    ? 'bg-white/90 text-[#0f1118]'
                    : 'text-foreground/35 border border-white/[0.08]',
                )}
              >
                {h.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
            {[{ id: 'all', name: 'Все', color: '#00ffff' }, ...TRACKS.map(t => ({ id: t.id, name: t.shortLabel || t.name, color: t.color }))].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTrackId(t.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all',
                  activeTrackId === t.id ? 'text-[#0f1118]' : 'text-foreground/35 border border-white/[0.06]',
                )}
                style={activeTrackId === t.id ? { backgroundColor: t.color, boxShadow: `0 0 12px ${t.color}44` } : undefined}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Session cards — clean timeline design */}
        <div className="space-y-3 pt-1">
          {filteredSessions.map((session, idx) => {
            const track = getTrackById(session.trackId);
            const trackColor = track?.color ?? '#00ffff';
            const isRegistered = registeredIds.includes(session.id);
            const isCommonFormat = session.format === 'break' || session.format === 'opening' || session.format === 'closing';
            const formatLabel = session.format === 'workshop' ? 'Воркшоп' : session.format === 'panel' ? 'Панель' : session.format === 'keynote' ? 'Keynote' : session.format === 'break' ? 'Перерыв' : 'Доклад';

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  'rounded-2xl border p-4 space-y-3 relative overflow-hidden transition-all',
                  isRegistered
                    ? 'bg-primary/[0.06] border-primary/25'
                    : 'bg-card/80 border-white/[0.06]',
                )}
              >
                {/* Track color accent line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ backgroundColor: trackColor }}
                />

                {/* Time + status row */}
                <div className="flex items-center justify-between pl-3">
                  <span className="font-mono text-[13px] font-semibold text-foreground/70 tracking-tight">
                    {session.startTime}–{session.endTime}
                  </span>
                  <div className="flex items-center gap-2">
                    {session.status === 'Live' && (
                      <span className="bg-red-500/15 text-red-400 text-[9px] font-bold px-2.5 py-1 rounded-full border border-red-500/20 uppercase tracking-wider animate-pulse">
                        Live
                      </span>
                    )}
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                      style={{ color: trackColor, backgroundColor: `${trackColor}15` }}
                    >
                      {formatLabel}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-[15px] font-bold leading-snug text-foreground/95 pl-3">
                  {session.title}
                </h3>

                {/* Speaker + location row */}
                {session.speakerIds.length > 0 && (
                  <div className="flex items-center justify-between pl-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: `${trackColor}20`, color: trackColor }}
                      >
                        {session.speakerName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-[12px] font-semibold text-foreground/70 truncate">{session.speakerName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-foreground/35 text-[11px] shrink-0">
                      <MapPin className="w-3 h-3" />
                      <span>{session.location}</span>
                    </div>
                  </div>
                )}

                {/* Track + actions */}
                {!isCommonFormat && (
                  <div className="flex items-center justify-between pl-3 pt-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: `${trackColor}99` }}
                    >
                      {session.track}
                    </span>
                    <div className="flex gap-2 items-center">
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
                        title="В календарь"
                        className="p-2 rounded-lg border border-white/[0.06] text-foreground/30 hover:text-accent hover:border-accent/30 transition-all"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRegisterClick(session)}
                        className={cn(
                          'text-[11px] font-bold py-2 px-5 rounded-xl transition-all active:scale-95',
                          isRegistered
                            ? 'bg-primary/15 border border-primary/30 text-primary'
                            : 'bg-primary text-primary-foreground shadow-md shadow-primary/20',
                        )}
                      >
                        {isRegistered ? 'Иду ✓' : 'Пойду'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {filteredSessions.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto">
              {selectedDayId === MY_TAB_ID ? <Calendar className="w-7 h-7 text-foreground/15" /> : <Filter className="w-7 h-7 text-foreground/15" />}
            </div>
            <p className="text-foreground/35 text-[13px] font-medium">
              {selectedDayId === MY_TAB_ID
                ? 'Вы ещё не записались ни на одну сессию'
                : selectedDayId === RECOMMENDED_TAB_ID
                  ? 'Нет рекомендаций — попробуй выбрать больше интересов'
                  : 'Нет докладов по фильтрам'}
            </p>
          </div>
        )}
      </div>}

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
              className="w-full max-w-sm bg-background border border-amber-500/30 rounded-[2rem] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-base font-black text-foreground tracking-tight">Конфликт времени</h2>
                </div>
                <button
                  onClick={() => setConflictTarget(null)}
                  className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-foreground/40 hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-[13px] text-foreground/75 leading-relaxed">
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
                  className="flex-1 py-3 rounded-2xl bg-card border border-border text-[12px] font-semibold text-foreground/75 active:scale-[0.98]"
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
