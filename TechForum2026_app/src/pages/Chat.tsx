// FILE: src/pages/Chat.tsx
// VERSION: 5.0.0 — DM-only (AI assistant removed)
// SCOPE: routes /chat (список переписок), /chat/:userId (диалог).
// AI-ассистент удалён по требованию заказчика.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Search, Send, ChevronRight, Mic, Square, Image as ImageIcon, Video as VideoIcon,
  X as XIcon, ArrowLeft, Paperclip, Loader2, Camera, Play, Pause,
  Reply, Copy, Forward, Pin, Edit3, Trash2, Download as DownloadIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import PageShell from '@/src/components/ui/PageShell';
import AvatarImage from '@/src/components/ui/AvatarImage';
import Skeleton from '@/src/components/ui/Skeleton';
import { hapticImpact, hapticNotify } from '@/src/lib/haptics';

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
  /** Structured reply: id оригинала. UI рисует превью + jump-to-original. */
  replyToId?: string | null;
  /** Forward attribution: автор оригинала (если был forwarded). */
  forwardedFromUserId?: string | null;
  createdAt: string;
  /** True пока сообщение ещё не подтверждено сервером (optimistic). */
  pending?: boolean;
};

// Long-press helper. Возвращает onPointerDown/Up/Cancel handlers, которые
// вызывают onTrigger() через 500ms если палец не отпустили. Click не
// триггерится после long-press (suppressClick флаг — иначе тап-в-меню
// сразу закрывает его).
const LONG_PRESS_MS = 500;
function makeLongPressHandlers(onTrigger: () => void) {
  let timer: number | null = null;
  let triggered = false;
  return {
    onPointerDown: () => {
      triggered = false;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        triggered = true;
        // Тактильный feedback в момент срабатывания long-press — даёт юзеру
        // понять, что меню сейчас откроется. Web/без плагина — silent.
        void hapticImpact('medium');
        onTrigger();
      }, LONG_PRESS_MS);
    },
    onPointerUp: () => {
      if (timer) { window.clearTimeout(timer); timer = null; }
    },
    onPointerCancel: () => {
      if (timer) { window.clearTimeout(timer); timer = null; }
    },
    onPointerLeave: () => {
      if (timer) { window.clearTimeout(timer); timer = null; }
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (triggered) {
        e.stopPropagation();
        e.preventDefault();
        triggered = false;
      }
    },
  };
}

// Бэк отдаёт mediaUrl уже подписанный HMAC'ом (?exp=...&sig=...).
// Native <audio>/<video>/<img> грузит этот URL напрямую через WebView,
// сервер валидирует sig — auth по cookie не нужен.
// Раньше тут был useAuthenticatedMedia hook (pre-fetch + blob URL),
// но CapacitorHttp.fetch не реализует .blob() для binary responses
// → вечный спиннер. Подписанные URL решают проблему чище: один request
// от native player, никакого buffering'а в JS.
const dmMediaSrc = (mediaUrl: string | null | undefined): string | null =>
  mediaUrl ? resolveAssetUrl(mediaUrl) : null;

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
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 bg-[#0a2f38]/45 border border-[#4ec9c0]/22 p-3.5 rounded-2xl">
                <Skeleton className="rounded-full" width={48} height={48} />
                <div className="flex-1 space-y-2">
                  <Skeleton height={12} width="50%" />
                  <Skeleton height={10} width="80%" />
                </div>
              </div>
            ))}
          </div>
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
  // Сообщение, на которое нажали-удержали → показать context-menu.
  const [actionsFor, setActionsFor] = useState<ChatMessage | null>(null);
  // Toast-у текст для feedback.
  const [toast, setToast] = useState<string | null>(null);
  // Reply: на какое сообщение отвечаем (chip над input).
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Edit: какое своё сообщение редактируем (input заполняется текстом).
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  // Forward: какое сообщение форвардим, открывает модал-выбор контакта.
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  // Pin: id закреплённого сообщения в этом DM. Хранится на сервере
  // (dm_pins table, per-user, per-dialog). Раньше был localStorage —
  // не переживал переустановку и не sync'ался между устройствами.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  // Подтягиваем pinned id с сервера при открытии диалога.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await fetch(resolveApiUrl(`/messages/pins/${userId}`), { credentials: 'include' });
        if (r.ok) {
          const data: { messageId: string | null } = await r.json();
          if (alive) setPinnedId(data.messageId);
        }
      } catch { /* offline — оставляем null */ }
    })();
    return () => { alive = false; };
  }, [userId]);
  const setPinned = async (id: string | null) => {
    // Optimistic update.
    const prev = pinnedId;
    setPinnedId(id);
    try {
      if (id) {
        const r = await fetch(resolveApiUrl(`/messages/pins/${userId}`), {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id }),
        });
        if (!r.ok) throw new Error(`pin_failed_${r.status}`);
      } else {
        const r = await fetch(resolveApiUrl(`/messages/pins/${userId}`), {
          method: 'DELETE', credentials: 'include',
        });
        if (!r.ok) throw new Error(`unpin_failed_${r.status}`);
      }
    } catch {
      // Rollback при ошибке сети — UI вернёт прежний state.
      setPinnedId(prev);
      showToast('Не удалось сохранить закрепление');
    }
  };
  const showToast = (text: string, ms = 1800) => {
    setToast(text);
    window.setTimeout(() => setToast(null), ms);
  };

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
      const arr: Array<{ id: string; fromUserId: string; text: string; mediaUrl: string | null; mediaType: 'image' | 'audio' | 'video' | null; replyToId: string | null; forwardedFromUserId: string | null; createdAt: string }> = await r.json();
      const serverMsgs: ChatMessage[] = arr.map((m) => ({
        id: m.id,
        fromMe: m.fromUserId === meId,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        replyToId: m.replyToId,
        forwardedFromUserId: m.forwardedFromUserId,
        createdAt: m.createdAt,
      }));
      setMessages((prev) => {
        const existingById = new Map(prev.map((m) => [m.id, m]));
        const pending = prev.filter((m) => m.pending);
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        const stillPending = pending.filter((m) => !serverIds.has(m.id));
        // Сохраняем существующий mediaUrl, чтобы native player не
        // перезагружал URL с новой sig (poll отдаёт fresh sig каждый раз).
        // Поведение: первый раз ставим server URL; на следующих poll-ах,
        // если message с тем же id уже есть и его mediaUrl не пустой —
        // используем старое значение. Player продолжает играть текущий buffer.
        const merged = serverMsgs.map((sm) => {
          const ex = existingById.get(sm.id);
          if (ex && ex.mediaUrl && sm.mediaUrl) {
            return { ...sm, mediaUrl: ex.mediaUrl };
          }
          return sm;
        });
        return [...merged, ...stillPending];
      });
    } catch { /* noop */ }
  }, [userId, meId]);

  useEffect(() => {
    if (!meId) return;
    void fetchDialog();
    const t = window.setInterval(() => { void fetchDialog(); }, 4_000);
    return () => window.clearInterval(t);
  }, [fetchDialog, meId]);

  // Auto-scroll вниз на новые сообщения — НО только если юзер был у нижнего
  // края (~120px). Раньше скроллило всегда, и при чтении истории пришедшее
  // сообщение выкидывало в самый низ. Теперь: листает историю — не дёргаем;
  // у дна (читает live) — auto-follow.
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    const prevCount = lastMsgCountRef.current;
    lastMsgCountRef.current = messages.length;
    if (messages.length === prevCount) return;
    const doc = document.documentElement;
    const distanceFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
    const NEAR_BOTTOM_PX = 160;
    // Первый рендер (prevCount===0) — всегда вниз, чтобы открыть последний
    // экран переписки. Последующие — только если юзер уже у дна.
    if (prevCount === 0 || distanceFromBottom < NEAR_BOTTOM_PX) {
      window.scrollTo({ top: doc.scrollHeight, behavior: prevCount === 0 ? 'auto' : 'smooth' });
    }
  }, [messages.length]);

  // ====== Send: text or media ======
  // localPreviewUrl: blob:// URL для МГНОВЕННОГО воспроизведения у отправителя
  // (без ожидания /upload + signed URL round-trip от сервера). После POST
  // /messages мы обновляем id на серверный, но КЕЕП localPreviewUrl как
  // mediaUrl — player не пере-загружает src. fetchDialog merge также
  // сохраняет existing mediaUrl для уже видимых message id.
  const sendMessage = async (payload: { text?: string; mediaUrl?: string; mediaType?: 'image' | 'audio' | 'video'; localPreviewUrl?: string; replyToId?: string; forwardedFromUserId?: string }) => {
    if (sending) return;
    if (!payload.text && !payload.mediaUrl) return;
    setSending(true);
    const optimisticId = `tmp_${Date.now()}`;
    const displayUrl = payload.localPreviewUrl || payload.mediaUrl || null;
    const optimistic: ChatMessage = {
      id: optimisticId, fromMe: true,
      text: payload.text || '',
      mediaUrl: displayUrl,
      mediaType: payload.mediaType ?? null,
      replyToId: payload.replyToId ?? null,
      forwardedFromUserId: payload.forwardedFromUserId ?? null,
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
          replyToId: payload.replyToId,
          forwardedFromUserId: payload.forwardedFromUserId,
        }),
      });
      if (!r.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        if (payload.text) setInput(payload.text);
      } else {
        const real = await r.json();
        setMessages((prev) => prev.map((m) => m.id === optimisticId
          ? {
              ...m,
              id: real.id,
              createdAt: real.createdAt,
              pending: false,
              // Если есть localPreview — оставляем его как mediaUrl (player
              // продолжает играть с того же blob:// без перезагрузки).
              // Без preview — берём server-signed URL.
              mediaUrl: payload.localPreviewUrl || real.mediaUrl || displayUrl,
            }
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

    // Edit-mode: PATCH /messages/:id вместо нового message.
    if (editingMsg) {
      const target = editingMsg;
      setInput('');
      setEditingMsg(null);
      try {
        const r = await fetch(resolveApiUrl(`/messages/${target.id}`), {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (r.ok) {
          // Обновляем локально мгновенно — poll потом подтвердит.
          setMessages((prev) => prev.map((m) =>
            m.id === target.id ? { ...m, text } : m,
          ));
          showToast('Изменено');
        } else {
          const err = await r.json().catch(() => ({}));
          showToast(err.error === 'too_old_to_edit' ? 'Сообщение слишком старое' : 'Не удалось изменить');
          setInput(text); // вернуть текст в input для retry
          setEditingMsg(target);
        }
      } catch {
        showToast('Нет соединения');
        setInput(text);
        setEditingMsg(target);
      }
      return;
    }

    // Reply-mode: structured replyToId. Сервер хранит ссылку, UI рисует
    // превью + jump-to-original. Раньше тут был префикс "↳ first 80 chars\n"
    // в text-поле — оригинал и цитата теряли связь, jump не работал.
    const replyToId = replyTo?.id;
    setReplyTo(null);
    setInput('');
    await sendMessage({ text, replyToId });
  };

  // ====== Media: file picker ======
  // Для photo (галерея + камера) используем @capacitor/camera plugin —
  // нативный picker, в отличие от <input type="file"> который на Capacitor
  // 8 WebView нестабильно обрабатывал onShowFileChooser.
  // Для video — динамически создаваемый <input type="file" accept="video/*">
  // в pickVideoNative, appended to body, click(). Надёжнее in-tree hidden
  // элемента который часть Android WebView молча игнорирует.

  // Manual base64 → Blob (без fetch(dataUrl), потому что CapacitorHttp
  // патчит window.fetch и data: URLs некоторые версии перехватывают
  // криво — body молча пустой).
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const commaIdx = dataUrl.indexOf(',');
    const header = dataUrl.slice(0, commaIdx);
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const b64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const pickPhotoNative = async (source: 'CAMERA' | 'PHOTOS') => {
    setAttachOpen(false);
    const Capacitor: any = (window as any).Capacitor;
    if (Capacitor?.isNativePlatform?.()) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        // Явно запрашиваем permissions ДО getPhoto — иначе на Android 13+
        // плагин возвращает opaque error без видимого диалога-разрешения.
        try {
          const perm = await Camera.checkPermissions();
          const need = source === 'CAMERA' ? perm.camera !== 'granted' : perm.photos !== 'granted';
          if (need) {
            await Camera.requestPermissions({
              permissions: source === 'CAMERA' ? ['camera'] : ['photos'],
            });
          }
        } catch { /* старые версии плагина без checkPermissions — пропускаем */ }
        const photo = await Camera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: source === 'CAMERA' ? CameraSource.Camera : CameraSource.Photos,
          // saveToGallery: false — в Photos source не нужно сохранять копию.
          saveToGallery: false,
          // promptLabelHeader для UX consistency
          promptLabelHeader: source === 'CAMERA' ? 'Снять фото' : 'Выбрать фото',
        });
        if (!photo?.dataUrl) {
          showToast('Не получили фото — попробуйте ещё раз');
          void hapticNotify('warning');
          return;
        }
        const blob = dataUrlToBlob(photo.dataUrl);
        await uploadAndSend(blob);
      } catch (err) {
        const msg = (err as Error)?.message || String(err) || 'plugin_failed';
        if (/cancel/i.test(msg) || /User cancelled/i.test(msg) || /User denied/i.test(msg) && source === 'PHOTOS') return;
        // Видимая ошибка вместо silent-fail. Это позволяет диагностировать,
        // если плагин не работает (permission denied / not implemented / т.д.).
        showToast(`Не удалось ${source === 'CAMERA' ? 'открыть камеру' : 'получить фото из галереи'}`, 2400);
        void hapticNotify('error');
      }
      return;
    }
    // Web fallback (vite dev).
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'CAMERA') input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) await uploadAndSend(f);
    };
    input.click();
  };

  const pickVideoNative = () => {
    setAttachOpen(false);
    // Создаём input динамически И аппендим к body — раньше hidden input
    // в render-tree часто молча игнорировался WebChromeClient.onShowFileChooser
    // на части Android-устройств. Inline body-attached input вызывает
    // системный picker надёжнее.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '0';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.onchange = async () => {
      const f = input.files?.[0];
      try { document.body.removeChild(input); } catch { /* noop */ }
      if (f) await uploadAndSend(f);
    };
    document.body.appendChild(input);
    input.click();
  };

  // Blob → base64 (без data: префикса). Используем FileReader потому что
  // он отдаёт чистую строку и работает в Capacitor WebView без рисков.
  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('read_failed'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

  const uploadAndSend = async (blob: Blob | File) => {
    const placeholderId = `up_${Date.now()}`;
    const inferType = (mime: string): 'image' | 'audio' | 'video' =>
      mime.startsWith('image') ? 'image' : mime.startsWith('audio') ? 'audio' : 'video';
    const guessedType = inferType(blob.type || '');
    // Instant local preview: blob:// URL → player играет сразу из памяти
    // без round-trip на сервер. Особенно важно для аудио/видео — раньше
    // юзер ждал upload+sign+download прежде чем play-кнопка работала.
    const localPreviewUrl = URL.createObjectURL(blob);
    setMessages((prev) => [...prev, {
      id: placeholderId, fromMe: true, text: '',
      mediaUrl: localPreviewUrl, mediaType: guessedType,
      createdAt: new Date().toISOString(), pending: true,
    }]);

    try {
      const base64 = await blobToBase64(blob);
      const filename = blob instanceof File && blob.name ? blob.name : 'media';
      const mimeType = blob.type || 'application/octet-stream';
      const r = await fetch(resolveApiUrl('/messages/upload-media-base64'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mimeType, base64 }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        URL.revokeObjectURL(localPreviewUrl);
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        showToast(
          err.error === 'invalid_media' ? 'Формат не поддерживается'
          : err.error === 'size_out_of_range' ? 'Файл слишком большой (максимум 9 MB)'
          : `Загрузка не удалась`,
          2400,
        );
        void hapticNotify('error');
        return;
      }
      const data: { url: string; type: 'image' | 'audio' | 'video' } = await r.json();
      const canonical = data.url.split('?')[0];
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      // Передаём localPreviewUrl в sendMessage — оно сохранит этот URL
      // как mediaUrl у real-id message, чтобы player не дёргался при
      // переключении placeholder→real (без re-load src). fetchDialog
      // merge также сохранит его для уже видимых message id.
      await sendMessage({
        mediaUrl: canonical,
        mediaType: data.type,
        localPreviewUrl,
      });
    } catch (err) {
      URL.revokeObjectURL(localPreviewUrl);
      setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
      showToast(`Не удалось отправить: ${err instanceof Error ? err.message : 'нет соединения'}`, 2400);
      void hapticNotify('error');
    }
  };

  // ====== Media: voice / video record via MediaRecorder ======
  const [recording, setRecording] = useState<null | 'audio' | 'video'>(null);
  const [recordSec, setRecordSec] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Live preview во время видео-записи (Telegram-style круглое видео).
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);

  const startRecord = async (kind: 'audio' | 'video') => {
    setAttachOpen(false);
    try {
      const constraints: MediaStreamConstraints = kind === 'audio'
        ? { audio: true }
        // Front camera + квадратное соотношение для круглого видеосообщения.
        : { audio: true, video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      // Подключаем live-preview видео-элементу (если это видео-запись).
      if (kind === 'video') {
        // RAF-цикл из-за того что DOM-элемент <video> монтируется в условном
        // рендере одновременно с этим setState. Ждём один tick.
        requestAnimationFrame(() => {
          if (livePreviewRef.current && stream) {
            livePreviewRef.current.srcObject = stream;
            void livePreviewRef.current.play().catch(() => {});
          }
        });
      }
      recordTimer.current = setInterval(() => setRecordSec((s) => {
        if (s >= 59) { stopRecord(); return 60; }
        return s + 1;
      }), 1000);
    } catch (err) {
      showToast(`Микрофон/камера недоступны`, 2400);
      void hapticNotify('error');
      console.warn('record_failed:', (err as Error).message);
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
        ROOT-CAUSE «опущена вниз»: App.tsx оборачивает route в motion.div с
        opacity-анимацией. Framer Motion при работе устанавливает will-change/
        transform, что делает CSS spec'овскую position:fixed относительной
        к motion.div, а не к viewport. Outer App-контейнер имеет
        paddingTop: env(safe-area-inset-top) → motion.div уже смещён вниз
        на safe-area. Если ещё внутри header добавить paddingTop:safe-area —
        получается DOUBLE padding. Поэтому здесь paddingTop=0 — outer
        контейнер уже корректно отвёл место под status-bar.
      */}
      <header
        className="fixed left-0 right-0 top-0 z-30 bg-[#03161c] border-b border-[#4ec9c0]/22"
      >
        <div className="px-3 py-2 flex items-center gap-2.5">
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate('/chat');
            }}
            aria-label="Назад"
            className="h-9 w-9 flex items-center justify-center rounded-[10px] text-[#4ec9c0] hover:bg-[#0a2f38]/55 active:scale-90 transition-all shrink-0"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          {/* Тап по аватару+имени → публичный профиль. ChevronRight справа —
              визуальный hint что это link. */}
          <button
            type="button"
            onClick={() => navigate(`/users/${userId}`)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left py-1 px-1 rounded-lg hover:bg-[#0a2f38]/40 active:bg-[#0a2f38]/70 transition-colors"
            aria-label="Открыть профиль"
          >
            <Avatar name={contact?.name || ''} src={contact?.avatar} size={38} />
            <div className="flex-1 min-w-0">
              <p className="font-display-cyrl text-[15px] font-semibold text-[#d8f0ee] truncate leading-tight">{contact?.name || 'Участник'}</p>
              <p className="text-[11px] text-[#7aa8a4] truncate leading-tight mt-0.5">{contact?.role || 'был(а) недавно'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#4ec9c0]/55 shrink-0 mr-1" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* Spacer под fixed header. 56px = py-2*2 + 38px avatar height. */}
      <div style={{ paddingTop: '56px' }} />

      {/* Pinned message bar (если есть закрепление в этом DM) */}
      {pinnedId && (() => {
        const pinned = messages.find((m) => m.id === pinnedId);
        if (!pinned) return null;
        return (
          <div className="px-3 pt-2 pb-1">
            <div className="flex items-center gap-2 rounded-xl border border-[#4ec9c0]/35 bg-[#0a2f38]/55 px-3 py-2">
              <Pin className="w-3.5 h-3.5 text-[#4ec9c0]" strokeWidth={2} fill="currentColor" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[#4ec9c0]/85">Закреплено</p>
                <p className="text-[12px] text-[#d8f0ee] truncate">
                  {pinned.text || (pinned.mediaType ? `[${pinned.mediaType}]` : '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPinned(null)}
                aria-label="Открепить"
                className="h-7 w-7 flex items-center justify-center rounded-md text-[#7aa8a4] hover:text-[#d8f0ee] hover:bg-[#03161c]/40"
              >
                <XIcon className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="px-3 py-4 space-y-2" style={{ paddingBottom: '120px' }}>
        {messages.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-8">
            Сообщений пока нет.<br />Напишите первое.
          </p>
        )}
        {messages.map((m) => {
          const time = formatTime(m.createdAt);
          // Long-press на bubble → открыть context menu.
          const lp = makeLongPressHandlers(() => setActionsFor(m));
          // Reply preview: ищем оригинал в тех же messages (один диалог).
          const replyTarget = m.replyToId ? messages.find((x) => x.id === m.replyToId) : null;
          // Forward banner: текст "Переслано от …".
          const forwardLabel = m.forwardedFromUserId
            ? (m.forwardedFromUserId === meId ? 'вас'
                : (contact && m.forwardedFromUserId === contact.userId ? contact.name : 'участника'))
            : null;
          // Прыжок к оригиналу при тапе на reply-quote.
          const jumpToReply = () => {
            if (!m.replyToId) return;
            const el = document.getElementById(`dm-msg-${m.replyToId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('dm-msg-flash');
              setTimeout(() => el.classList.remove('dm-msg-flash'), 1200);
            }
          };
          const wrapClass = `flex ${m.fromMe ? 'justify-end' : 'justify-start'}`;
          // Reply/forward extras рендерятся ВНУТРИ wrapper-а, СВЕРХУ bubble.
          // Делаем колонкой: chips + bubble на одной стороне.
          const extras = (replyTarget || forwardLabel || (m.replyToId && !replyTarget)) ? (
            <div className={`flex flex-col gap-1 max-w-[80%] ${m.fromMe ? 'items-end' : 'items-start'}`}>
              {forwardLabel && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#7aa8a4]/85 font-mono uppercase tracking-widest px-1">
                  <Forward className="w-3 h-3" strokeWidth={2} />
                  Переслано от {forwardLabel}
                </div>
              )}
              {(replyTarget || (m.replyToId && !replyTarget)) && (
                <button
                  type="button"
                  onClick={jumpToReply}
                  disabled={!replyTarget}
                  className={`text-left rounded-xl px-2.5 py-1.5 border-l-2 ${
                    m.fromMe
                      ? 'bg-[#03161c]/30 border-[#03161c]/60'
                      : 'bg-[#03161c]/40 border-[#4ec9c0]/60'
                  } ${!replyTarget ? 'opacity-60' : ''}`}
                  style={{ minWidth: 120, maxWidth: '100%' }}
                >
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#4ec9c0]/85">
                    Ответ
                  </p>
                  <p className="text-[11px] text-[#d8f0ee]/85 truncate">
                    {replyTarget
                      ? (replyTarget.text || (replyTarget.mediaType ? `[${replyTarget.mediaType}]` : ''))
                      : '[удалённое сообщение]'}
                  </p>
                </button>
              )}
            </div>
          ) : null;
          if (m.mediaType === 'audio') {
            return (
              <div key={m.id} id={`dm-msg-${m.id}`} className={wrapClass} {...lp}>
                <div className="flex flex-col gap-1 max-w-[80%]">
                  {extras}
                  <AudioBubble src={m.mediaUrl ? resolveAssetUrl(m.mediaUrl) : null} time={time} pending={m.pending} fromMe={m.fromMe} />
                </div>
              </div>
            );
          }
          if (m.mediaType === 'video') {
            return (
              <div key={m.id} id={`dm-msg-${m.id}`} className={wrapClass} {...lp}>
                <div className="flex flex-col gap-1 max-w-[80%]">
                  {extras}
                  <VideoBubble src={m.mediaUrl ? resolveAssetUrl(m.mediaUrl) : null} time={time} pending={m.pending} />
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} id={`dm-msg-${m.id}`} className={wrapClass} {...lp}>
              <div className={`flex flex-col gap-1 max-w-full ${m.fromMe ? 'items-end' : 'items-start'}`}>
                {extras}
                <ImageBubble
                  message={m}
                  time={time}
                  onLightbox={(url) => setLightbox(url)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Видео-input создаётся динамически в pickVideoNative и append-ится
          к body, см. там — это надёжнее чем in-tree hidden input. */}

      {/* Bottom bar: либо input, либо запись */}
      <div
        className="fixed left-0 right-0 bottom-0 z-30 bg-[#03161c] border-t border-[#4ec9c0]/22 px-3 py-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        {/* Reply / Edit chip (если активны) над input bar */}
        {(replyTo || editingMsg) && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#4ec9c0]/30 bg-[#0a2f38]/55 px-3 py-2">
            {editingMsg ? (
              <Edit3 className="w-3.5 h-3.5 text-[#4ec9c0]" strokeWidth={2} />
            ) : (
              <Reply className="w-3.5 h-3.5 text-[#4ec9c0]" strokeWidth={2} />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#4ec9c0]/85">
                {editingMsg ? 'Редактирование' : 'Ответ'}
              </p>
              <p className="text-[12px] text-[#d8f0ee] truncate">
                {(editingMsg || replyTo)?.text
                 || ((editingMsg || replyTo)?.mediaType ? `[${(editingMsg || replyTo)?.mediaType}]` : '')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setReplyTo(null); if (editingMsg) { setEditingMsg(null); setInput(''); } }}
              aria-label="Отменить"
              className="h-7 w-7 flex items-center justify-center rounded-md text-[#7aa8a4] hover:text-[#d8f0ee] hover:bg-[#03161c]/40"
            >
              <XIcon className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3 py-2 px-2">
            {recording === 'video' && (
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#4ec9c0]/65 shrink-0 shadow-[0_0_18px_rgba(78,201,192,0.4)]">
                {/* Live preview front-cam, mirrored для естественного восприятия. */}
                <video
                  ref={livePreviewRef}
                  muted
                  playsInline
                  autoPlay
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
            )}
            {recording === 'audio' && (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            )}
            <span className="font-display-cyrl text-[14px] text-[#d8f0ee]">
              {recording === 'audio' ? 'Запись аудио' : 'Видеосообщение'}
              <span className="font-mono ml-2 text-[#4ec9c0]">
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
              className="h-10 w-10 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90 transition-transform shadow-[0_4px_14px_rgba(78,201,192,0.35)]"
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
                  <AttachItem icon={ImageIcon} label="Фото из галереи" onClick={() => pickPhotoNative('PHOTOS')} />
                  <AttachItem icon={Camera} label="Снять фото" onClick={() => pickPhotoNative('CAMERA')} />
                  <AttachItem icon={VideoIcon} label="Видео из галереи" onClick={pickVideoNative} />
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
              <>
                <button
                  type="button"
                  onClick={() => startRecord('video')}
                  className="h-11 w-11 flex items-center justify-center rounded-2xl border border-[#4ec9c0]/40 bg-[#0a2f38]/55 text-[#4ec9c0] active:scale-90 transition-transform hover:bg-[#0a2f38]/80"
                  aria-label="Записать видеосообщение"
                >
                  <VideoIcon className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => startRecord('audio')}
                  className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] active:scale-90 transition-transform shadow-[0_4px_14px_rgba(78,201,192,0.25)]"
                  aria-label="Записать голосовое"
                >
                  <Mic className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Message context menu (long-press) */}
      <MessageActions
        message={actionsFor}
        isPinned={!!actionsFor && actionsFor.id === pinnedId}
        onClose={() => setActionsFor(null)}
        onToast={showToast}
        onReply={(m) => { setReplyTo(m); setEditingMsg(null); }}
        onForward={(m) => setForwarding(m)}
        onTogglePin={(m) => {
          const next = pinnedId === m.id ? null : m.id;
          setPinned(next);
          showToast(next ? 'Закреплено' : 'Откреплено');
        }}
        onEdit={(m) => {
          setEditingMsg(m);
          setReplyTo(null);
          setInput(m.text || '');
        }}
        onDelete={async (m) => {
          if (m.id.startsWith('tmp_') || m.id.startsWith('up_')) {
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            if (pinnedId === m.id) setPinned(null);
            return true;
          }
          try {
            const r = await fetch(resolveApiUrl(`/messages/${m.id}`), {
              method: 'DELETE', credentials: 'include',
            });
            if (!r.ok) return false;
            setMessages((prev) => prev.filter((x) => x.id !== m.id));
            if (pinnedId === m.id) setPinned(null);
            return true;
          } catch { return false; }
        }}
      />

      {/* Forward — модал-выбор контакта для пересылки.
          originalAuthorId — id автора оригинала. Если форвардим СВОЁ
          сообщение (fromMe), это meId; иначе — собеседник (userId), потому
          что в нашей 1:1 модели всё что не от меня — от партнёра.
          forwardedFromUserId записывается в БД для атрибуции «Переслано от X». */}
      <ForwardModal
        message={forwarding}
        originalAuthorId={forwarding ? (forwarding.fromMe ? (meId ?? '') : userId) : ''}
        onClose={() => setForwarding(null)}
        onSent={() => { setForwarding(null); showToast('Переслано'); }}
        onError={() => showToast('Не удалось переслать')}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed left-1/2 -translate-x-1/2 z-[60] rounded-full border border-[#4ec9c0]/40 bg-[#03161c]/95 backdrop-blur-md px-4 py-2 text-[12px] font-ui text-[#d8f0ee] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 90px)' }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

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

// ============================================================================
// AUDIO BUBBLE — telegram-style: круглая play-кнопка + waveform-bars + таймер
// ============================================================================
function AudioBubble({ src, time, pending, fromMe }: { src: string | null; time: string; pending?: boolean; fromMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const playableSrc = src;

  const onLoaded = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };
  const onTime = () => {
    if (audioRef.current) setProgress(audioRef.current.currentTime || 0);
  };
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  const formatSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // Псевдо-waveform: 32 столбика разной высоты (псевдо-случайных, но
  // стабильных — индекс через sin для воспроизводимости).
  const bars = Array.from({ length: 32 }, (_, i) => {
    const h = 4 + Math.abs(Math.sin(i * 1.7) + Math.cos(i * 0.9)) * 10;
    return Math.min(18, Math.max(3, h));
  });
  const barFillCount = duration > 0 ? Math.round((progress / duration) * bars.length) : 0;

  return (
    <div
      className={`relative max-w-[280px] rounded-2xl px-3 py-2.5 flex items-center gap-3 ${
        fromMe
          ? 'bg-[#4ec9c0] text-[#03161c] rounded-br-md shadow-[0_4px_14px_rgba(78,201,192,0.20)]'
          : 'bg-[#0a2f38]/85 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
      } ${pending ? 'opacity-75' : ''}`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={!playableSrc || pending}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        className={`relative h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-50 ${
          fromMe
            ? 'bg-[#03161c] text-[#4ec9c0]'
            : 'bg-[#4ec9c0] text-[#03161c] shadow-[0_0_18px_rgba(78,201,192,0.45)]'
        }`}
      >
        {(pending && !src) || (src && !playableSrc) ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.8} />
        ) : playing ? (
          <Pause className="w-4 h-4" strokeWidth={2} fill="currentColor" />
        ) : (
          <Play className="w-4 h-4 translate-x-[1px]" strokeWidth={2} fill="currentColor" />
        )}
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-end gap-[2px] h-5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 2,
                height: h,
                backgroundColor: fromMe
                  ? (i < barFillCount ? '#03161c' : 'rgba(3,22,28,0.35)')
                  : (i < barFillCount ? '#4ec9c0' : 'rgba(78,201,192,0.30)'),
              }}
            />
          ))}
        </div>
        <div className={`flex items-center justify-between text-[10px] font-mono ${fromMe ? 'text-[#03161c]/70' : 'text-[#7aa8a4]'}`}>
          <span>{formatSec(playing || progress > 0 ? progress : duration)}</span>
          <span>{time}</span>
        </div>
      </div>
      {playableSrc && (
        <audio
          ref={audioRef}
          src={playableSrc}
          preload="metadata"
          onLoadedMetadata={onLoaded}
          onTimeUpdate={onTime}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          className="hidden"
        />
      )}
    </div>
  );
}

// ============================================================================
// VIDEO BUBBLE — telegram-style круглое видеосообщение
// ============================================================================
function VideoBubble({ src, time, pending }: { src: string | null; time: string; pending?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const playableSrc = src;

  const formatSec = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const tap = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.muted = false; setMuted(false); void v.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <div className={`relative ${pending ? 'opacity-75' : ''}`}>
      <button
        type="button"
        onClick={tap}
        disabled={!playableSrc || pending}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        className="relative w-[240px] h-[240px] rounded-full overflow-hidden bg-[#0a2f38] border-2 border-[#4ec9c0]/45 shadow-[0_0_24px_rgba(78,201,192,0.25)] active:scale-[0.98] transition-transform"
      >
        {(!src && pending) || (src && !playableSrc) ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#4ec9c0]" strokeWidth={1.6} />
          </span>
        ) : playableSrc ? (
          <video
            ref={videoRef}
            src={playableSrc}
            playsInline
            muted={muted}
            // preload="auto" — заставляет загрузить достаточно для рендера
            // первого кадра. Без этого Android WebView показывает пустой
            // серый прямоугольник пока юзер не нажмёт play.
            preload="auto"
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;
              if (Number.isFinite(v.duration)) setDuration(v.duration);
              // Seek в начало → forces decode первого кадра. Без этого
              // Android Chromium WebView оставляет canvas пустым (poster).
              try { v.currentTime = 0.05; } catch { /* noop */ }
            }}
            onTimeUpdate={() => { if (videoRef.current) setProgress(videoRef.current.currentTime || 0); }}
            onEnded={() => { setPlaying(false); setProgress(0); }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
        {!playing && playableSrc && !pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="h-14 w-14 rounded-full bg-[#03161c]/70 backdrop-blur-sm border border-[#4ec9c0]/55 flex items-center justify-center">
              <Play className="w-6 h-6 text-[#4ec9c0] translate-x-[2px]" strokeWidth={2} fill="currentColor" />
            </span>
          </span>
        )}
      </button>
      {/* Footer: время воспроизведения слева, timestamp справа. */}
      <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] font-mono text-[#7aa8a4]">
        <span className="flex items-center gap-1">
          {formatSec(playing || progress > 0 ? progress : duration)}
          {!muted && playing && (
            <span className="inline-flex gap-0.5 ml-1">
              <span className="w-[2px] h-2 bg-[#4ec9c0]" />
              <span className="w-[2px] h-3 bg-[#4ec9c0]" />
              <span className="w-[2px] h-2 bg-[#4ec9c0]" />
            </span>
          )}
        </span>
        <span>{time}</span>
      </div>
    </div>
  );
}

// ============================================================================
// IMAGE BUBBLE — текст или картинка (или оба) с auth-fetched blob URL.
// ============================================================================
function ImageBubble({
  message: m,
  time,
  onLightbox,
}: {
  message: ChatMessage;
  time: string;
  onLightbox: (url: string) => void;
}) {
  const playableSrc = m.mediaUrl ?? null;
  const isImageOnly = !!m.mediaUrl && !m.text;
  return (
    <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[80%] rounded-2xl text-[14px] leading-relaxed overflow-hidden ${
          m.fromMe
            ? 'bg-[#4ec9c0] text-[#03161c] rounded-br-md shadow-[0_4px_14px_rgba(78,201,192,0.20)]'
            : 'bg-[#0a2f38]/85 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
        } ${m.pending ? 'opacity-75' : ''}`}
      >
        {!m.mediaUrl && m.pending && m.mediaType === 'image' && (
          <div className="w-44 h-32 flex items-center justify-center bg-[#03161c]/30">
            <Loader2 className="w-6 h-6 animate-spin opacity-80" strokeWidth={1.6} />
          </div>
        )}
        {m.mediaUrl && m.mediaType === 'image' && (
          <button
            type="button"
            onClick={() => playableSrc && onLightbox(playableSrc)}
            disabled={!playableSrc}
            className="block w-full"
          >
            {playableSrc ? (
              <img src={playableSrc} alt="" className="max-w-full max-h-72 object-cover" />
            ) : (
              <div className="w-44 h-32 flex items-center justify-center bg-[#03161c]/30">
                <Loader2 className="w-6 h-6 animate-spin opacity-80" strokeWidth={1.6} />
              </div>
            )}
          </button>
        )}
        {(m.text || (!m.mediaUrl && !m.pending)) && (
          <div className={`px-3.5 py-2 ${m.mediaUrl ? 'pt-1.5' : ''}`}>
            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
          </div>
        )}
        <div className={`flex items-center justify-end gap-1 px-3 pb-1.5 ${isImageOnly ? 'absolute bottom-1 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5' : ''}`}>
          {m.pending && (
            <Loader2 className={`w-3 h-3 animate-spin ${m.fromMe ? 'text-[#03161c]/70' : 'text-[#4ec9c0]/70'}`} strokeWidth={2} />
          )}
          <span className={`text-[10px] font-mono ${
            m.fromMe
              ? (isImageOnly ? 'text-white/85' : 'text-[#03161c]/65')
              : (isImageOnly ? 'text-white/85' : 'text-[#7aa8a4]')
          }`}>
            {time}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE ACTIONS — bottom-sheet menu по long-press на сообщение.
// Действия: Ответить (TBD), Копировать, Переслать (TBD), Закрепить (TBD),
// Изменить (TBD), Удалить, Сохранить в галерею (для image/video/audio).
// «TBD»-действия показывают toast «Скоро» — фронт-стабы до соответствующих
// бэк-эндпоинтов (replyToId, forward, pin, edit).
// ============================================================================
function MessageActions({
  message,
  isPinned,
  onClose,
  onToast,
  onReply,
  onForward,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  message: ChatMessage | null;
  isPinned: boolean;
  onClose: () => void;
  onToast: (text: string) => void;
  onReply: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
  onTogglePin: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!message) return null;
  const m = message;
  const hasMedia = !!m.mediaUrl;

  const close = () => { setConfirming(false); onClose(); };

  const handleCopy = async () => {
    const textToCopy = m.text || (m.mediaUrl ? resolveAssetUrl(m.mediaUrl) : '');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      onToast('Скопировано');
    } catch { onToast('Не удалось скопировать'); }
    close();
  };

  // Real save-to-gallery через @capacitor/filesystem. Раньше был просто
  // <a download> — в Capacitor WebView он часто открывается в браузере
  // вместо скачивания, файл в галерею не попадал. Теперь скачиваем
  // бинарь через fetch (CapacitorHttp с session cookie), декодируем
  // в base64 и пишем в Directory.External (Pictures/TechForum).
  // На web (vite dev) — fallback на <a download>.
  const handleSaveMedia = async () => {
    if (!m.mediaUrl) { close(); return; }
    const url = resolveAssetUrl(m.mediaUrl);
    const ext = m.mediaType === 'image' ? 'jpg' : m.mediaType === 'video' ? 'mp4' : 'webm';
    const filename = `techforum-${m.id.slice(0, 8)}.${ext}`;

    const Capacitor: any = (window as any).Capacitor;
    if (Capacitor?.isNativePlatform?.()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        // Качаем как arraybuffer (CapacitorHttp возвращает base64-строку
        // в .data при responseType:'blob' — используем readAsDataURL через FileReader).
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error(`fetch_failed_${r.status}`);
        // CapacitorHttp.fetch.blob() возвращает кривой blob — берём
        // arrayBuffer + конвертим в base64 вручную.
        const ab = await r.arrayBuffer();
        const u8 = new Uint8Array(ab);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < u8.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)));
        }
        const base64 = btoa(binary);
        // Пишем в External (на Android = /storage/emulated/0/Documents).
        // Видимо в Files-app и сканируется галереей при перезапуске.
        await Filesystem.writeFile({
          path: `TechForum/${filename}`,
          data: base64,
          directory: Directory.External,
          recursive: true,
        });
        onToast('Сохранено в Documents/TechForum');
      } catch (err) {
        onToast(`Не удалось сохранить: ${(err as Error).message || 'ошибка'}`);
      }
      close();
      return;
    }
    // Web fallback.
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onToast('Скачивание начато');
    } catch (err) {
      onToast(`Не удалось сохранить: ${(err as Error).message || 'ошибка'}`);
    }
    close();
  };

  const items: Array<{ icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; onClick: () => void; danger?: boolean }> = [
    { icon: Reply, label: 'Ответить', onClick: () => { onReply(m); close(); } },
    { icon: Copy, label: 'Копировать', onClick: handleCopy },
    { icon: Forward, label: 'Переслать', onClick: () => { onForward(m); close(); } },
    { icon: Pin, label: isPinned ? 'Открепить' : 'Закрепить', onClick: () => { onTogglePin(m); close(); } },
    ...(m.fromMe && !m.mediaUrl ? [{ icon: Edit3, label: 'Изменить', onClick: () => { onEdit(m); close(); } }] : []),
    ...(hasMedia ? [{ icon: DownloadIcon, label: 'Сохранить в галерею', onClick: handleSaveMedia }] : []),
    ...(m.fromMe ? [{ icon: Trash2, label: 'Удалить', onClick: () => setConfirming(true), danger: true }] : []),
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="actions-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-end justify-center"
        onClick={close}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="w-full max-w-[360px] mx-3 mb-3 rounded-2xl border border-[#4ec9c0]/35 bg-[#03161c]/95 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.55)] overflow-hidden"
          style={{ marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {confirming ? (
            <div className="p-5 space-y-4">
              <p className="font-display-cyrl text-[16px] text-[#d8f0ee] text-center">Удалить сообщение?</p>
              <p className="text-[12px] text-[#7aa8a4] text-center font-ui">
                Это действие нельзя отменить.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 py-2.5 rounded-[10px] border border-[#4ec9c0]/35 text-[#d8f0ee] font-ui text-[13px] active:scale-95 transition-transform"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await onDelete(m);
                    if (ok) onToast('Удалено');
                    else onToast('Не удалось удалить');
                    close();
                  }}
                  className="flex-1 py-2.5 rounded-[10px] bg-rose-500/85 text-[#03161c] font-ui font-semibold text-[13px] active:scale-95 transition-transform"
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <ul className="py-1.5">
              {items.map((it) => (
                <li key={it.label}>
                  <button
                    type="button"
                    onClick={it.onClick}
                    className={`w-full flex items-center gap-3.5 px-5 py-3 text-[15px] font-ui text-left transition-colors hover:bg-[#0a2f38]/55 ${
                      it.danger ? 'text-rose-300' : 'text-[#d8f0ee]'
                    }`}
                  >
                    <it.icon
                      className={`w-5 h-5 shrink-0 ${it.danger ? 'text-rose-300' : 'text-[#4ec9c0]'}`}
                      strokeWidth={1.6}
                    />
                    {it.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================================
// FORWARD MODAL — список контактов, тап → отправляет копию исходного
// сообщения (text + mediaUrl) выбранному контакту через POST /messages.
// ============================================================================
function ForwardModal({
  message,
  originalAuthorId,
  onClose,
  onSent,
  onError,
}: {
  message: ChatMessage | null;
  /** Автор оригинала — попадёт в forwardedFromUserId. Получатель видит «Переслано от <user>». */
  originalAuthorId: string;
  onClose: () => void;
  onSent: () => void;
  onError: () => void;
}) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Array<{ userId: string; name: string; role: string; avatar: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!message) return;
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch(resolveApiUrl('/messages/contacts'), { credentials: 'include' });
        if (r.ok) {
          const data: Array<{ userId: string; user: { name: string; role: string; avatar: string } | null }> = await r.json();
          setContacts(data.filter((c) => c.user).map((c) => ({
            userId: c.userId,
            name: c.user!.name,
            role: c.user!.role || 'Участник',
            avatar: c.user!.avatar,
          })));
        }
      } catch { /* offline */ } finally {
        setLoading(false);
      }
    })();
  }, [message]);

  const filtered = contacts.filter((c) =>
    !searchQ.trim() || c.name.toLowerCase().includes(searchQ.trim().toLowerCase()),
  );

  if (!message) return null;
  const m = message;
  const mediaForward = m.mediaUrl && !m.mediaUrl.startsWith('blob:') ? m.mediaUrl : undefined;

  const sendTo = async (toUserId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(resolveApiUrl('/messages'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          text: m.text || '',
          mediaUrl: mediaForward ? mediaForward.split('?')[0] : undefined,
          mediaType: m.mediaType ?? undefined,
          // Атрибуция: помечаем что это forward, у получателя UI рисует
          // «Переслано от <user>». Если оригинал сам был forward — берём
          // самого первого автора (m.forwardedFromUserId), иначе того, кто
          // прямо сейчас пересылает.
          forwardedFromUserId: m.forwardedFromUserId || originalAuthorId || undefined,
        }),
      });
      if (!r.ok) { onError(); return; }
      onSent();
      // Если форвардим текущему — остаёмся, иначе переходим в новый DM.
      navigate(`/chat/${toUserId}`);
    } catch { onError(); } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="forward-bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          className="w-full max-w-[440px] mx-3 mb-3 rounded-2xl border border-[#4ec9c0]/35 bg-[#03161c]/95 backdrop-blur-md shadow-[0_18px_60px_rgba(0,0,0,0.55)] flex flex-col overflow-hidden"
          style={{
            marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            maxHeight: '70vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#4ec9c0]/22">
            <h3 className="font-display-cyrl text-[16px] font-semibold text-[#d8f0ee]">Переслать</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="h-8 w-8 rounded-[10px] flex items-center justify-center text-[#7aa8a4] hover:bg-[#0a2f38]/55"
            >
              <XIcon className="w-4 h-4" strokeWidth={1.8} />
            </button>
          </div>

          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7aa8a4]" strokeWidth={1.6} />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Поиск контакта"
                className="w-full bg-[#0a2f38]/55 border border-[#4ec9c0]/30 rounded-xl pl-10 pr-3 py-2.5 text-[13px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/65 outline-none focus:border-[#4ec9c0]/60 font-ui"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {loading ? (
              <div className="space-y-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl">
                    <Skeleton className="rounded-full" width={36} height={36} />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton height={11} width="55%" />
                      <Skeleton height={9} width="75%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-[12px] text-[#7aa8a4] py-6">Нет контактов</p>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => sendTo(c.userId)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-[#4ec9c0]/15 hover:border-[#4ec9c0]/40 hover:bg-[#0a2f38]/55 active:scale-[0.99] transition-all text-left disabled:opacity-50"
                    >
                      <Avatar name={c.name} src={c.avatar} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="font-ui font-semibold text-[13px] text-[#d8f0ee] truncate">{c.name}</p>
                        <p className="text-[11px] text-[#7aa8a4] truncate">{c.role}</p>
                      </div>
                      <Forward className="w-4 h-4 text-[#4ec9c0]/65" strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
