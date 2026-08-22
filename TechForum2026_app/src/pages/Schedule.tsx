import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Check, Clock3, Loader2, MapPin, Mic2, RefreshCw, Users } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { authFetch, resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import { fetchCachedJson } from '@/src/lib/cachedPublicApi';

interface Day { id: string; label: string; weekday: string; }
interface Track { id: string; name: string; shortLabel: string; color: string; }
interface Speaker { id: string; name: string; role: string; company: string; avatarUrl?: string | null; }
interface Session { id: string; title: string; description: string; startTime: string; endTime: string; format: string; dayId: string; trackId?: string | null; speakerIds: string[]; speakerName: string; location: string; }

const MY = 'my';
const LOCAL_PLAN_KEY = 'techforum_local_plan';
const BREAK_FORMATS = new Set(['Перерыв', 'Регистрация', 'Нетворкинг', 'Открытие', 'Закрытие']);
const FORMAT_LABELS: Record<string, string> = { break: 'Перерыв', opening: 'Открытие', closing: 'Закрытие', talk: 'Доклад', panel: 'Дискуссия', keynote: 'Keynote', workshop: 'Практикум' };

export default function Schedule() {
  const [days, setDays] = useState<Day[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registered, setRegistered] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTrack, setSelectedTrack] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [dayResult, trackResult, speakerResult, sessionResult, registeredRes] = await Promise.all([
        fetchCachedJson<Day[]>('/days'), fetchCachedJson<Track[]>('/tracks'), fetchCachedJson<Speaker[]>('/speakers'),
        fetchCachedJson<Session[]>('/sessions'), authFetch(resolveApiUrl('/sessions/registered'), { credentials: 'include' }).catch(() => null),
      ]);
      const nextDays = dayResult.data, nextTracks = trackResult.data, nextSpeakers = speakerResult.data, nextSessions = sessionResult.data;
      setStale([dayResult, trackResult, speakerResult, sessionResult].some((x) => x.stale));
      setDays(nextDays); setTracks(nextTracks); setSpeakers(nextSpeakers); setSessions(nextSessions);
      setSelectedDay((current) => current || nextDays[0]?.id || '');
      if (registeredRes?.ok) {
        const mine = await registeredRes.json();
        const ids = Array.isArray(mine?.sessionIds) ? mine.sessionIds : [];
        setRegistered(ids);
        try { localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(ids)); } catch { /* noop */ }
      } else {
        try {
          const local = JSON.parse(localStorage.getItem(LOCAL_PLAN_KEY) || '[]');
          if (Array.isArray(local)) setRegistered(local.filter((id): id is string => typeof id === 'string'));
        } catch { /* corrupted local plan */ }
      }
    } catch { setError('Не удалось загрузить актуальную программу. Проверьте соединение.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  const speakerMap = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const visible = useMemo(() => sessions
    .filter((s) => (selectedDay === MY ? registered.includes(s.id) : s.dayId === selectedDay))
    .filter((s) => selectedTrack === 'all' || s.trackId === selectedTrack)
    .sort((a, b) => a.startTime.localeCompare(b.startTime)), [sessions, selectedDay, selectedTrack, registered]);

  const toggle = async (id: string) => {
    const active = registered.includes(id);
    const next = active ? registered.filter((value) => value !== id) : [...registered, id];
    setRegistered(next);
    try { localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(next)); } catch { /* noop */ }
    const res = await authFetch(resolveApiUrl(`/sessions/${encodeURIComponent(id)}/register`), { method: active ? 'DELETE' : 'POST', credentials: 'include' }).catch(() => null);
    // 401 = гостевой режим: локальный план остаётся рабочим. Иные серверные
    // ошибки откатываем, чтобы авторизованный пользователь не видел ложный sync.
    if (res && !res.ok && res.status !== 401) {
      setRegistered(registered);
      try { localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(registered)); } catch { /* noop */ }
    }
  };

  return (
    <div className="min-h-full pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="px-5 pt-3 pb-4"><div className="flex items-center gap-3"><BackButton /><div><h1 className="font-display text-[27px] font-bold">Программа</h1><p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-foreground/40">Один маршрут · без гонки между залами</p></div></div>
          <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5">{days.map((day) => <button key={day.id} onClick={() => setSelectedDay(day.id)} className={`rounded-xl px-4 py-2.5 text-left whitespace-nowrap border ${selectedDay === day.id ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground/55'}`}><span className="block text-[11px] font-bold">{day.label}</span><span className="block text-[9px] opacity-65">{day.weekday}</span></button>)}<button onClick={() => setSelectedDay(MY)} className={`rounded-xl px-4 py-2.5 text-[11px] font-bold whitespace-nowrap border ${selectedDay === MY ? 'border-accent bg-accent text-[#0f1118]' : 'border-border bg-card text-foreground/55'}`}>Мой план · {registered.length}</button></div>
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5"><button onClick={() => setSelectedTrack('all')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${selectedTrack === 'all' ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground/45'}`}>Все темы</button>{tracks.map((track) => <button key={track.id} onClick={() => setSelectedTrack(track.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold border whitespace-nowrap" style={selectedTrack === track.id ? { backgroundColor: track.color, borderColor: track.color, color: '#0f1118' } : { borderColor: `${track.color}38`, color: track.color }}>{track.shortLabel}</button>)}</div>
        </div>
      </header>

      <main className="px-5 pt-5">
        {stale && !error && <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-[11px] text-amber-200">Нет соединения — показываем последнюю сохранённую программу.</div>}
        {loading && <div className="py-20 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-accent" /><p className="mt-3 text-[12px] text-foreground/40">Загружаем актуальную программу…</p></div>}
        {error && <div className="rounded-2xl border border-primary/25 bg-card p-6 text-center"><p className="text-[13px] text-foreground/60">{error}</p><button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-white"><RefreshCw className="w-4 h-4" />Повторить</button></div>}
        {!loading && !error && visible.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center"><CalendarPlus className="w-8 h-8 mx-auto text-foreground/25" /><p className="mt-3 text-[13px] text-foreground/50">{selectedDay === MY ? 'Добавьте нужные сессии в свой план.' : 'По этому фильтру сессий нет.'}</p></div>}
        <div className="space-y-3">{visible.map((session, index) => {
          const track = session.trackId ? trackMap.get(session.trackId) : undefined;
          const color = track?.color || '#00ffff';
          const people = session.speakerIds.map((id) => speakerMap.get(id)).filter(Boolean) as Speaker[];
          const saved = registered.includes(session.id);
          const formatLabel = FORMAT_LABELS[session.format] || session.format;
          const passive = BREAK_FORMATS.has(formatLabel) || people.length === 0;
          return <motion.article key={session.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .25) }} className={`relative overflow-hidden rounded-2xl border p-5 ${saved ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-card'}`}>
            <div className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: color }} />
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2 font-mono text-[12px] font-bold text-foreground/65"><Clock3 className="w-4 h-4" style={{ color }} />{session.startTime}–{session.endTime}</div><span className="rounded-md px-2 py-1 text-[9px] font-bold uppercase" style={{ color, backgroundColor: `${color}14` }}>{formatLabel}</span></div>
            <h2 className="mt-4 font-display text-[15px] font-bold leading-snug text-foreground">{session.title}</h2>
            {session.description && <p className="mt-2 text-[11px] leading-relaxed text-foreground/45">{session.description}</p>}
            {people.length > 0 && <div className="mt-4 space-y-2">{people.slice(0, 5).map((person) => <div key={person.id} className="flex items-center gap-3"><div className="w-9 h-9 overflow-hidden rounded-xl border" style={{ borderColor: `${color}55` }}>{person.avatarUrl ? <img src={resolveAssetUrl(person.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold" style={{ color }}>{person.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>}</div><div className="min-w-0"><p className="text-[12px] font-bold truncate">{person.name}</p><p className="text-[10px] text-foreground/40 truncate">{person.company || person.role}</p></div></div>)}</div>}
            <div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-1.5 text-[10px] text-foreground/35"><MapPin className="w-3.5 h-3.5" />{session.location || 'Главный зал'}{people.length > 1 && <><Users className="w-3.5 h-3.5 ml-2" />{people.length} эксперта</>}</div>{!passive && <button onClick={() => toggle(session.id)} className={`rounded-xl px-4 py-2 text-[10px] font-bold inline-flex items-center gap-1.5 ${saved ? 'border border-primary/30 text-primary' : 'bg-primary text-white'}`}>{saved ? <Check className="w-3.5 h-3.5" /> : <Mic2 className="w-3.5 h-3.5" />}{saved ? 'В плане' : 'Добавить'}</button>}</div>
          </motion.article>;
        })}</div>
      </main>
    </div>
  );
}
