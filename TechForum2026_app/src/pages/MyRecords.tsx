import { useMemo } from 'react';
import { CalendarCheck2, Clock3, MapPin } from 'lucide-react';
import { SESSIONS } from '../data';

function readRegistrations(): string[] {
  try {
    const raw = localStorage.getItem('techforum_registrations');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export default function MyRecords() {
  const registeredSessions = useMemo(() => {
    const ids = readRegistrations();
    return SESSIONS.filter((item) => ids.includes(item.id));
  }, []);

  return (
    <div className="flex-1 min-h-full px-6 pt-8 pb-10 space-y-6">
      <header className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent/85 font-semibold">Личный кабинет</p>
        <h1 className="font-elite text-4xl leading-none text-white">Мои записи</h1>
      </header>

      {registeredSessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.03] p-8 text-center">
          <CalendarCheck2 className="w-9 h-9 mx-auto text-white/55" />
          <p className="mt-3 text-white/75">Пока нет выбранных сессий в расписании.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {registeredSessions.map((session) => (
            <article key={session.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <h2 className="text-xl font-semibold text-white/95">{session.title}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-white/70">
                <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" />{session.startTime} - {session.endTime}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{session.location}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
