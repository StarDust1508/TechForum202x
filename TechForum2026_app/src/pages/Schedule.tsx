import { motion, AnimatePresence } from 'motion/react';
import { SESSIONS } from '../data';
import { MapPin, Clock, Filter, Cpu, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState('15 мая');
  const [activeHall, setActiveHall] = useState('Все');
  const [activeTrack, setActiveTrack] = useState('Все');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);

  // Load registrations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('techforum_registrations');
    if (stored) {
      try {
        setRegisteredIds(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load registrations", e);
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

  const filteredSessions = SESSIONS.filter(s => {
    const isDayMatch = selectedDay === 'Мои записи' 
      ? registeredIds.includes(s.id)
      : s.day === selectedDay;
      
    const isHallMatch = activeHall === 'Все' || s.location.includes(activeHall);
    const isTrackMatch = activeTrack === 'Все' || s.track === activeTrack;
    
    return isDayMatch && isHallMatch && isTrackMatch;
  });

  const halls = ['Все', 'Главная сцена', 'Зал A', 'Зал B'];

  return (
    <div className="flex-1 pb-24 pt-6 px-6 space-y-8 bg-tech-grid min-h-full relative">
      <header className="space-y-6">
        <div className="space-y-1 relative">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent glow-accent" />
          <p className="italic text-accent text-sm tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            ДАННЫЕ ГРАФИКА
          </p>
          <h1 className="text-4xl font-extrabold tracking-tighter text-primary">Расписание</h1>
        </div>
        
        {/* Day Selector - Tactile/Human */}
        <div className="flex bg-[#13161f] p-1.5 rounded-[1.75rem] border border-card-border shadow-inner">
          {['15 мая', '16 мая', 'Мои записи'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedDay(tab)}
              className={cn(
                "flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest leading-none transition-all",
                selectedDay === tab 
                  ? "bg-accent text-surface shadow-xl shadow-accent/20" 
                  : "text-muted hover:text-primary"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Hall Selection Pills - Organic horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 -mx-6 px-6">
          {halls.map((hall) => (
            <button
              key={hall}
              onClick={() => setActiveHall(hall)}
              className={cn(
                "px-6 py-3 rounded-2xl text-[10px] font-black whitespace-nowrap border uppercase tracking-widest leading-none",
                activeHall === hall 
                  ? "bg-primary border-primary text-surface" 
                  : "bg-surface border-card-border text-muted/60"
              )}
            >
              {hall}
            </button>
          ))}
        </div>
      </header>

      {/* Sessions List */}
      <div className="space-y-5">
        <div>
          {filteredSessions.map((session, i) => (
            <div
              key={session.id}
              className="mb-5 bg-[#13161f]/40 backdrop-blur-xl border border-card-border p-6 rounded-3xl space-y-5 hover:border-accent/40 group relative overflow-hidden circuit-border"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-sm font-bold text-accent">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                  <span className="font-mono tracking-tighter text-primary/80">{session.startTime} — {session.endTime}</span>
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

              <div className="flex flex-wrap gap-5 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-surface border border-card-border flex items-center justify-center text-accent font-black text-[11px] shadow-sm">
                    {session.speakerName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary tracking-tight">{session.speakerName}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Основной трек</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted text-xs font-medium bg-surface/40 px-3 py-1.5 rounded-xl border border-card-border/50">
                  <MapPin className="w-3 h-3 text-accent" />
                  <span className="tracking-tight">{session.location}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center bg-surface/30 -mx-6 -mb-6 px-6 py-4 border-t border-card-border/50">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest border-l-2 border-accent pl-2">
                  {session.track}
                </span>
                <button 
                  onClick={() => toggleRegistration(session.id)}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest py-2.5 px-6 rounded-2xl shadow-lg transition-all active:scale-95",
                    registeredIds.includes(session.id)
                      ? "bg-card border border-accent/40 text-accent"
                      : "bg-accent text-surface shadow-accent/10 hover:brightness-110"
                  )}
                >
                  {registeredIds.includes(session.id) ? 'Уже иду' : 'Пойду'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredSessions.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-card border border-card-border rounded-3xl flex items-center justify-center mx-auto text-muted/30">
              {selectedDay === 'Мои записи' ? <Calendar className="w-8 h-8" /> : <Filter className="w-8 h-8" />}
            </div>
            <p className="text-muted font-medium">
              {selectedDay === 'Мои записи' 
                ? "Вы еще не записались ни на одну сессию" 
                : "Нет докладов по выбранным фильтрам"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
