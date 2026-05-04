// FILE: src/pages/Chat.tsx
// VERSION: 4.0.0 — WhatsApp-style rewrite
// START_MODULE_CONTRACT:
// PURPOSE: Полностью функциональный мессенджер. Список переписок → диалог.
//          DM через /messages API (poll-based), AI-ассистент как отдельный
//          контакт через /ai/chat. Никаких 4-вкладок-в-одном-экране,
//          никаких mock contacts/messages, никакого audio/video-recording
//          (вернётся отдельной фичей если попросят).
// SCOPE: routes /chat (список), /chat/ai (AI), /chat/:userId (DM).
// END_MODULE_CONTRACT

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Search, Send, Bot, User as UserIcon, ChevronRight, Sparkles, Paperclip, Mic, Square, Image as ImageIcon, Video as VideoIcon, Play, Pause, X as XIcon, ArrowLeft } from 'lucide-react';
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
};

// ===== HELPERS =====
const formatTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const isUploadedAvatar = (url: string | null | undefined): boolean =>
  typeof url === 'string' && url.startsWith('/uploads/');

// ===== AVATAR =====
// Использует AvatarImage primitive (единая логика fallback на инициал
// при ошибке загрузки или отсутствии src). Раньше был свой inline-img
// с UserIcon, разная логика fallback в Profile/Chat — теперь общая.
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
    const t = setInterval(() => { void fetchContacts(); }, 10_000);
    return () => clearInterval(t);
  }, [fetchContacts]);

  // Search debounce 350ms.
  useEffect(() => {
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
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
    return () => clearTimeout(t);
  }, [searchQ, contacts]);

  return (
    <PageShell kicker="Сообщения" title="Чат" subtitle="Переписки и AI-ассистент форума">
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7aa8a4]" />
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Найти участника"
          className="w-full bg-[#0a2f38]/45 border border-[#4ec9c0]/28 rounded-2xl pl-11 pr-4 py-3 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/55"
        />
      </div>

      {/* AI assistant — pinned at top */}
      <Link
        to="/chat/ai"
        className="flex items-center gap-3 bg-[#0a2f38]/55 border border-[#4ec9c0]/35 p-4 rounded-2xl mb-3 hover:border-[#4ec9c0]/65 active:scale-[0.99] transition-all"
      >
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4ec9c0]/40 to-[#4ec9c0]/15 border border-[#4ec9c0]/55 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#4ec9c0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display-cyrl text-[15px] text-[#d8f0ee]">AI-ассистент TechForum</p>
          <p className="text-[12px] text-[#7aa8a4] truncate">Расскажет о программе, спикерах, поможет выбрать сессии</p>
        </div>
        <ChevronRight className="w-4 h-4 text-[#4ec9c0]" />
      </Link>

      {/* Search results */}
      {searchResults.length > 0 && (
        <section className="mb-3">
          <p className="text-[10px] uppercase tracking-widest text-[#7aa8a4] mb-2">Начать диалог</p>
          <div className="space-y-2">
            {searchResults.map((c) => (
              <button
                key={c.userId}
                onClick={() => navigate(`/chat/${c.userId}`)}
                className="w-full flex items-center gap-3 bg-[#0a2f38]/30 border border-[#4ec9c0]/15 p-3 rounded-2xl hover:border-[#4ec9c0]/40 transition-all text-left"
              >
                <Avatar name={c.name} src={c.avatar} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#d8f0ee] truncate">{c.name}</p>
                  <p className="text-[11px] text-[#7aa8a4] truncate">{c.role}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#4ec9c0]" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* DM contacts */}
      <section>
        <p className="text-[10px] uppercase tracking-widest text-[#7aa8a4] mb-2">Переписки</p>
        {loading && contacts.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-6">Загрузка…</p>
        )}
        {!loading && contacts.length === 0 && searchQ.trim().length < 2 && (
          <div className="text-center py-8 text-[13px] text-[#7aa8a4] leading-relaxed">
            Здесь появятся ваши переписки.<br/>
            Найдите участника в строке поиска, чтобы начать.
          </div>
        )}
        <div className="space-y-2">
          {contacts.map((c) => (
            <button
              key={c.userId}
              onClick={() => navigate(`/chat/${c.userId}`)}
              className="w-full flex items-center gap-3 bg-[#0a2f38]/40 border border-[#4ec9c0]/22 p-3.5 rounded-2xl hover:border-[#4ec9c0]/45 active:scale-[0.99] transition-all text-left"
            >
              <Avatar name={c.name} src={c.avatar} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#d8f0ee] truncate">{c.name}</p>
                  <span className="text-[10px] text-[#7aa8a4] shrink-0">{formatTime(c.lastAt)}</span>
                </div>
                <p className="text-[12px] text-[#7aa8a4] truncate">{c.lastText}</p>
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Получаем meId
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

  // Получаем профиль собеседника (для header)
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        // Берём из contacts (если уже переписывались) или ищем в /users/search
        const r = await fetch(resolveApiUrl('/messages/contacts'), { credentials: 'include' });
        if (!r.ok) return;
        const data: Array<{ userId: string; user: { name: string; role: string; avatar: string } | null }> = await r.json();
        const found = data.find((c) => c.userId === userId);
        if (found && found.user && alive) {
          setContact({
            userId,
            name: found.user.name,
            role: found.user.role || 'Участник',
            avatar: found.user.avatar,
            lastText: '', lastAt: '', unread: 0,
          });
          return;
        }
        // Не в contacts — пробуем /users/search точное совпадение по id
        // (для нового диалога). Бэк не имеет /users/:id, но search вернёт
        // если что-то совпадёт. Иначе — оставляем имя «Участник».
        if (alive) {
          setContact({
            userId, name: 'Участник', role: '', avatar: null,
            lastText: '', lastAt: '', unread: 0,
          });
        }
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Polling диалога каждые 5с.
  const fetchDialog = useCallback(async () => {
    if (!meId) return;
    try {
      const r = await fetch(resolveApiUrl(`/messages/with/${userId}`), { credentials: 'include' });
      if (!r.ok) return;
      const arr: Array<{ id: string; fromUserId: string; text: string; mediaUrl: string | null; mediaType: 'image' | 'audio' | 'video' | null; createdAt: string }> = await r.json();
      setMessages(arr.map((m) => ({
        id: m.id,
        fromMe: m.fromUserId === meId,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        createdAt: m.createdAt,
      })));
    } catch { /* noop */ }
  }, [userId, meId]);

  useEffect(() => {
    if (!meId) return;
    void fetchDialog();
    const t = setInterval(() => { void fetchDialog(); }, 5_000);
    return () => clearInterval(t);
  }, [fetchDialog, meId]);

  // Auto-scroll вниз на новые сообщения
  useEffect(() => {
    // body-scroll: прокручиваем окно вниз к новому сообщению.
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
          ? { ...m, id: real.id, createdAt: real.createdAt }
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
  const handlePickFile = (accept: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadAndSend(file);
  };
  const uploadAndSend = async (blob: Blob | File) => {
    const fd = new FormData();
    const f = blob instanceof File ? blob : new File([blob], 'media', { type: blob.type || 'application/octet-stream' });
    fd.append('file', f);
    try {
      const r = await fetch(resolveApiUrl('/messages/upload-media'), {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        // eslint-disable-next-line no-alert
        alert(err.error === 'unsupported_mime' ? 'Формат не поддерживается' : `Загрузка не удалась: ${err.error || r.status}`);
        return;
      }
      const data: { url: string; type: 'image' | 'audio' | 'video' } = await r.json();
      await sendMessage({ mediaUrl: data.url, mediaType: data.type });
    } catch {
      // eslint-disable-next-line no-alert
      alert('Нет соединения');
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
        // авто-стоп через 60 секунд
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
    // cleanup on unmount
    if (recordTimer.current) clearInterval(recordTimer.current);
    if (streamRef.current) for (const t of streamRef.current.getTracks()) t.stop();
  }, []);

  return (
    <div className="relative" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-b border-[#4ec9c0]/22 px-4 py-2.5 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <button
          onClick={() => navigate('/chat')}
          aria-label="Назад"
          className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 bg-[#03161c]/60 text-[#4ec9c0] active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <Avatar name={contact?.name || ''} src={contact?.avatar} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#d8f0ee] truncate">{contact?.name || 'Участник'}</p>
          <p className="text-[11px] text-[#7aa8a4] truncate">{contact?.role || ''}</p>
        </div>
      </header>

      {/* Messages */}
      {/* Сообщения теперь в обычный flow — body скроллится сам.
          Padding-bottom оставляет место под sticky input-bar. */}
      <div
        ref={scrollRef}
        className="px-4 py-4 space-y-2"
        style={{ paddingBottom: '120px' }}
      >
        {messages.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-8">Сообщений пока нет.<br/>Напишите первое.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl text-[14px] leading-relaxed overflow-hidden ${
                m.fromMe
                  ? 'bg-[#4ec9c0]/85 text-[#03161c] rounded-br-md'
                  : 'bg-[#0a2f38]/75 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
              }`}
            >
              {m.mediaUrl && m.mediaType === 'image' && (
                <a href={resolveAssetUrl(m.mediaUrl)} target="_blank" rel="noreferrer" className="block">
                  <img src={resolveAssetUrl(m.mediaUrl)} alt="" className="max-w-full max-h-72 object-cover" />
                </a>
              )}
              {m.mediaUrl && m.mediaType === 'audio' && (
                <audio src={resolveAssetUrl(m.mediaUrl)} controls className="block max-w-full px-2 pt-2" />
              )}
              {m.mediaUrl && m.mediaType === 'video' && (
                <video src={resolveAssetUrl(m.mediaUrl)} controls playsInline className="block max-w-full max-h-72" />
              )}
              <div className="px-3.5 py-2">
                {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                <span className={`block text-[9px] mt-1 ${m.fromMe ? 'text-[#03161c]/60 text-right' : 'text-[#7aa8a4]'}`}>
                  {formatTime(m.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input + media controls */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />
      <div
        className="sticky bottom-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-t border-[#4ec9c0]/22 px-3 py-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        {recording ? (
          <div className="flex items-center gap-3 py-2 px-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-mono text-[14px] text-[#d8f0ee]">
              {recording === 'audio' ? 'Запись аудио' : 'Запись видео'} · {String(Math.floor(recordSec / 60)).padStart(2, '0')}:{String(recordSec % 60).padStart(2, '0')}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={cancelRecord}
              className="h-10 w-10 flex items-center justify-center rounded-2xl border border-rose-400/35 text-rose-300 active:scale-90"
              aria-label="Отмена"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopRecord}
              className="h-10 w-10 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90"
              aria-label="Стоп и отправить"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => handlePickFile('image/*')}
              className="h-10 w-10 flex items-center justify-center rounded-2xl border border-[#4ec9c0]/30 text-[#4ec9c0] active:scale-90"
              aria-label="Прикрепить фото"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handlePickFile('video/*')}
              className="h-10 w-10 flex items-center justify-center rounded-2xl border border-[#4ec9c0]/30 text-[#4ec9c0] active:scale-90"
              aria-label="Прикрепить видео"
            >
              <VideoIcon className="w-4 h-4" />
            </button>
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
              className="flex-1 bg-[#0a2f38]/55 border border-[#4ec9c0]/28 rounded-2xl px-4 py-2.5 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/55 resize-none max-h-32"
            />
            {input.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] disabled:opacity-40 active:scale-90"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startRecord('audio')}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90"
                aria-label="Записать голосовое"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AI ROOM — диалог с AI-ассистентом через /ai/chat
// ============================================================================
function AiRoom() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Array<{ id: string; fromMe: boolean; text: string; time: string }>>(
    [{ id: 'init', fromMe: false, text: 'Привет! Я ассистент TechForum 2026. Спросите что угодно про программу, спикеров, расписание или партнёров.', time: '' }],
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // body-scroll: прокручиваем окно вниз к новому сообщению.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setInput('');
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, fromMe: true, text, time }]);
    setLoading(true);
    try {
      const r = await fetch(resolveApiUrl('/ai/chat'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json().catch(() => null);
      const answer = r.ok && data?.text ? String(data.text) : 'AI-ассистент сейчас недоступен. Попробуйте позже.';
      setMessages((prev) => [...prev, { id: `a_${Date.now()}`, fromMe: false, text: answer, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setMessages((prev) => [...prev, { id: `e_${Date.now()}`, fromMe: false, text: 'Нет соединения с сервером.', time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" style={{ minHeight: '100dvh' }}>
      <header
        className="sticky top-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-b border-[#4ec9c0]/22 px-4 py-2.5 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <button
          onClick={() => navigate('/chat')}
          aria-label="Назад"
          className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 bg-[#03161c]/60 text-[#4ec9c0] active:scale-90"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ec9c0]/40 to-[#4ec9c0]/15 border border-[#4ec9c0]/55 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-[#4ec9c0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#d8f0ee] truncate">AI-ассистент</p>
          <p className="text-[11px] text-[#7aa8a4] truncate">Знает всё о программе форума</p>
        </div>
      </header>

      {/* Сообщения теперь в обычный flow — body скроллится сам.
          Padding-bottom оставляет место под sticky input-bar. */}
      <div
        ref={scrollRef}
        className="px-4 py-4 space-y-2"
        style={{ paddingBottom: '120px' }}
      >
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                m.fromMe
                  ? 'bg-[#4ec9c0]/85 text-[#03161c] rounded-br-md'
                  : 'bg-[#0a2f38]/75 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              {m.time && (
                <span className={`block text-[9px] mt-1 ${m.fromMe ? 'text-[#03161c]/60 text-right' : 'text-[#7aa8a4]'}`}>
                  {m.time}
                </span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0a2f38]/75 text-[#7aa8a4] border border-[#4ec9c0]/22 rounded-2xl px-3.5 py-2 text-[13px]">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0]/70 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0]/70 animate-pulse [animation-delay:120ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0]/70 animate-pulse [animation-delay:240ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-t border-[#4ec9c0]/22 px-3 py-2 flex items-end gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Спросите ассистента…"
          rows={1}
          className="flex-1 bg-[#0a2f38]/55 border border-[#4ec9c0]/28 rounded-2xl px-4 py-2.5 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/55 resize-none max-h-32"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] disabled:opacity-40 active:scale-90 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// ROUTER
// ============================================================================
export default function Chat() {
  const { userId } = useParams<{ userId?: string }>();
  if (!userId) return <ChatList />;
  if (userId === 'ai') return <AiRoom />;
  return <DmRoom userId={userId} />;
}
