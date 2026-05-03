import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Bot, User, Loader2, Save, Trash2,
  ChevronRight, History, Mic,
  X, Play, Pause, Paperclip, Camera, Square, Volume2, VolumeX
} from 'lucide-react';
import { SESSIONS, SPEAKERS } from '../data';
import { cn } from '@/src/lib/utils';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import WaveSurfer from 'wavesurfer.js';
import BackButton from '@/src/components/BackButton';
import { useToast } from '@/src/components/Toast';

interface ChatMessage {
  role: 'user' | 'bot' | 'other';
  text?: string;
  time: string;
  media?: {
    type: 'image' | 'video' | 'audio' | 'video-bubble';
    url: string;
    duration?: number;
    thumbnail?: string;
  };
}

interface SavedChat {
  id: string;
  title: string;
  messages: ChatMessage[];
  date: string;
}

const MAX_RECORDING_SEC = 60;

// Detect speaker avatar (DiceBear avataaars). Falls back to generic seed.
const avatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

export default function Chat() {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: 'Привет! Я здесь, чтобы помочь тебе не пропустить всё самое интересное на ТехФорум. Что подсказать?', time: '17:05' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Ассистент');
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  // DM теперь живые: contacts, диалоги и отправка идут через /api/v1/messages*.
  // privateMessages здесь — кэш на текущий tab, обновляется polling'ом.
  type DmContact = {
    id: string; // userId собеседника
    name: string;
    role: string;
    online?: boolean;
    avatar: string;
    lastMsg: string;
    unread: number;
  };
  const [contacts, setContacts] = useState<DmContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<DmContact[]>([]);
  const [meId, setMeId] = useState<string | null>(null);

  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});

  // Узнаём свой userId один раз — нужен чтобы отличать свои сообщения
  // в payload /messages/with/:id (fromUserId === meId → 'user', иначе 'other').
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const r = await fetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
        if (r.ok) {
          const me = await r.json();
          if (mounted) setMeId(me?.id ?? null);
        }
      } catch { /* offline — DM не работает, но UI не рушим */ }
    })();
    return () => { mounted = false; };
  }, []);

  // Загружаем contacts при заходе на таб "Личные"; рефетчим каждые 10с
  // чтобы видеть новые входящие.
  useEffect(() => {
    if (activeTab !== 'Личные') return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchContacts = async () => {
      try {
        setContactsLoading(true);
        const r = await fetch(resolveApiUrl('/messages/contacts'), { credentials: 'include' });
        if (!r.ok) return;
        const data: Array<{ userId: string; lastText: string; lastAt: string; unread: number; user: { name: string; role: string; avatar: string } | null }> = await r.json();
        if (!mounted) return;
        setContacts(data.filter((c) => c.user).map((c) => ({
          id: c.userId,
          name: c.user!.name,
          role: c.user!.role || 'Участник',
          avatar: resolveAssetUrl(c.user!.avatar) || avatarUrl(c.user!.name),
          lastMsg: c.lastText,
          unread: c.unread,
        })));
      } catch { /* offline */ } finally {
        if (mounted) setContactsLoading(false);
      }
    };
    void fetchContacts();
    timer = setInterval(() => { void fetchContacts(); }, 10_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [activeTab]);

  // Когда выбран собеседник — poll messages раз в 5 секунд.
  useEffect(() => {
    if (activeTab !== 'Личные' || !selectedContact || !meId) return;
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchDialog = async () => {
      try {
        const r = await fetch(resolveApiUrl(`/messages/with/${selectedContact}`), { credentials: 'include' });
        if (!r.ok) return;
        const arr: Array<{ id: string; fromUserId: string; toUserId: string; text: string; createdAt: string }> = await r.json();
        if (!mounted) return;
        const formatted: ChatMessage[] = arr.map((m) => ({
          role: m.fromUserId === meId ? 'user' : 'other',
          text: m.text,
          time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setPrivateMessages((prev) => ({ ...prev, [selectedContact]: formatted }));
      } catch { /* noop */ }
    };
    void fetchDialog();
    timer = setInterval(() => { void fetchDialog(); }, 5_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [activeTab, selectedContact, meId]);

  // Поиск юзеров для нового диалога — debounced 350мс.
  useEffect(() => {
    if (activeTab !== 'Личные' || selectedContact) return;
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    let mounted = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(resolveApiUrl(`/users/search?q=${encodeURIComponent(searchQ.trim())}`), { credentials: 'include' });
        if (!r.ok) return;
        const arr: Array<{ id: string; name: string; role: string; avatar: string }> = await r.json();
        if (!mounted) return;
        // Исключаем тех с кем уже есть переписка — они выше в списке.
        const existingIds = new Set(contacts.map((c) => c.id));
        setSearchResults(arr.filter((u) => !existingIds.has(u.id)).map((u) => ({
          id: u.id, name: u.name, role: u.role || 'Участник',
          avatar: resolveAssetUrl(u.avatar) || avatarUrl(u.name),
          lastMsg: 'Начать диалог',
          unread: 0,
        })));
      } catch { /* noop */ }
    }, 350);
    return () => { mounted = false; clearTimeout(t); };
  }, [searchQ, activeTab, selectedContact, contacts]);

  const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video' | 'audio', url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);

  // ============ MediaMessage component ============
  const MediaMessage = ({ media, role }: { media: NonNullable<ChatMessage['media']>, role: ChatMessage['role'] }) => {
    const wavesurferRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const ws = useRef<WaveSurfer | null>(null);

    useEffect(() => {
      if (media.type === 'audio' && wavesurferRef.current) {
        try {
          ws.current = WaveSurfer.create({
            container: wavesurferRef.current,
            waveColor: role === 'user' ? '#0f172a' : '#334155',
            progressColor: role === 'user' ? '#ffffff' : '#7b4ac0',
            cursorWidth: 0,
            barWidth: 2,
            barGap: 3,
            height: 30,
            url: media.url,
          });
          ws.current.on('finish', () => setIsPlaying(false));
          ws.current.on('error', (err) => console.error('WaveSurfer Error:', err));
        } catch (error) {
          console.error('Failed to initialize WaveSurfer:', error);
        }
        return () => ws.current?.destroy();
      }
    }, [media.url, media.type, role]);

    const togglePlay = () => {
      if (ws.current) {
        ws.current.playPause();
        setIsPlaying(!isPlaying);
      }
    };

    if (media.type === 'image') {
      return (
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 mt-2">
          <img
            src={media.url}
            alt="Shared media"
            className="max-w-full h-auto object-cover max-h-80"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (media.type === 'video-bubble') {
      // BUG_FIX_CONTEXT: previously had `muted` hardcoded — Telegram-style video
      // bubbles play with sound by default; user can tap to mute.
      return (
        <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-accent shadow-[0_0_20px_rgba(0,212,255,0.2)] mt-2 mx-auto bg-black">
          <video
            src={media.url}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-full text-white"
            aria-label={muted ? 'unmute' : 'mute'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      );
    }

    if (media.type === 'audio') {
      return (
        <div className="flex items-center gap-3 py-2 px-1 min-w-[200px] mt-2 bg-white/5 rounded-2xl">
          <button
            onClick={togglePlay}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0',
              role === 'user' ? 'bg-white text-accent' : 'bg-accent text-[#03161c]'
            )}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
          </button>
          <div className="flex-1 space-y-1">
            <div ref={wavesurferRef} />
            <div className="flex justify-between text-[8px] font-semibold uppercase tracking-widest opacity-40">
              <span>VOICE_LOG</span>
            </div>
          </div>
        </div>
      );
    }

    if (media.type === 'video') {
      return (
        <div className="relative rounded-[1.5rem] overflow-hidden border border-white/10 aspect-video bg-black/40 mt-2">
          <video src={media.url} controls playsInline className="w-full h-full object-cover" />
        </div>
      );
    }

    return null;
  };

  // ============ Media handlers ============
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setMediaPreview({ type, url });
  };

  const startMediaRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? { facingMode: 'user', width: 480, height: 480 } : false
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        const url = URL.createObjectURL(blob);
        sendMultimediaMessage(type === 'video' ? 'video-bubble' : 'audio', url);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setIsRecording(type);
      setRecordingTime(0);
      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SEC) {
            // auto-stop on max duration
            stopMediaRecording();
          }
          return next;
        });
      }, 1000);

      // Attach live preview for video AFTER state flip so the <video> element exists.
      if (type === 'video') {
        setTimeout(() => {
          if (livePreviewRef.current && streamRef.current) {
            livePreviewRef.current.srcObject = streamRef.current;
          }
        }, 50);
      }
    } catch (err) {
      console.error('Recording failed:', err);
      toast.show('Не удалось получить доступ к камере/микрофону. Убедитесь, что разрешения предоставлены.');
    }
  };

  const stopMediaRecording = () => {
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(null);
  };

  const cancelRecording = () => {
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    // detach onstop so blob isn't sent
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(null);
    setRecordingTime(0);
  };

  const sendMultimediaMessage = (type: ChatMessage['media'] extends infer M ? (M extends { type: infer T } ? T : never) : never, url: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage: ChatMessage = {
      role: 'user',
      time,
      media: { type: type as NonNullable<ChatMessage['media']>['type'], url }
    };

    if (activeTab === 'Личные' && selectedContact) {
      setPrivateMessages((prev) => ({
        ...prev,
        [selectedContact]: [...(prev[selectedContact] || []), newMessage]
      }));
    } else {
      setMessages((prev) => [...prev, newMessage]);
    }
    setMediaPreview(null);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, privateMessages, selectedContact, activeTab]);

  useEffect(() => {
    const stored = localStorage.getItem('techforum_chats');
    if (stored) {
      try { setSavedChats(JSON.parse(stored)); } catch (e) { console.error('Failed to parse saved chats', e); }
    }
  }, []);

  const saveToStorage = (chats: SavedChat[]) => {
    localStorage.setItem('techforum_chats', JSON.stringify(chats));
    setSavedChats(chats);
  };

  useEffect(() => {
    if (messages.length <= 1) return;
    const firstUserMsg = messages.find((m) => m.role === 'user');
    const currentTitle = (firstUserMsg?.text?.slice(0, 30) || (firstUserMsg?.media ? `Медиа (${firstUserMsg.media.type})` : 'Новый чат')) + '...';
    const currentId = currentChatId || Date.now().toString();
    if (!currentChatId) setCurrentChatId(currentId);

    const updatedChats = [...savedChats];
    const existingIndex = updatedChats.findIndex((c) => c.id === currentId);

    const chatData: SavedChat = {
      id: currentId,
      title: currentTitle,
      messages: [...messages],
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    };

    if (existingIndex >= 0) {
      updatedChats[existingIndex] = chatData;
      saveToStorage(updatedChats);
    } else {
      saveToStorage([chatData, ...updatedChats]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const context = `
    Вы — ассистент ТехФорум.
    СПИКЕРЫ: ${JSON.stringify(SPEAKERS)}
    СЕССИИ: ${JSON.stringify(SESSIONS)}
    Отвечайте кратко на русском языке.
  `;

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setInput('');

    if (activeTab === 'Личные' && selectedContact) {
      // Optimistic UI: сразу показываем своё сообщение, затем шлём POST.
      // На ошибке — заменяем на "Не доставлено" (toast + красный bubble не
      // делаем сейчас, чтобы не ломать UI Ганта, просто toast).
      setPrivateMessages((prev) => ({
        ...prev,
        [selectedContact]: [...(prev[selectedContact] || []), { role: 'user', text: userMsg, time }],
      }));
      try {
        const r = await fetch(resolveApiUrl('/messages'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUserId: selectedContact, text: userMsg }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          toast.show(`Сообщение не доставлено: ${j?.error || r.status}`);
        }
      } catch {
        toast.show('Сообщение не доставлено: нет сети');
      }
      return;
    }

    if (activeTab === 'Мероприятие') {
      toast.show('Ваше сообщение отправлено в общий чат!');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: userMsg, time }]);
    setLoading(true);
    try {
      const assistantUrl = resolveApiUrl('/ai/chat');
      const res = await fetch(assistantUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg, context }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error ? String(payload.error) : 'ai_request_failed';
        throw new Error(message);
      }
      const payload = await res.json();
      const answer = typeof payload?.text === 'string' && payload.text.trim() ? payload.text : 'Ошибка обработки.';
      setMessages((prev) => [...prev, { role: 'bot', text: answer, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'bot', text: 'Ошибка соединения с ИИ.', time }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChat = () => {
    setMessages([{ role: 'bot', text: 'Создан новый чат. Чем еще я могу помочь?', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setCurrentChatId(null);
    toast.show('Текущий чат сохранен в историю. Начата новая сессия.');
  };

  const deleteSavedChat = (id: string) => {
    const updated = savedChats.filter((c) => c.id !== id);
    saveToStorage(updated);
    if (currentChatId === id) {
      setCurrentChatId(null);
      setMessages([{ role: 'bot', text: 'Предыдущий чат был удален. Чем могу помочь?', time: '00:00' }]);
    }
  };

  const loadSavedChat = (chat: SavedChat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setActiveTab('Ассистент');
  };

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const showInputBar = activeTab !== 'История' && (activeTab !== 'Личные' || selectedContact);
  const selectedContactObj = contacts.find((c) => c.id === selectedContact);

  return (
    // Унифицированная структура для всех 4 вкладок (Мероприятие/Личные/
    // Ассистент/История): один blueprint-фон через AppBackground, sticky
    // header с одинаковыми табами, контент-зона. Раньше у каждой вкладки
    // мог незаметно отличаться bg/padding/scroll — теперь всё в одном
    // wrapper'е и единой scroll-логике.
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Sticky header — одинаковый bg для всех вкладок */}
      <header
        className="sticky top-0 z-30 bg-[#03161c]/85 backdrop-blur-xl border-b border-[#4ec9c0]/28"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 56px)' }}
      >
        <BackButton />
        <div className="px-5 pb-3 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#d8f0ee]">
              {activeTab === 'Личные' && selectedContactObj ? selectedContactObj.name : 'Чат'}
            </h1>
            {activeTab === 'Ассистент' && (
              <button
                onClick={handleSaveChat}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-xl text-accent text-[10px] font-semibold uppercase tracking-widest hover:bg-accent/20 transition-all active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                Новый чат
              </button>
            )}
          </div>
          <div className="flex bg-[#0a2f38]/55/50 border border-[#4ec9c0]/28 p-1 rounded-2xl overflow-x-auto scrollbar-hide">
            {['Мероприятие', 'Личные', 'Ассистент', 'История'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab !== 'Личные') setSelectedContact(null);
                }}
                className={cn(
                  'flex-1 py-2 px-3 rounded-xl text-[9px] font-semibold uppercase tracking-widest transition-all whitespace-nowrap',
                  activeTab === tab ? 'bg-accent text-[#03161c] shadow-lg shadow-accent/20' : 'text-[#7aa8a4] hover:text-[#d8f0ee]'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Scrollable message feed */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-5">
          {activeTab === 'Ассистент' ? (
            // BUG_FIX_CONTEXT: Ассистент теперь в стиле «Мероприятие» — имя
            // сверху, time-stamp, bubble bg-[#0a2f38]/55/40 rounded-3xl rounded-tl-none.
            // Унифицировано по требованию заказчика. AI bot слева, user тоже
            // слева (одна колонка), различимы по аватару и имени.
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const name = isUser ? 'Вы' : 'Ассистент';
                return (
                  <div key={i} className="flex gap-4 group">
                    <div className={cn(
                      'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border',
                      isUser ? 'bg-accent text-[#03161c] border-accent shadow-lg shadow-accent/20' : 'bg-card border-[#4ec9c0]/28 text-accent'
                    )}>
                      {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={cn('text-xs font-semibold uppercase tracking-widest', isUser ? 'text-accent' : 'text-[#d8f0ee]')}>
                          {name}
                        </span>
                        <span className="text-[9px] font-mono text-[#7aa8a4]/40">{msg.time}</span>
                      </div>
                      <div className="bg-[#0a2f38]/55/40 border border-[#4ec9c0]/28 p-4 rounded-3xl rounded-tl-none text-[13px] leading-relaxed text-[#d8f0ee]/85">
                        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        {msg.media && <MediaMessage media={msg.media} role={msg.role} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-card border border-[#4ec9c0]/28 flex items-center justify-center text-accent shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-[#0a2f38]/55/40 border border-[#4ec9c0]/28 px-4 py-3 rounded-3xl rounded-tl-none flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    <span className="text-[11px] text-[#7aa8a4] font-bold uppercase tracking-widest">Думаю...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : activeTab === 'Мероприятие' ? (
            <div className="flex flex-col gap-4">
              {[
                { user: 'Алексей', text: 'Всем привет! Кто уже на главной сцене? Там Дмитрий Волков начинает через 10 минут.', time: '09:50', id: '1' },
                { user: 'Мария', text: 'Я тут! Очередь на регистрацию была огромная, но уже внутри.', time: '09:52', id: '2' },
                { user: 'Игорь', text: 'Ребята, какой пароль от Wi-Fi в Зале А?', time: '09:55', id: '3' },
                { user: 'Организатор', text: 'Пароль от Wi-Fi: TF2026_Guest. Приятного форума!', time: '09:56', isStaff: true },
                { user: 'Елена', text: 'Спикер в Зале Б просто огонь! Всем советую заглянуть после кофе-брейка.', time: '10:15' },
              ].map((msg, i) => (
                <div key={i} className="flex gap-4 group">
                  <button
                    onClick={() => {
                      if (msg.id) {
                        setSelectedContact(msg.id);
                        setActiveTab('Личные');
                      }
                    }}
                    className={cn(
                      'w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center text-sm font-semibold shrink-0 border transition-transform active:scale-90',
                      msg.isStaff ? 'bg-accent text-[#03161c] border-accent shadow-lg shadow-accent/20' : 'bg-card border-[#4ec9c0]/28 text-[#d8f0ee] hover:border-accent'
                    )}
                  >
                    <img src={avatarUrl(msg.user)} alt={msg.user} className="w-full h-full object-cover" />
                  </button>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (msg.id) {
                            setSelectedContact(msg.id);
                            setActiveTab('Личные');
                          }
                        }}
                        className={cn('text-xs font-semibold uppercase tracking-widest hover:text-accent transition-colors text-left', msg.isStaff ? 'text-accent' : 'text-[#d8f0ee]')}
                      >
                        {msg.user}
                        {msg.isStaff && <span className="ml-2 text-[8px] bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded italic font-bold">STAFF</span>}
                      </button>
                      <span className="text-[9px] font-mono text-[#7aa8a4]/40">{msg.time}</span>
                    </div>
                    <div className="bg-[#0a2f38]/55/40 border border-[#4ec9c0]/28 p-4 rounded-3xl rounded-tl-none text-[13px] leading-relaxed text-[#d8f0ee]/80">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ))}
              <div className="py-4 text-center">
                <span className="text-[10px] text-[#7aa8a4] font-semibold uppercase tracking-[0.3em] opacity-30">КОНЕЦ ИСТОРИИ</span>
              </div>
              <div ref={messagesEndRef} />
            </div>
          ) : activeTab === 'Личные' ? (
            <div className="flex flex-col gap-3">
              {!selectedContact ? (
                <div className="space-y-4">
                  {/* Поиск юзеров для нового диалога */}
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Найти участника по имени или email…"
                    className="w-full bg-[#0a2f38]/40 border border-[#4ec9c0]/28 rounded-2xl px-4 py-3 text-[13px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/60 outline-none focus:border-[#4ec9c0]/55"
                  />
                  {searchResults.length > 0 && (
                    <div className="space-y-2 pb-2 border-b border-[#4ec9c0]/15">
                      <p className="text-[10px] uppercase tracking-widest text-[#7aa8a4]">Начать новый диалог</p>
                      {searchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedContact(r.id); setSearchQ(''); setSearchResults([]); }}
                          className="w-full flex items-center gap-3 bg-[#0a2f38]/30 border border-[#4ec9c0]/15 p-3 rounded-2xl hover:border-[#4ec9c0]/40 transition-all"
                        >
                          <img src={r.avatar} alt={r.name} className="w-10 h-10 rounded-2xl border border-[#4ec9c0]/28 object-cover" />
                          <div className="flex-1 text-left">
                            <p className="text-[13px] font-semibold text-[#d8f0ee]">{r.name}</p>
                            <p className="text-[10px] text-[#7aa8a4] uppercase tracking-widest">{r.role}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#4ec9c0]" />
                        </button>
                      ))}
                    </div>
                  )}

                  {contacts.length === 0 && !contactsLoading && searchQ.trim().length < 2 && (
                    <div className="text-center py-8 text-[12px] text-[#7aa8a4]">
                      Здесь появятся ваши переписки.<br/>Найдите участника выше, чтобы начать диалог.
                    </div>
                  )}

                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      onClick={() => setSelectedContact(contact.id)}
                      className="w-full flex items-center gap-4 bg-[#0a2f38]/55/30 border border-[#4ec9c0]/28 p-4 rounded-3xl hover:border-accent/40 active:scale-[0.98] transition-all group"
                    >
                      <div className="relative">
                        <div className="w-12 h-12 bg-card border border-[#4ec9c0]/28 rounded-2xl overflow-hidden flex items-center justify-center">
                          <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                        </div>
                        {contact.unread > 0 && (
                          <div className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#4ec9c0] border-2 border-[#03161c] rounded-full text-[9px] font-bold text-[#03161c] flex items-center justify-center">{contact.unread}</div>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-sm font-bold text-[#d8f0ee]">{contact.name}</span>
                          <span className="text-[9px] text-[#7aa8a4]">15:30</span>
                        </div>
                        <p className="text-[11px] text-[#7aa8a4] truncate pr-4">{contact.lastMsg}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#7aa8a4] group-hover:text-accent transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 flex flex-col">
                  <button
                    onClick={() => setSelectedContact(null)}
                    className="flex items-center gap-2 text-accent text-[10px] font-semibold uppercase tracking-widest hover:opacity-70 transition-opacity self-start"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Назад к списку
                  </button>
                  {selectedContactObj && (
                    <div className="flex items-center gap-3 pb-3 border-b border-[#4ec9c0]/28">
                      <img src={avatarUrl(selectedContactObj.name)} alt={selectedContactObj.name} className="w-10 h-10 rounded-2xl border border-[#4ec9c0]/28 object-cover" />
                      <div>
                        <p className="text-sm font-bold text-[#d8f0ee]">{selectedContactObj.name}</p>
                        <p className="text-[10px] text-[#7aa8a4] uppercase tracking-widest">{selectedContactObj.role}</p>
                      </div>
                    </div>
                  )}

                  {/* BUG_FIX_CONTEXT: Личные DM теперь в стиле «Мероприятие» —
                      имя сверху, time-stamp, bubble bg-[#0a2f38]/55/40 rounded-3xl
                      rounded-tl-none. Унифицировано по требованию заказчика. */}
                  <div className="flex flex-col gap-4 pt-2">
                    {(privateMessages[selectedContact] || []).map((msg, i) => {
                      const isUser = msg.role === 'user';
                      const name = isUser ? 'Вы' : selectedContactObj?.name || 'Собеседник';
                      const avatarSrc = isUser ? null : avatarUrl(selectedContactObj?.name || 'user');
                      return (
                        <div key={i} className="flex gap-4 group">
                          <div className={cn(
                            'w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 border',
                            isUser ? 'bg-accent text-[#03161c] border-accent shadow-lg shadow-accent/20' : 'bg-card border-[#4ec9c0]/28'
                          )}>
                            {isUser ? (
                              <User className="w-5 h-5" />
                            ) : (
                              <img src={avatarSrc!} alt={name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <span className={cn('text-xs font-semibold uppercase tracking-widest', isUser ? 'text-accent' : 'text-[#d8f0ee]')}>
                                {name}
                              </span>
                              <span className="text-[9px] font-mono text-[#7aa8a4]/40">{msg.time}</span>
                            </div>
                            <div className="bg-[#0a2f38]/55/40 border border-[#4ec9c0]/28 p-4 rounded-3xl rounded-tl-none text-[13px] leading-relaxed text-[#d8f0ee]/85">
                              {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                              {msg.media && <MediaMessage media={msg.media} role={msg.role} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {savedChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-card border border-[#4ec9c0]/28 rounded-3xl flex items-center justify-center text-[#7aa8a4]/30">
                    <History className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[#d8f0ee] font-bold">История пуста</p>
                    <p className="text-[10px] text-[#7aa8a4] uppercase tracking-widest">Сохраненные чаты появятся здесь</p>
                  </div>
                </div>
              ) : (
                savedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="bg-card border border-[#4ec9c0]/28 rounded-3xl p-5 hover:border-accent/40 transition-all group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1 flex-1 min-w-0 pr-4">
                        <p className="text-[9px] text-accent font-semibold uppercase tracking-widest leading-none">{chat.date}</p>
                        <h4 className="text-sm font-bold text-[#d8f0ee] truncate">{chat.title}</h4>
                      </div>
                      <button
                        onClick={() => deleteSavedChat(chat.id)}
                        className="p-2 text-[#7aa8a4] hover:text-red-500 transition-colors active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] text-[#7aa8a4] font-medium">{chat.messages.length} сообщений</p>
                      <button
                        onClick={() => loadSavedChat(chat)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent text-[10px] font-semibold uppercase tracking-widest hover:bg-accent/20 transition-all active:scale-95"
                      >
                        Открыть
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {/* Spacer for input bar */}
          {showInputBar && <div className="h-4" />}
        </div>
      </div>

      {/* Live video preview overlay */}
      <AnimatePresence>
        {isRecording === 'video' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none"
          >
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
              <div className="relative w-[200px] h-[200px] rounded-full overflow-hidden border-4 border-accent shadow-[0_0_40px_rgba(0,212,255,0.5)] bg-black">
                <video
                  ref={livePreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500/90 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-[9px] font-semibold text-white uppercase tracking-widest">REC</span>
                </div>
              </div>
              <div className="text-white font-mono text-2xl font-semibold">{fmtTimer(recordingTime)}</div>
              <div className="flex items-center gap-4">
                <button
                  onClick={cancelRecording}
                  className="w-14 h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
                  aria-label="Отмена"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={stopMediaRecording}
                  className="w-16 h-16 bg-accent rounded-full flex items-center justify-center text-[#03161c] shadow-lg shadow-accent/30 active:scale-95"
                  aria-label="Стоп"
                >
                  <Square className="w-7 h-7 fill-current" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky input bar */}
      {showInputBar && (
        <div
          className="sticky bottom-0 left-0 right-0 px-4 pt-3 bg-[#0f1218]/95 backdrop-blur-xl border-t border-[#4ec9c0]/28 z-30"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <AnimatePresence>
            {mediaPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="mb-3 relative rounded-3xl overflow-hidden border-2 border-accent/40 bg-card p-2"
              >
                <button
                  onClick={() => setMediaPreview(null)}
                  className="absolute top-4 right-4 z-10 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {mediaPreview.type === 'image' ? (
                  <img src={mediaPreview.url} className="w-full h-48 object-cover rounded-2xl" />
                ) : (
                  <video src={mediaPreview.url} className="w-full h-48 object-cover rounded-2xl" />
                )}
                <button
                  onClick={() => sendMultimediaMessage(mediaPreview.type, mediaPreview.url)}
                  className="mt-2 w-full py-2 bg-accent text-[#03161c] text-[10px] font-semibold uppercase tracking-widest rounded-xl"
                >
                  Отправить медиа
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio recording overlay (in input zone) */}
          {isRecording === 'audio' ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-card border border-accent/30 rounded-[1.5rem] px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-mono font-semibold text-[#d8f0ee]">{fmtTimer(recordingTime)}</span>
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-[#7aa8a4] font-bold uppercase tracking-widest">
                  Слайд влево чтобы отменить
                </span>
              </div>
              <button
                onClick={cancelRecording}
                className="w-9 h-9 bg-white/5 border border-[#4ec9c0]/28 rounded-xl flex items-center justify-center text-[#7aa8a4] active:scale-95"
                aria-label="Отмена"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={stopMediaRecording}
                className="w-11 h-11 bg-green-500 rounded-2xl flex items-center justify-center text-white active:scale-95 shadow-lg shadow-green-500/30"
                aria-label="Стоп"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={handleMediaUpload}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 bg-card border border-[#4ec9c0]/28 rounded-[1.25rem] flex items-center justify-center text-[#7aa8a4] hover:text-accent transition-colors active:scale-95 shrink-0"
                aria-label="Прикрепить"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder={
                  activeTab === 'Мероприятие' ? 'Написать всем...' :
                  activeTab === 'Личные' ? `Написать ${selectedContactObj?.name || ''}...` :
                  'Спросить ассистента...'
                }
                rows={1}
                className="flex-1 bg-[#1a1e2a] border border-[#4ec9c0]/28 rounded-[1.5rem] px-5 py-3 text-sm focus:outline-none focus:border-accent/40 text-[#d8f0ee] placeholder:text-[#7aa8a4]/60 resize-none min-h-[44px] max-h-32"
              />

              {!input.trim() ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startMediaRecording('audio')}
                    className="w-11 h-11 bg-card border border-[#4ec9c0]/28 rounded-[1.25rem] flex items-center justify-center text-[#7aa8a4] hover:text-accent transition-colors active:scale-95"
                    aria-label="Запись аудио"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => startMediaRecording('video')}
                    className="w-11 h-11 bg-card border border-[#4ec9c0]/28 rounded-[1.25rem] flex items-center justify-center text-[#7aa8a4] hover:text-accent transition-colors active:scale-95"
                    aria-label="Видео-сообщение"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="w-11 h-11 bg-accent rounded-[1.25rem] flex items-center justify-center text-[#03161c] disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-lg shadow-accent/20 shrink-0"
                  aria-label="Отправить"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

