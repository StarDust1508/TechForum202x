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
import { Search, Send, Bot, User as UserIcon, ChevronRight, Sparkles } from 'lucide-react';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';

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
function Avatar({ name, src, size = 48 }: { name: string; src?: string | null; size?: number }) {
  const showImg = isUploadedAvatar(src) && src;
  return (
    <div
      className="relative rounded-full overflow-hidden flex items-center justify-center bg-[#0a2f38] border border-[#4ec9c0]/35 shrink-0"
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img src={resolveAssetUrl(src)} alt={name} className="w-full h-full object-cover" />
      ) : (
        <UserIcon className="w-1/2 h-1/2 text-[#4ec9c0]/85" strokeWidth={1.4} />
      )}
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
    <div
      className="px-5 pb-10"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
      }}
    >
      <BackButton />

      <header className="mb-5">
        <h1 className="font-display-cyrl text-[28px] font-semibold text-[#d8f0ee]">Чат</h1>
        <p className="text-[12px] text-[#7aa8a4] mt-1">Переписки и AI-ассистент форума</p>
      </header>

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
    </div>
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
      const arr: Array<{ id: string; fromUserId: string; text: string; createdAt: string }> = await r.json();
      setMessages(arr.map((m) => ({
        id: m.id,
        fromMe: m.fromUserId === meId,
        text: m.text,
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    // Optimistic
    const optimisticId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: optimisticId, fromMe: true, text, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const r = await fetch(resolveApiUrl('/messages'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: userId, text }),
      });
      if (!r.ok) {
        // откатываем optimistic
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setInput(text); // вернём для повторной отправки
      } else {
        // подменяем optimistic настоящим id из ответа
        const real = await r.json();
        setMessages((prev) => prev.map((m) => m.id === optimisticId
          ? { ...m, id: real.id, createdAt: real.createdAt }
          : m,
        ));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '100dvh' }}>
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
          ←
        </button>
        <Avatar name={contact?.name || ''} src={contact?.avatar} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#d8f0ee] truncate">{contact?.name || 'Участник'}</p>
          <p className="text-[11px] text-[#7aa8a4] truncate">{contact?.role || ''}</p>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-2"
        style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {messages.length === 0 && (
          <p className="text-center text-[12px] text-[#7aa8a4] py-8">Сообщений пока нет.<br/>Напишите первое.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                m.fromMe
                  ? 'bg-[#4ec9c0]/85 text-[#03161c] rounded-br-md'
                  : 'bg-[#0a2f38]/75 text-[#d8f0ee] border border-[#4ec9c0]/22 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <span className={`block text-[9px] mt-1 ${m.fromMe ? 'text-[#03161c]/60 text-right' : 'text-[#7aa8a4]'}`}>
                {formatTime(m.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
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
          placeholder="Сообщение…"
          rows={1}
          className="flex-1 bg-[#0a2f38]/55 border border-[#4ec9c0]/28 rounded-2xl px-4 py-2.5 text-[14px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/70 outline-none focus:border-[#4ec9c0]/55 resize-none max-h-32"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="h-11 w-11 flex items-center justify-center rounded-2xl bg-[#4ec9c0] text-[#03161c] disabled:opacity-40 active:scale-90 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
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
    <div className="flex flex-col h-full" style={{ minHeight: '100dvh' }}>
      <header
        className="sticky top-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-b border-[#4ec9c0]/22 px-4 py-2.5 flex items-center gap-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      >
        <button
          onClick={() => navigate('/chat')}
          aria-label="Назад"
          className="h-9 w-9 flex items-center justify-center rounded-[10px] border border-[#4ec9c0]/35 bg-[#03161c]/60 text-[#4ec9c0] active:scale-90"
        >
          ←
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4ec9c0]/40 to-[#4ec9c0]/15 border border-[#4ec9c0]/55 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-[#4ec9c0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-[#d8f0ee] truncate">AI-ассистент</p>
          <p className="text-[11px] text-[#7aa8a4] truncate">Знает всё о программе форума</p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-2"
        style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
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
