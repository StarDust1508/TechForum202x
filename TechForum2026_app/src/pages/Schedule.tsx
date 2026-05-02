// FILE: src/pages/Schedule.tsx
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Страница расписания форума — табы по дням, фильтры по залам и трекам,
//          регистрация на сессии в localStorage, цветовая кодировка трека.
// SCOPE: UI расписания + клиентская регистрация (без бэка).
// INPUT: SESSIONS, TRACKS, HALLS, DAYS из src/data.
// OUTPUT: JSX-страница.
// KEYWORDS: DOMAIN(8): ConferenceProgram; CONCEPT(7): FilterableList; TECH(6): React, Tailwind
// LINKS: READS_DATA_FROM(8): src/data.ts; WRITES_DATA_TO(5): localStorage
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему фильтры по hallId/trackId/dayId, а не по строкам?
// A: В v1 фильтр зала ломался из-за Cyrillic 'Зал А' vs Latin 'Зал A' рассинхрона.
//    Фильтры на ID гарантируют корректное сопоставление.
// Q: Почему bracket-of-truth для дня — id, а UI-лейбл — отдельно?
// A: Лейбл может локализоваться или измениться, ID остаётся стабильным якорем.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 - Переход на ID-based фильтрацию (DAYS/HALLS/TRACKS),
//                       добавлен трек-фильтр, цветовой бейдж трека на карточке,
//                       "Live"-бейдж переименован в "В ЭФИРЕ"]
// PREV_CHANGE_SUMMARY: [v1.0.0 - Хардкод '15 мая'/'16 мая', баг 'Зал A' Latin/Cyrillic]
// END_CHANGE_SUMMARY

import { SESSIONS, TRACKS, HALLS, DAYS, getTrackById } from '../data';
import { MapPin, Filter, Cpu, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import BackButton from '@/src/components/BackButton';

const MY_TAB_ID = 'my';

export default function Schedule() {
  const [selectedDayId, setSelectedDayId] = useState<string>(DAYS[0]?.id ?? '');
  const [activeHallId, setActiveHallId] = useState<string>('all');
  const [activeTrackId, setActiveTrackId] = useState<string>('all');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('techforum_registrations');
    if (stored) {
      try {
        setRegisteredIds(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load registrations', e);
      }
    }
  }, []);

  const toggleRegistration = (id: string) => {
    const updated = registeredIds.includes(id)
      ? registeredIds.filter(rid => rid !== id)
      : [...registeredIds, id];
    setRegisteredIds(updated);
    localStorage.setItem('techforum_registrations', JSON.stringify(updated));
  };

  // BUG_FIX_CONTEXT: v1 использовал s.location.includes(activeHall) с Cyrillic vs
  // Latin рассинхроном (например, 'Зал A' Latin в halls и 'Зал А' Cyrillic в data).
  // Сейчас сравниваем строго по hallId.
  const filteredSessions = SESSIONS.filter(s => {
    const isMyTab = selectedDayId === MY_TAB_ID;
    const isDayMatch = isMyTab ? registeredIds.includes(s.id) : s.dayId === selectedDayId;
    const isHallMatch = activeHallId === 'all' || s.hallId === activeHallId;
    const isTrackMatch = activeTrackId === 'all' || s.trackId === activeTrackId;
    return isDayMatch && isHallMatch && isTrackMatch;
  });

  return (
    <div className="flex-1 pb-24 pt-6 px-6 space-y-7 bg-tech-grid min-h-full relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent glow-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            ДАННЫЕ ГРАФИКА
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary">Расписание</h1>
        </div>

        {/* Day tabs — driven by DAYS from data.ts, plus "Мои записи" tab */}
        <div className="flex bg-[#13161f] p-1.5 rounded-[1.75rem] border border-card-border shadow-inner">
          {[
            ...DAYS.map(d => ({ id: d.id, label: d.label })),
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

        {/* Hall filter pills — by hallId */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все залы' }, ...HALLS.map(h => ({ id: h.id, name: h.name }))].map((h) => {
            const active = activeHallId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setActiveHallId(h.id)}
                className={cn(
                  'px-6 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap border uppercase tracking-widest leading-none',
                  active
                    ? 'bg-primary border-primary text-surface'
                    : 'bg-surface border-card-border text-muted/60',
                )}
              >
                {h.name}
              </button>
            );
          })}
        </div>

        {/* Track filter pills — color-coded by track */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {[{ id: 'all', name: 'Все треки', color: '#5eead4' }, ...TRACKS.map(t => ({ id: t.id, name: t.name, color: t.color }))].map((t) => {
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
            const trackColor = track?.color ?? '#5eead4';
            const isRegistered = registeredIds.includes(session.id);

            return (
              <div
                key={session.id}
                className="mb-5 bg-[#13161f]/40 backdrop-blur-xl border border-card-border p-6 rounded-3xl space-y-5 hover:border-accent/40 group relative overflow-hidden circuit-border"
              >
                {/* Track color bar */}
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

                <div className="pt-2 flex justify-between items-center bg-surface/30 -mx-6 -mb-6 px-6 py-4 border-t border-card-border/50">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest pl-2 border-l-2"
                    style={{ borderColor: trackColor, color: trackColor }}
                  >
                    {session.track}
                  </span>
                  {session.format !== 'break' && session.format !== 'opening' && session.format !== 'closing' && (
                    <button
                      onClick={() => toggleRegistration(session.id)}
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
                : 'Нет докладов по выбранным фильтрам'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

