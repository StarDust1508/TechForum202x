import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarPlus, Check, Clock3, Loader2, MapPin, RefreshCw, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router-dom';
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

function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

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
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{ requested: Session; conflicts: Session[] } | null>(null);
  const [searchParams] = useSearchParams();
  const dayScrollerRef = useRef<HTMLDivElement>(null);

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
  useEffect(() => {
    if (loading) return;
    const sessionId = searchParams.get('session');
    if (!sessionId) return;
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!targetSession) return;
    setSelectedDay(targetSession.dayId);
    setSelectedTrack('all');
    setHighlightedSessionId(sessionId);
    const scrollTimer = window.setTimeout(() => {
      const target = document.getElementById(`session-${sessionId}`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.focus({ preventScroll: true });
    }, 90);
    const highlightTimer = window.setTimeout(() => setHighlightedSessionId(null), 2_200);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [loading, searchParams, sessions]);
  useEffect(() => {
    const scroller = dayScrollerRef.current;
    const selected = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!scroller || !selected) return;
    selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedDay, days.length]);
  const speakerMap = useMemo(() => new Map(speakers.map((s) => [s.id, s])), [speakers]);
  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const dayMap = useMemo(() => new Map(days.map((day, index) => [day.id, { ...day, index }])), [days]);
  const visible = useMemo(() => sessions
    .filter((s) => (selectedDay === MY ? registered.includes(s.id) : s.dayId === selectedDay))
    .filter((s) => selectedTrack === 'all' || s.trackId === selectedTrack)
    .sort((a, b) => selectedDay === MY
      ? ((dayMap.get(a.dayId)?.index ?? 999) - (dayMap.get(b.dayId)?.index ?? 999)) || a.startTime.localeCompare(b.startTime)
      : a.startTime.localeCompare(b.startTime)), [sessions, selectedDay, selectedTrack, registered, dayMap]);

  const persistLocalPlan = (ids: string[]) => {
    setRegistered(ids);
    try { localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(ids)); } catch { /* noop */ }
  };

  const addSession = async (session: Session, replaceConflicts = false) => {
    if (busySessionId) return;
    const localConflicts = sessions.filter((item) =>
      registered.includes(item.id) && item.id !== session.id && item.dayId === session.dayId &&
      timeRangesOverlap(session.startTime, session.endTime, item.startTime, item.endTime));
    if (!replaceConflicts && localConflicts.length > 0) {
      setPendingConflict({ requested: session, conflicts: localConflicts });
      return;
    }
    setBusySessionId(session.id);
    const res = await authFetch(resolveApiUrl(`/sessions/${encodeURIComponent(session.id)}/register`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replaceConflicts }),
    }).catch(() => null);
    if (res?.status === 409) {
      const payload = await res.json().catch(() => null);
      const conflictIds = Array.isArray(payload?.conflicts) ? payload.conflicts.map((item: { id?: string }) => item.id).filter(Boolean) : [];
      const conflictSessions = sessions.filter((item) => conflictIds.includes(item.id));
      setPendingConflict({ requested: session, conflicts: conflictSessions.length > 0 ? conflictSessions : localConflicts });
      setBusySessionId(null);
      return;
    }
    // В гостевом режиме сервер отвечает 401 — план остаётся локальным, но всё
    // равно соблюдает правило «одно событие в один момент времени».
    if (res?.ok || res?.status === 401) {
      const withoutConflicts = replaceConflicts ? registered.filter((id) => !localConflicts.some((item) => item.id === id)) : registered;
      persistLocalPlan(Array.from(new Set([...withoutConflicts, session.id])));
      setPendingConflict(null);
    }
    setBusySessionId(null);
  };

  const toggle = async (id: string) => {
    const active = registered.includes(id);
    const session = sessions.find((item) => item.id === id);
    if (!session) return;
    if (!active) { await addSession(session); return; }
    if (busySessionId) return;
    const previous = registered;
    const next = previous.filter((value) => value !== id);
    persistLocalPlan(next);
    setBusySessionId(id);
    const res = await authFetch(resolveApiUrl(`/sessions/${encodeURIComponent(id)}/register`), { method: 'DELETE', credentials: 'include' }).catch(() => null);
    // 401 = гостевой режим: локальный план остаётся рабочим. Иные серверные
    // ошибки откатываем, чтобы авторизованный пользователь не видел ложный sync.
    if (res && !res.ok && res.status !== 401) {
      persistLocalPlan(previous);
    }
    setBusySessionId(null);
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-[44rem] pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="px-4 pb-4 pt-3 min-[360px]:px-5"><div className="flex items-start gap-3"><BackButton /><div className="min-w-0"><h1 className="font-display text-[clamp(25px,7vw,30px)] font-bold leading-none">Программа</h1><p className="mt-2 text-[13px] leading-snug text-foreground/60">Выберите день и тему. Добавляйте выступления в личный план.</p></div></div>
          <div ref={dayScrollerRef} className="-mx-4 mt-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 scroll-px-4 scrollbar-hide min-[360px]:-mx-5 min-[360px]:px-5 min-[360px]:scroll-px-5" aria-label="Дни программы">{days.map((day) => <button type="button" key={day.id} aria-pressed={selectedDay === day.id} onClick={() => setSelectedDay(day.id)} className={`min-h-12 min-w-[118px] snap-start rounded-2xl border px-4 py-2.5 text-left whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${selectedDay === day.id ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground/70'}`}><span className="block text-[13px] font-bold">{day.label}</span><span className="mt-0.5 block text-[12px] opacity-75">{day.weekday}</span></button>)}<button type="button" aria-pressed={selectedDay === MY} onClick={() => { setSelectedDay(MY); setSelectedTrack('all'); }} className={`min-h-12 min-w-[118px] snap-start rounded-2xl border px-4 py-2.5 text-[13px] font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 ${selectedDay === MY ? 'border-accent bg-accent text-[#0f1118]' : 'border-border bg-card text-foreground/70'}`}>Мой план · {registered.length}</button></div>
          {selectedDay === MY ? (
            <p className="mt-2 text-[12px] leading-relaxed text-foreground/50">Личный план автоматически собран по дням и времени. Пересекающиеся события добавить нельзя.</p>
          ) : (
            <>
              <p className="mt-1 text-[12px] text-foreground/45">Ленту дней и тем можно листать горизонтально.</p>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide min-[360px]:-mx-5 min-[360px]:px-5" aria-label="Темы программы"><button type="button" aria-pressed={selectedTrack === 'all'} onClick={() => setSelectedTrack('all')} className={`min-h-11 rounded-xl border px-3 py-2 text-[13px] font-bold ${selectedTrack === 'all' ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground/65'}`}>Все темы</button>{tracks.map((track) => <button type="button" key={track.id} aria-pressed={selectedTrack === track.id} onClick={() => setSelectedTrack(track.id)} className={`min-h-11 rounded-xl border px-3 py-2 text-[13px] font-bold whitespace-nowrap ${selectedTrack === track.id ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground/65'}`}>{track.shortLabel}</button>)}</div>
            </>
          )}
        </div>
      </header>

      <main className="px-4 pt-5 min-[360px]:px-5">
        {stale && !error && <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-[14px] leading-snug text-amber-100">Нет соединения — показываем последнюю сохранённую программу.</div>}
        {loading && <div className="py-20 text-center" role="status"><Loader2 className="mx-auto h-7 w-7 animate-spin text-accent" /><p className="mt-3 text-[14px] text-foreground/60">Загружаем актуальную программу…</p></div>}
        {error && <div className="rounded-3xl border border-primary/25 bg-card p-6 text-center"><p className="text-base text-foreground/70">{error}</p><button type="button" onClick={load} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[14px] font-bold text-white"><RefreshCw className="w-4 h-4" />Повторить</button></div>}
        {!loading && !error && visible.length === 0 && <div className="rounded-3xl border border-dashed border-border p-8 text-center"><CalendarPlus className="mx-auto h-8 w-8 text-foreground/35" /><p className="mt-3 text-[15px] text-foreground/65">{selectedDay === MY ? 'Добавьте нужные сессии в свой план.' : 'По этому фильтру сессий нет.'}</p></div>}
        <div className="space-y-3">{visible.map((session, index) => {
          const track = session.trackId ? trackMap.get(session.trackId) : undefined;
          const people = session.speakerIds.map((id) => speakerMap.get(id)).filter(Boolean) as Speaker[];
          const saved = registered.includes(session.id);
          const formatLabel = FORMAT_LABELS[session.format] || session.format;
          // A session can be added to the personal plan even while its speaker
          // card is still being published. Hiding the action when speakerIds
          // were temporarily empty made real programme items look inactive.
          const passive = BREAK_FORMATS.has(formatLabel);
          const showDayHeading = selectedDay === MY && (index === 0 || visible[index - 1]?.dayId !== session.dayId);
          return <div key={session.id} className="space-y-3">
            {showDayHeading && <div className="flex items-center gap-3 pt-3"><span className="h-px flex-1 bg-border" /><h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-foreground/65">{dayMap.get(session.dayId)?.label || 'День программы'}</h2><span className="h-px flex-1 bg-border" /></div>}
          <motion.article id={`session-${session.id}`} tabIndex={-1} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .02, .18), duration: .22 }} className={`relative overflow-hidden rounded-3xl border p-5 outline-none transition-[border-color,background-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-primary/70 ${highlightedSessionId === session.id ? 'border-accent bg-accent/[0.08] shadow-[0_0_0_3px_rgba(0,255,255,0.14)]' : saved ? 'border-primary/40 bg-primary/[0.06]' : 'border-border bg-card'}`}>
            <div className={`absolute inset-y-0 left-0 w-1 ${saved ? 'bg-primary' : 'bg-accent/55'}`} />
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-[14px] font-bold text-foreground/75"><Clock3 className="h-4 w-4 text-accent" />{session.startTime}–{session.endTime}</div><span className="rounded-lg bg-foreground/[0.06] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground/65">{formatLabel}</span></div>
            <h2 className="mt-4 font-display text-[19px] font-bold leading-snug text-foreground">{session.title}</h2>
            {session.description && <p className="mt-2 text-[15px] leading-relaxed text-foreground/65">{session.description}</p>}
            {people.length > 0 && <div className="mt-4 space-y-2">{people.slice(0, 5).map((person) => <Link to={`/speakers/${person.id}`} key={person.id} className="flex min-h-12 items-center gap-3 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><div className="h-10 w-10 overflow-hidden rounded-xl border border-border">{person.avatarUrl ? <img src={resolveAssetUrl(person.avatarUrl)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[12px] font-bold text-primary">{person.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>}</div><div className="min-w-0"><p className="text-[14px] font-bold leading-snug">{person.name}</p><p className="text-[13px] leading-snug text-foreground/55">{person.company || person.role}</p></div></Link>)}</div>}
            <div className="mt-5 flex flex-col gap-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"><div className="flex min-w-0 items-center gap-1.5 text-[13px] text-foreground/60"><MapPin className="h-4 w-4 shrink-0" /><span>{session.location || 'Главный зал'}</span>{people.length > 1 && <><Users className="ml-2 h-4 w-4 shrink-0" />{people.length}</>}</div>{!passive && <button type="button" disabled={busySessionId === session.id} aria-pressed={saved} onClick={() => void toggle(session.id)} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:opacity-60 ${saved ? 'border border-primary/40 bg-primary/10 text-primary' : 'bg-primary text-white shadow-[0_8px_24px_rgba(255,51,153,.18)]'}`}>{busySessionId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}{saved ? 'В плане' : 'Добавить в план'}</button>}</div>
          </motion.article></div>;
        })}</div>
      </main>

      {pendingConflict && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/65 p-3 backdrop-blur-sm min-[480px]:items-center" role="presentation" onClick={() => setPendingConflict(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="schedule-conflict-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-2xl" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><AlertTriangle className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 id="schedule-conflict-title" className="font-display text-[19px] font-bold">В это время уже есть событие</h2><p className="mt-1 text-[14px] leading-relaxed text-foreground/60">Чтобы план оставался выполнимым, замените пересекающееся выступление.</p></div><button type="button" aria-label="Закрыть" onClick={() => setPendingConflict(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"><X className="h-4 w-4" /></button></div>
          <div className="mt-4 space-y-2">{pendingConflict.conflicts.map((item) => <div key={item.id} className="rounded-2xl border border-border bg-card p-4"><p className="text-[13px] font-semibold text-foreground/55">{item.startTime}–{item.endTime}</p><p className="mt-1 text-[15px] font-bold leading-snug">{item.title}</p></div>)}</div>
          <div className="mt-5 grid gap-2 min-[360px]:grid-cols-2"><button type="button" onClick={() => setPendingConflict(null)} className="min-h-12 rounded-xl border border-border px-4 text-[14px] font-bold">Оставить текущий план</button><button type="button" disabled={busySessionId !== null} onClick={() => void addSession(pendingConflict.requested, true)} className="min-h-12 rounded-xl bg-primary px-4 text-[14px] font-bold text-white disabled:opacity-60">Заменить событие</button></div>
        </section>
      </div>}
    </div>
  );
}
