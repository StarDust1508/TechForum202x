// FILE: src/pages/MyRecords.tsx
// VERSION: 3.0.0 — две вкладки: Сессии + Розыгрыши

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarCheck2, Clock3, MapPin, Download, Trophy, Award, X, NotebookPen, Plus, Trash2, Edit3 } from 'lucide-react';
import { DAYS, getDayById } from '../data';
import { useSessions } from '@/src/lib/programData';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import Button from '@/src/components/ui/Button';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { GIVEAWAYS, LS_KEY as GIVEAWAYS_LS_KEY, readJoinedGiveaways } from './Giveaways';
import { cn } from '@/src/lib/utils';

// === NOTES (server-backed) ===
// Хранятся на сервере (notes table, /notes endpoints) — переживают
// переустановку, sync между устройствами, видны после re-login.
// Раньше был localStorage — раунд 2 (ЧЕСТНОСТЬ) перевёл на API.
// title — первая непустая строка body, body-только — UI-конвенция.
type Note = { id: string; body: string; updatedAt: number };
function noteTitle(n: Note): string {
  const firstLine = n.body.split('\n').find((l) => l.trim().length > 0);
  return (firstLine || 'Без названия').slice(0, 80);
}
function noteBody(n: Note): string {
  const lines = n.body.split('\n');
  const idxFirst = lines.findIndex((l) => l.trim().length > 0);
  if (idxFirst < 0) return '';
  return lines.slice(idxFirst + 1).join('\n').trim();
}

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

type Tab = 'sessions' | 'giveaways' | 'notes';

export default function MyRecords() {
  const { data: SESSIONS } = useSessions();
  const [tab, setTab] = useState<Tab>('sessions');
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [joinedGiveaways, setJoinedGiveaways] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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

  // Notes — fetch с сервера при первом заходе на таб (lazy).
  useEffect(() => {
    if (tab !== 'notes') return;
    let cancelled = false;
    setNotesLoading(true);
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/notes'), { credentials: 'include' });
        if (!r.ok) return;
        const arr: Array<{ id: string; body: string; updatedAt: string }> = await r.json();
        if (cancelled) return;
        setNotes(arr.map((n) => ({ id: n.id, body: n.body, updatedAt: new Date(n.updatedAt).getTime() })));
      } catch { /* offline — оставляем что есть */ } finally {
        if (!cancelled) setNotesLoading(false);
      }
    })();
    return () => { cancelled = true; };
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

  // Notes CRUD ===========================================
  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  // openNew: ID не генерим заранее — при сохранении сервер выдаст canonical id.
  // Используем sentinel '' для распознавания «новая vs existing».
  const openNew = () => {
    setEditingNote({ id: '', body: '', updatedAt: Date.now() });
    setDraftBody('');
  };
  const openExisting = (n: Note) => {
    setEditingNote(n);
    setDraftBody(n.body);
  };
  const saveNote = async () => {
    if (!editingNote || savingNote) return;
    const trimmed = draftBody.replace(/\s+$/g, '');
    if (!trimmed.trim()) {
      setEditingNote(null);
      return;
    }
    setSavingNote(true);
    try {
      if (!editingNote.id) {
        // POST /notes
        const r = await fetch(resolveApiUrl('/notes'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed }),
        });
        if (!r.ok) throw new Error(`create_failed_${r.status}`);
        const data: { id: string; body: string; updatedAt: string } = await r.json();
        setNotes((prev) => [{ id: data.id, body: data.body, updatedAt: new Date(data.updatedAt).getTime() }, ...prev]);
      } else {
        // PATCH /notes/:id
        const r = await fetch(resolveApiUrl(`/notes/${editingNote.id}`), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: trimmed }),
        });
        if (!r.ok) throw new Error(`update_failed_${r.status}`);
        const data: { id: string; body: string; updatedAt: string } = await r.json();
        setNotes((prev) => prev.map((p) =>
          p.id === data.id ? { id: data.id, body: data.body, updatedAt: new Date(data.updatedAt).getTime() } : p,
        ));
      }
      setEditingNote(null);
    } catch {
      // Не закрываем модалку при ошибке — юзер видит текст и может retry.
      // showToast'а тут нет (MyRecords не имеет его), используем alert-fallback.
      // eslint-disable-next-line no-alert
      alert('Не удалось сохранить заметку. Проверьте соединение.');
    } finally {
      setSavingNote(false);
    }
  };
  const deleteNote = async (id: string) => {
    // Optimistic delete с rollback при ошибке.
    const before = notes;
    setNotes((prev) => prev.filter((p) => p.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
    try {
      const r = await fetch(resolveApiUrl(`/notes/${id}`), {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error(`delete_failed_${r.status}`);
    } catch {
      setNotes(before);
      // eslint-disable-next-line no-alert
      alert('Не удалось удалить заметку. Проверьте соединение.');
    }
  };
  const formatNoteDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ' · ' +
           d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const subtitleText =
    tab === 'sessions'
      ? (registeredSessions.length > 0 ? `${registeredSessions.length} сессий в вашей программе` : undefined)
      : tab === 'giveaways'
        ? (myGiveaways.length > 0 ? `${myGiveaways.length} активных участий` : undefined)
        : (notes.length > 0 ? `${notes.length} ${notes.length === 1 ? 'заметка' : 'заметок'}` : undefined);

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
        <button
          onClick={() => setTab('notes')}
          className={cn(
            'flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-[0.16em] transition-all font-display-cyrl flex items-center justify-center gap-2',
            tab === 'notes'
              ? 'bg-[#4ec9c0]/15 text-[#4ec9c0] border border-[#4ec9c0]/55'
              : 'text-[#7aa8a4] border border-transparent',
          )}
        >
          <NotebookPen className="w-3.5 h-3.5" strokeWidth={1.8} />
          Заметки
          {notes.length > 0 && (
            <span className="font-mono text-[10px] text-[#4ec9c0]/85">· {notes.length}</span>
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

      {/* NOTES TAB */}
      {tab === 'notes' && (
        <>
          <button
            type="button"
            onClick={openNew}
            className="w-full flex items-center justify-center gap-2 border border-[#4ec9c0]/55 bg-[#0a2f38]/70 text-[#d8f0ee] py-3.5 rounded-[14px] text-[13px] font-semibold uppercase tracking-[0.14em] active:scale-[0.98] hover:border-[#4ec9c0]/80 transition-all font-display-cyrl"
          >
            <Plus className="w-4 h-4 text-[#4ec9c0]" strokeWidth={2} />
            Новая заметка
          </button>

          {notesLoading && notes.length === 0 ? (
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-4 space-y-2">
                  <Skeleton height={15} width="60%" />
                  <Skeleton height={11} width="90%" />
                  <Skeleton height={10} width="40%" />
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-[#4ec9c0]/25 bg-[#0a2f38]/30 p-8 text-center">
              <NotebookPen className="w-9 h-9 mx-auto text-[#4ec9c0]/60" strokeWidth={1.4} />
              <p className="mt-3 text-[#d8f0ee]/75">Здесь будут ваши заметки.</p>
              <p className="mt-1 text-[12px] text-[#7aa8a4]">
                Записывайте мысли, имена, контакты — синхронизируются с сервером и видны на любом вашем устройстве.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {sortedNotes.map((n) => {
                const preview = noteBody(n);
                return (
                  <article
                    key={n.id}
                    className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-4 active:scale-[0.99] transition-transform"
                  >
                    <button
                      type="button"
                      onClick={() => openExisting(n)}
                      className="w-full text-left space-y-1.5"
                    >
                      <h3 className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee] truncate">
                        {noteTitle(n)}
                      </h3>
                      {preview && (
                        <p className="text-[12px] text-[#d8f0ee]/70 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                          {preview}
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-[#7aa8a4]/85 uppercase tracking-widest pt-1">
                        {formatNoteDate(n.updatedAt)}
                      </p>
                    </button>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openExisting(n)}
                        aria-label="Редактировать"
                        className="h-8 w-8 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 text-[#4ec9c0] hover:bg-[#0a2f38]/70 active:scale-90 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" strokeWidth={1.8} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(n.id)}
                        aria-label="Удалить"
                        className="h-8 w-8 flex items-center justify-center rounded-[10px] border border-rose-500/35 text-rose-300 hover:bg-rose-500/10 active:scale-90 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Notes editor modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] flex flex-col bg-[#03161c]/96 backdrop-blur"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#4ec9c0]/22">
              <h2 className="font-display-cyrl text-[18px] font-semibold text-[#d8f0ee]">
                {editingNote.id ? 'Заметка' : 'Новая заметка'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                aria-label="Закрыть"
                className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 text-[#4ec9c0] hover:bg-[#0a2f38]/55 active:scale-90 transition-all"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
            <textarea
              autoFocus
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Заголовок на первой строке…&#10;&#10;Текст заметки…"
              className="flex-1 w-full bg-transparent text-[15px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/55 outline-none resize-none px-5 py-4 leading-relaxed font-ui"
            />
            <div
              className="px-5 pt-3 border-t border-[#4ec9c0]/22"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
            >
              <Button onClick={saveNote} disabled={savingNote}>
                {savingNote ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
