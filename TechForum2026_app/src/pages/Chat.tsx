// FILE: src/pages/Chat.tsx
// VERSION: 5.0.0 — DM-only (AI assistant removed)
// SCOPE: routes /chat (список переписок), /chat/:userId (диалог).
// AI-ассистент удалён по требованию заказчика.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search, Send, ChevronRight, Mic, Square, Image as ImageIcon, Video as VideoIcon,
  X as XIcon, ArrowLeft, Paperclip, Loader2, Camera,
} from 'lucide-react';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import PageShell from '@/src/components/ui/PageShell';
import AvatarImage from '@/src/components/ui/AvatarImage';

// ===== TYPES =====
type DmContact = {
  userId: string;
  name: string;
  role: string;
  avatar: string | null;
  lastText: string;
  lastAt: string;
  unread: number;
};
type ChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'audio' | 'video' | null;
  createdAt: string;
  /** True пока сообщение ещё не подтверждено сервером (optimistic). */
  pending?: boolean;
};

// ===== HELPERS =====
const formatTime = (iso: string): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const isUploadedAvatar = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/');

// ===== AVATAR =====
function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  const resolved = isUploadedAvatar(src) && src ? resolveAssetUrl(src) : null;
  return (
    <div
      className="relative rounded-full overflow-hidden flex items-center justify-center bg-[#0a2f38] border border-[#4ec9c0]/35 shrink-0"
      style={{ width: size, height: size }}
    >
      <AvatarImage src={resolved} name={name} className="h-full w-full" letterClassName="text-base" />
    </div>
  );
}

// ============================================================================
// CHAT LIST — главный экран /chat
// ============================================================================
function ChatList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<DmContact[]>([]);

  const fetchContacts = useCallback(async () => {
    try {
      const r = await fetch(resolveApiUrl('/messages/contacts'), { credentials: 'include' });
      if (!r.ok) return;
      const data: Array<{ userId: string; lastText: string; lastAt: string; unread: number; user: { name: string; role: string; avatar: string } | null }> = await r.json();
      setContacts(data.filter((c) => c.user).map((c) => ({
        userId: c.userId,
        name: c.user!.name,
        role: c.user!.role || 'Участник',
        avatar: c.user!.avatar,
        lastText: c.lastText,
        lastAt: c.lastAt,
        unread: c.unread,
      })));
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchContacts();
    const t = window.setInterval(() => { void fetchContacts(); }, 10_000);
    return () => window.clearInterval(t);
  }, [fetchContacts]);

  // Search debounce 350ms.
  useEffect(() => {
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(resolveApiUrl(`/users/search?q=${encodeURIComponent(searchQ.trim())}`), { credentials: 'include' });
        if (!r.ok) return;
        const arr: Array<{ id: string; name: string; role: string; avatar: string }> = await r.json();
        const exists = new Set(contacts.map((c) => c.userId));
        setSearchResults(arr.filter((u) => !exists.has(u.id)).map((u) => ({
          userId: u.id,
          name: u.name,
          role: u.role || 'Участник',
          avatar: u.avatar,
          lastText: '',
          lastAt: '',
          unread: 0,
        })));
      } catch { /* noop */ }
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchQ, contacts]);

  return (
    <PageShell kicker="Сообщения" title="Чат" subtitle="Переписки участников форума">
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7aa8a4]" strokeWidth={1.6} />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Найти участника"
          inputMode="search"
          className="w-full bg-[#0a2f38]/55 border border-[#4ec9c0]/40 rounded-2xl pl-11 pr-4 py-3 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/70 transition-colors font-blueprint"
        />
      </div>

      {searchResults.length > 0 && (
        <section className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7aa8a4] mb-2">Начать диалог</p>
          <div className="space-y-2">
            {searchResults.map((c) => (
              <button
                key={c.userId}
                onClick={() => navigate(`/chat/${c.userId}`)}
                className="w-full flex items-center gap-3 bg-[#0a2f38]/40 border border-[#4ec9c0]/22 p-3 rounded-2xl hover:border-[#4ec9c0]/45 active:scale-[0.99] transition-all text-left"
              >
                <Avatar name={c.name} src={c.avatar} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-display-cyrl text-[14px] font-semibold text-[#d8f0ee] truncate">{c.name}</p>
                  <p className="text-[11px] text-[#7aa8a4] truncate">{c.role}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7aa8a4] mb-2">Переписки</p>
        {loading && contacts.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-6">Загрузка…</p>
        )}
        {!loading && contacts.length === 0 && searchQ.trim().length < 2 && (
          <div className="text-center py-8 text-[13px] text-[#7aa8a4] leading-relaxed">
            Здесь появятся ваши переписки.<br />
            Найдите участника в поиске выше, чтобы начать.
          </div>
        )}
        <div className="space-y-2">
          {contacts.map((c) => (
            <button
              key={c.userId}
              onClick={() => navigate(`/chat/${c.userId}`)}
              className="w-full flex items-center gap-3 bg-[#0a2f38]/45 border border-[#4ec9c0]/30 p-3.5 rounded-2xl hover:border-[#4ec9c0]/55 active:scale-[0.99] transition-all text-left"
            >
              <Avatar name={c.name} src={c.avatar} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display-cyrl text-[14px] font-semibold text-[#d8f0ee] truncate">{c.name}</p>
                  <span className="text-[10px] text-[#7aa8a4] shrink-0">{formatTime(c.lastAt)}</span>
                </div>
                <p className="text-[12px] text-[#7aa8a4] truncate">{c.lastText || '—'}</p>
              </div>
              {c.unread > 0 && (
                <div className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#4ec9c0] text-[#03161c] text-[10px] font-bold flex items-center justify-center shrink-0">
                  {c.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

// ============================================================================
// DM ROOM — диалог с конкретным юзером
// ============================================================================
function DmRoom({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [contact, setContact] = useState<DmContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // /auth/me для определения fromMe
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
        if (r.ok) {
          const me = await r.json();
          if (alive) setMeId(me?.id ?? null);
        }
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, []);

  // Профиль собеседника (для header)
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(resolveApiUrl('/messages/contacts'), { credentials: 'include' });
        if (!r.ok) {
          if (alive) setContact({ userId, name: 'Участник', role: '', avatar: null, lastText: '', lastAt: '', unread: 0 });
          return;
        }
        const data: Array<{ userId: string; user: { name: string; role: string; avatar: string } | null }> = await r.json();
        const found = data.find((c) => c.userId === userId);
        if (alive) {
          setContact(found && found.user
            ? { userId, name: found.user.name, role: found.user.role || 'Участник', avatar: found.user.avatar, lastText: '', lastAt: '', unread: 0 }
            : { userId, name: 'Участник', role: '', avatar: null, lastText: '', lastAt: '', unread: 0 });
        }
      } catch {
        if (alive) setContact({ userId, name: 'Участник', role: '', avatar: null, lastText: '', lastAt: '', unread: 0 });
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Polling диалога каждые 4с (было 5с — чуть быстрее реакция).
  // Сохраняем pending-сообщения через id-merge: серверные подтянутся
  // c реальным id, локальные optimistic с временным `tmp_` остаются.
  const fetchDialog = useCallback(async () => {
    if (!meId) return;
    try {
      const r = await fetch(resolveApiUrl(`/messages/with/${userId}`), { credentials: 'include' });
      if (!r.ok) return;
      const arr: Array<{ id: string; fromUserId: string; text: string; mediaUrl: string | null; mediaType: 'image' | 'audio' | 'video' | null; createdAt: string }> = await r.json();
      const serverMsgs: ChatMessage[] = arr.map((m) => ({
        id: m.id,
        fromMe: m.fromUserId === meId,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        createdAt: m.createdAt,
      }));
      setMessages((prev) => {
        const pending = prev.filter((m) => m.pending);
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        const stillPending = pending.filter((m) => !serverIds.has(m.id));
        return [...serverMsgs, ...stillPending];
      });
    } catch { /* noop */ }
  }, [userId, meId]);

  useEffect(() => {
    if (!meId) return;
    void fetchDialog();
    const t = window.setInterval(() => { void fetchDialog(); }, 4_000);
    return () => window.clearInterval(t);
  }, [fetchDialog, meId]);

  // Auto-scroll вниз на новые сообщения
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // ====== Send: text or media ======
  const sendMessage = async (payload: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'audio' | 'video' }) => {
    if (sending) return;
    if (!payload.text && !payload.mediaUrl) return;
    setSending(true);
    const optimisticId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId, fromMe: true,
      text: payload.text || '',
      mediaUrl: payload.mediaUrl ?? null,
      mediaType: payload.mediaType ?? null,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const r = await fetch(resolveApiUrl('/messages'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: userId,
          text: payload.text || '',
          mediaUrl: payload.mediaUrl,
          mediaType: payload.mediaType,
        }),
      });
      if (!r.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        if (payload.text) setInput(payload.text);
      } else {
        const real = await r.json();
        setMessages((prev) => prev.map((m) => m.id === optimisticId
          ? { ...m, id: real.id, createdAt: real.createdAt, pending: false }
          : m,
        ));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      if (payload.text) setInput(payload.text);
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage({ text });
  };

  // ====== Media: file picker (image / video) ======
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePickFile = (accept: string) => {
    setAttachOpen(false);
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };
  const handleOpenCamera = () => {
    setAttachOpen(false);
    cameraInputRef.current?.click();
  };
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadAndSend(file);
  };

  // Optimistic media-bubble во время загрузки.
  const [uploading, setUploading] = useState<{ id: string; type: 'image' | 'audio' | 'video' } | null>(null);

  const uploadAndSend = async (blob: Blob | File) => {
    const placeholderId = `up_${Date.now()}`;
    const inferType = (mime: string): 'image' | 'audio' | 'video' =>
      mime.startsWith('image') ? 'image' : mime.startsWith('audio') ? 'audio' : 'video';
    const guessedType = inferType(blob.type || '');
    setUploading({ id: placeholderId, type: guessedType });
    setMessages((prev) => [...prev, {
      id: placeholderId, fromMe: true, text: '',
      mediaUrl: null, mediaType: guessedType,
      createdAt: new Date().toISOString(), pending: true,
    }]);

    const fd = new FormData();
    const f = blob instanceof File ? blob : new File([blob], 'media', { type: blob.type || 'application/octet-stream' });
    fd.append('file', f);
    try {
      const r = await fetch(resolveApiUrl('/messages/upload-media'), {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        // eslint-disable-next-line no-alert
        alert(err.error === 'unsupported_mime' ? 'Формат не поддерживается' : `Загрузка не удалась: ${err.error || r.status}`);
        return;
      }
      const data: { url: string; type: 'image' | 'audio' | 'video' } = await r.json();
      // Удаляем placeholder, посылаем реальное сообщение.
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      await sendMessage({ mediaUrl: data.url, mediaType: data.type });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      // eslint-disable-next-line no-alert
      alert('Нет соединения');
    } finally {
      setUploading(null);
    }
  };

  // ====== Media: voice / video record via MediaRecorder ======
  const [recording, setRecording] = useState<null | 'audio' | 'video'>(null);
  const [recordSec, setRecordSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecord = async (kind: 'audio' | 'video') => {
    setAttachOpen(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'audio' ? { audio: true } : { audio: true, video: { width: 640, height: 480 } },
      );
      streamRef.current = stream;
      const mime = kind === 'audio'
        ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')
        : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4');
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) recorderChunks.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(recorderChunks.current, { type: mime });
        recorderChunks.current = [];
        if (streamRef.current) {
          for (const t of streamRef.current.getTracks()) t.stop();
          streamRef.current = null;
        }
        await uploadAndSend(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(kind);
      setRecordSec(0);
      recordTimer.current = setInterval(() => setRecordSec((s) => {
        if (s >= 59) { stopRecord(); return 60; }
        return s + 1;
      }), 1000);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Микрофон/камера недоступны: ${(err as Error).message || 'permission_denied'}`);
    }
  };

  const stopRecord = () => {
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(null);
  };

  const cancelRecord = () => {
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    recorderChunks.current = [];
    setRecording(null);
  };

  useEffect(() => () => {
    if (recordTimer.current) clearInterval(recordTimer.current);
    if (streamRef.current) for (const t of streamRef.current.getTracks()) t.stop();
  }, []);

  return (
    <div className="relative" style={{ minHeight: '100dvh' }}>
      {/*
        Header — fixed (не sticky), полностью покрывает safe-area сверху.
        Раньше был sticky внутри контейнера, который уже сам отступал на
        safe-area сверху, и над плашкой имени получался seam: solid-#03161c
        снаружи vs blurred-#03161c/85 внутри. Теперь header один solid слой
        от status-bar до его собственного нижнего края — без визуального
        конфликта.
      */}
      <header
        className="fixed left-0 right-0 top-0 z-30 bg-[#03161c] border-b border-[#4ec9c0]/22"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/chat')}
            aria-label="Назад"
            className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 bg-[#0a2f38]/55 text-[#4ec9c0] hover:bg-[#0a2f38]/80 active:scale-90 transition-all"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
          <Avatar name={contact?.name || ''} src={contact?.avatar} size={40} />
          <div className="flex-1 min-w-0">
            <p className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee] truncate">{contact?.name || 'Участник'}</p>
            <p className="text-[11px] text-[#7aa8a4] truncate">{contact?.role || ''}</p>
          </div>
        </div>
      </header>

      {/* Spacer под фиксированный header. 64px = py-2.5+content; safe-area
          добавляется от env(). */}
      <div style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }} />

      <div className="px-3 py-4 space-y-2" style={{ paddingBottom: '120px' }}>
        {messages.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-8">
            Сообщений пока нет.<br />Напишите первое.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`relative max-w-[80%] rounded-2xl text-[14px] leading-relaxed overflow-hidden ${
                m.fromMe
                  ? 'bg-[#4ec9c0] text-[#03161c] rounded-br-md shadow-[0_4px_14px_rgba(78,201,192,0.20)]'
                  : 'bg-[#0a2f38]/85 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
              } ${m.pending ? 'opacity-75' : ''}`}
            >
              {/* Pending media without URL — placeholder с лоадером */}
              {!m.mediaUrl && m.pending && m.mediaType && (
                <div className="w-44 h-32 flex items-center justify-center bg-[#03161c]/30">
                  <Loader2 className="w-6 h-6 animate-spin opacity-80" strokeWidth={1.6} />
                </div>
              )}
              {m.mediaUrl && m.mediaType === 'image' && (
                <button
                  type="button"
                  onClick={() => setLightbox(resolveAssetUrl(m.mediaUrl!))}
                  className="block w-full"
                >
                  <img
                    src={resolveAssetUrl(m.mediaUrl)}
                    alt=""
                    className="max-w-full max-h-72 object-cover"
                  />
                </button>
              )}
              {m.mediaUrl && m.mediaType === 'audio' && (
                <audio
                  src={resolveAssetUrl(m.mediaUrl)}
                  controls
                  preload="metadata"
                  className="block w-[260px] max-w-full px-2 pt-2 pb-1"
                />
              )}
              {m.mediaUrl && m.mediaType === 'video' && (
                <video
                  src={resolveAssetUrl(m.mediaUrl)}
                  controls
                  playsInline
                  preload="metadata"
                  className="block max-w-full max-h-72"
                />
              )}
              {(m.text || (!m.mediaUrl && !m.pending)) && (
                <div className={`px-3.5 py-2 ${m.mediaUrl ? 'pt-1.5' : ''}`}>
                  {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                </div>
              )}
              <div className={`flex items-center justify-end gap-1 px-3 pb-1.5 ${m.mediaUrl && !m.text ? 'absolute bottom-1 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5' : ''}`}>
                {m.pending && (
                  <Loader2 className={`w-3 h-3 animate-spin ${m.fromMe ? 'text-[#03161c]/70' : 'text-[#4ec9c0]/70'}`} strokeWidth={2} />
                )}
                <span className={`text-[10px] font-mono ${
                  m.fromMe
                    ? (m.mediaUrl && !m.text ? 'text-white/85' : 'text-[#03161c]/65')
                    : (m.mediaUrl && !m.text ? 'text-white/85' : 'text-[#7aa8a4]')
                }`}>
                  {formatTime(m.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden file inputs. Camera-input использует capture для прямого
          вызова системной камеры на Android, без галереи. */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelected} />

      {/* Bottom bar: либо input, либо запись */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30 bg-[#03161c] border-t border-[#4ec9c0]/22 px-3 py-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        {recording ? (
          <div className="flex items-center gap-3 py-2 px-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-display-cyrl text-[14px] text-[#d8f0ee]">
              {recording === 'audio' ? 'Запись аудио' : 'Запись видео'}
              <span className="font-mono ml-2">
                {String(Math.floor(recordSec / 60)).padStart(2, '0')}:{String(recordSec % 60).padStart(2, '0')}
              </span>
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={cancelRecord}
              className="h-10 w-10 flex items-center justify-center rounded-2xl border border-rose-400/40 text-rose-300 hover:bg-rose-500/10 active:scale-90 transition-all"
              aria-label="Отмена"
            >
              <XIcon className="w-4 h-4" strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={stopRecord}
              className="h-10 w-10 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90 transition-transform"
              aria-label="Стоп и отправить"
            >
              <Square className="w-4 h-4" strokeWidth={2} fill="currentColor" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAttachOpen((v) => !v)}
                className={`h-11 w-11 flex items-center justify-center rounded-2xl border transition-all active:scale-90 ${
                  attachOpen
                    ? 'bg-[#4ec9c0]/20 border-[#4ec9c0]/65 text-[#4ec9c0]'
                    : 'bg-[#0a2f38]/55 border-[#4ec9c0]/35 text-[#4ec9c0] hover:bg-[#0a2f38]/80'
                }`}
                aria-label="Прикрепить"
                aria-expanded={attachOpen}
              >
                <Paperclip className="w-4 h-4" strokeWidth={1.8} />
              </button>
              {attachOpen && (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-40 min-w-[200px] rounded-2xl border border-[#4ec9c0]/35 bg-[#03161c]/95 backdrop-blur-md p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
                  <AttachItem icon={ImageIcon} label="Фото из галереи" onClick={() => handlePickFile('image/*')} />
                  <AttachItem icon={Camera} label="Снять фото" onClick={handleOpenCamera} />
                  <AttachItem icon={VideoIcon} label="Видео из галереи" onClick={() => handlePickFile('video/*')} />
                  <AttachItem icon={Mic} label="Записать видео" onClick={() => startRecord('video')} />
                </div>
              )}
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Сообщение…"
              rows={1}
              className="flex-1 bg-[#0a2f38]/55 border border-[#4ec9c0]/35 rounded-2xl px-4 py-2.5 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/65 resize-none max-h-32 font-blueprint"
            />
            {input.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] disabled:opacity-40 active:scale-90 transition-transform shadow-[0_4px_14px_rgba(78,201,192,0.25)]"
                aria-label="Отправить"
              >
                <Send className="w-4 h-4" strokeWidth={1.8} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startRecord('audio')}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90 transition-transform shadow-[0_4px_14px_rgba(78,201,192,0.25)]"
                aria-label="Записать голосовое"
              >
                <Mic className="w-4 h-4" strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image lightbox — внутреннее full-screen viewer, не уходит в external браузер */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Закрыть"
            className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-[#03161c]/80 border border-[#4ec9c0]/40 text-[#d8f0ee] hover:bg-[#0a2f38]/95 transition-all"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <XIcon className="w-5 h-5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Невидимая прослойка для закрытия attach-popover тапом мимо */}
      {attachOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setAttachOpen(false)}
        />
      )}
    </div>
  );
}

function AttachItem({
  icon: Icon, label, onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] text-[#d8f0ee] hover:bg-[#0a2f38]/70 transition-colors font-blueprint"
    >
      <Icon className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />
      {label}
    </button>
  );
}

// ============================================================================
// ROUTER
// ============================================================================
export default function Chat() {
  const { userId } = useParams<{ userId?: string }>();
  if (!userId) return <ChatList />;
  return <DmRoom userId={userId} />;
}
