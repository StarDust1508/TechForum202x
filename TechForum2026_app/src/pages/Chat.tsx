import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Bot, User,
  ChevronRight, ChevronLeft, Mic,
  X, Play, Pause, Paperclip, Camera, Square, Volume2, VolumeX,
  Sparkles, MessageCircle,
  Copy, Pencil, Trash2, Forward, Check, Download, ShieldAlert, Ban
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import WaveSurfer from 'wavesurfer.js';
import { resolveApiUrl, resolveAssetUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import { useToast } from '@/src/components/Toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDmSocket, sendDm, type DmSocketEvent } from '@/src/lib/dmSocket';

interface ChatMessage {
  id?: string;
  role: 'user' | 'bot' | 'other';
  text?: string;
  time: string;
  edited?: boolean;
  media?: {
    type: 'image' | 'video' | 'audio' | 'video-bubble';
    url: string;
  };
}

/* ── Context menu for messages ── */
interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  msgIndex: number;
  msgTab: 'assistant' | 'dm';
  isOwn: boolean;
  hasMedia: boolean;
  hasText: boolean;
}

const MessageContextMenu = ({
  state, onClose, onCopy, onEdit, onDelete, onForward, onDownload,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onDownload: () => void;
}) => {
  if (!state.visible) return null;
  const menuItems = [
    { icon: Copy, label: 'Копировать', action: onCopy, show: state.hasText },
    { icon: Download, label: 'Скачать', action: onDownload, show: state.hasMedia },
    { icon: Pencil, label: 'Редактировать', action: onEdit, show: state.isOwn && state.hasText },
    { icon: Forward, label: 'Переслать', action: onForward, show: true },
    { icon: Trash2, label: 'Удалить', action: onDelete, show: state.isOwn },
  ].filter(it => it.show);

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[61] min-w-[180px] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        style={{ top: Math.min(state.y, window.innerHeight - 220), left: Math.min(Math.max(state.x - 90, 8), window.innerWidth - 196) }}
      >
        {menuItems.map((it, i) => (
          <button
            key={it.label}
            onClick={() => { it.action(); onClose(); }}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium transition-colors active:bg-foreground/10',
              it.label === 'Удалить' ? 'text-rose-400' : 'text-foreground/85',
              i < menuItems.length - 1 && 'border-b border-border/50',
            )}
          >
            <it.icon className="w-4 h-4 shrink-0" />
            {it.label}
          </button>
        ))}
      </motion.div>
    </>
  );
};

const MAX_RECORDING_SEC = 60;

const MediaMessage = memo(({ media, role }: { media: NonNullable<ChatMessage['media']>, role: ChatMessage['role'] }) => {
  // All hooks MUST be at the top level — never inside conditionals
  const wavesurferRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Кружок автоплеит БЕЗ звука (иначе политика автоплея WebView его блокирует
  // → серый плейсхолдер вместо видео). paused=true на старте → чистая кнопка
  // Play, если автоплей всё же не разрешён (тап запускает).
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  const ws = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (media.type === 'audio' && wavesurferRef.current) {
      try {
        ws.current = WaveSurfer.create({
          container: wavesurferRef.current,
          waveColor: role === 'user' ? 'rgba(255,255,255,0.35)' : 'rgba(0,255,255,0.35)',
          progressColor: role === 'user' ? '#ffffff' : '#00ffff',
          cursorWidth: 0,
          barWidth: 3,
          barGap: 2,
          barRadius: 3,
          height: 36,
          barMinHeight: 3,
          normalize: true,
          url: media.url,
        });
        ws.current.on('finish', () => setIsPlaying(false));
      } catch (e) { console.error('WaveSurfer error:', e); }
      return () => ws.current?.destroy();
    }
  }, [media.url, media.type, role]);

  // Кружок (video-note): пробуем автоплей без звука на маунте. Если WebView
  // требует жест — останется пауза с кнопкой Play, тап запустит.
  useEffect(() => {
    if (media.type === 'video-bubble' && videoRef.current) {
      const v = videoRef.current;
      v.muted = true;
      v.play().then(() => setPaused(false)).catch(() => setPaused(true));
    }
  }, [media.type, media.url]);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setPaused(false);
      } else {
        videoRef.current.pause();
        setPaused(true);
      }
    }
  }, []);

  if (media.type === 'image') {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border mt-2">
        <img src={media.url} alt="" className="max-w-full h-auto object-cover max-h-80" loading="lazy" />
      </div>
    );
  }

  if (media.type === 'video-bubble') {
    return (
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-accent shadow-neon-cyan mt-2 mx-auto bg-black">
        <video ref={videoRef} src={media.url} autoPlay loop muted={muted} playsInline className="w-full h-full object-cover"
          onClick={togglePlay} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />
        <AnimatePresence>
          {paused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
              onClick={togglePlay}
            >
              <Play className="w-12 h-12 text-white drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
          className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-full text-white z-10">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  if (media.type === 'audio') {
    return (
      <div className="flex items-center gap-3 py-2 px-1 min-w-[200px] mt-2 bg-foreground/5 rounded-xl">
        <button onClick={() => { ws.current?.playPause(); setIsPlaying(!isPlaying); }}
          className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            role === 'user' ? 'bg-foreground/20 text-white' : 'bg-accent/20 text-accent')}>
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1"><div ref={wavesurferRef} /></div>
      </div>
    );
  }

  if (media.type === 'video') {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border aspect-video bg-black/40 mt-2">
        <video src={media.url} controls playsInline className="w-full h-full object-cover" />
      </div>
    );
  }
  return null;
});

/** Preload an image URL into browser cache — returns a promise that resolves when loaded */
function preloadImage(url: string): Promise<void> {
  return new Promise(resolve => {
    if (!url) { resolve(); return; }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export default function Chat() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dmTarget = searchParams.get('dm');
  const [activeTab, setActiveTab] = useState<'assistant' | 'dm'>(dmTarget ? 'dm' : 'assistant');
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>('');
  const [myId, setMyId] = useState<string>('');
  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl('/auth/me'), { credentials: 'include' });
        if (r.ok) {
          const u = await r.json();
          const av = u.avatar || '';
          const avatarUrl = av.startsWith('/uploads/') ? resolveAssetUrl(av) : (av || null);
          // Preload own avatar before showing
          if (avatarUrl) await preloadImage(avatarUrl);
          setMyAvatar(avatarUrl);
          setMyName(u.name || '');
          setMyId(u.id || '');
        }
      } catch { /* offline */ }
    })();
  }, []);

  // AI Assistant state — load from server for persistence
  const defaultGreeting: ChatMessage[] = [
    { role: 'bot', text: 'Привет! 👋 Я AI-ассистент ТехнологИИ Права 2026. Могу подсказать по программе, спикерам, расписанию — спрашивай!', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ];
  const [messages, setMessages] = useState<ChatMessage[]>(defaultGreeting);
  const [aiHistoryLoaded, setAiHistoryLoaded] = useState(false);

  // Load AI chat history from server
  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl('/ai/history'), { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            const serverMsgs: ChatMessage[] = data.map((m: any) => ({
              role: m.role === 'user' ? 'user' as const : 'bot' as const,
              text: m.text,
              time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            setMessages(serverMsgs);
          }
        }
      } catch { /* offline — keep default greeting */ }
      setAiHistoryLoaded(true);
    })();
  }, []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // DM state
  const [dmContacts, setDmContacts] = useState<Array<{ id: string; name: string; role: string; avatar: string; online: boolean; lastMsg: string }>>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<Record<string, ChatMessage[]>>({});
  // Presence + typing («как в Telegram»). presence: online/last-seen по userId
  // (снапшот из /users/list + live через WS). typingPeers: до какого времени (ms)
  // показывать «печатает» для пира. forceTick: 1с-таймер для авто-скрытия
  // «печатает» и пересчёта «был(а) в сети N назад».
  const [presence, setPresence] = useState<Record<string, { online: boolean; lastSeenAt: string | null }>>({});
  const [typingPeers, setTypingPeers] = useState<Record<string, number>>({});
  const [, forceTick] = useState(0);
  const lastTypingSentRef = useRef(0);

  useDmSocket((ev: DmSocketEvent) => {
    if (ev.type === 'presence') {
      setPresence(prev => ({ ...prev, [ev.userId]: { online: ev.online, lastSeenAt: ev.lastSeenAt } }));
    } else if (ev.type === 'typing') {
      setTypingPeers(prev => ({ ...prev, [ev.from]: Date.now() + 5000 }));
    } else if (ev.type === 'dm:new') {
      const m = ev.message;
      if (!myId || m.fromUserId === myId) return; // своё эхо — уже добавлено оптимистично
      const peer = m.fromUserId;
      const cm: ChatMessage = {
        id: m.id,
        role: 'other',
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...(m.mediaUrl ? { media: { type: m.mediaType || 'image', url: m.mediaUrl.startsWith('/uploads/') ? resolveAssetUrl(m.mediaUrl) : m.mediaUrl } } : {}),
      };
      setDmMessages(prev => {
        const arr = prev[peer] || [];
        if (arr.some(x => x.id === m.id)) return prev; // дедуп по id
        return { ...prev, [peer]: [...arr, cm] };
      });
      setTypingPeers(prev => { const n = { ...prev }; delete n[peer]; return n; }); // прислал → уже не печатает
    }
  });

  useEffect(() => {
    const t = setInterval(() => forceTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const [dmInput, setDmInput] = useState('');
  // Режим записи для круглой кнопки композера: голос ↔ видео (переключается
  // тумблером в пилюле, как в Telegram).
  const [recordMode, setRecordMode] = useState<'audio' | 'video'>('audio');
  const [loadingDm, setLoadingDm] = useState(true);

  // Context menu & message actions
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, msgIndex: -1, msgTab: 'assistant', isOwn: false, hasMedia: false, hasText: false });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [forwardingMsg, setForwardingMsg] = useState<ChatMessage | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio recording animation bars
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(24).fill(0.15));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // Media recording
  const [isRecording, setIsRecording] = useState<'audio' | 'video' | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaPreview, setMediaPreview] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); };
  useEffect(scrollToBottom, [messages, loading, dmMessages, selectedContact, activeTab]);

  // AI messages are persisted server-side in /ai/chat endpoint
  // DM messages are persisted server-side in /messages endpoint

  // Load DM contacts and preload their avatars
  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl('/users/list'), { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          const contacts = data.map((u: any) => ({
            id: u.id, name: u.name, role: u.role || 'Участник',
            avatar: u.avatar || '', online: !!u.online, lastMsg: ''
          }));
          // Начальный снапшот presence из списка (дальше — live через WS).
          setPresence(() => {
            const init: Record<string, { online: boolean; lastSeenAt: string | null }> = {};
            for (const u of data) init[u.id] = { online: !!u.online, lastSeenAt: u.lastSeenAt ?? null };
            return init;
          });
          // Preload all contact avatars into browser cache before rendering
          const avatarUrls = contacts
            .map((c: any) => c.avatar ? (c.avatar.startsWith('/uploads/') ? resolveAssetUrl(c.avatar) : c.avatar) : '')
            .filter(Boolean);
          await Promise.all(avatarUrls.map((url: string) => preloadImage(url)));
          setDmContacts(contacts);
        }
      } catch { /* offline */ }
      setLoadingDm(false);
    })();
  }, []);

  useEffect(() => {
    if (dmTarget && dmContacts.length > 0 && !selectedContact) {
      const exists = dmContacts.some(c => c.id === dmTarget);
      if (exists) selectContactWithHistory(dmTarget);
    }
  }, [dmTarget, dmContacts]);

  // Handle hardware/swipe back: close DM conversation instead of leaving /chat
  const selectContactWithHistory = useCallback((id: string | null) => {
    if (id && !selectedContact) {
      // Opening a DM conversation — push a history entry
      window.history.pushState({ dmContact: id }, '');
    } else if (!id && selectedContact) {
      // Closing via UI button — pop the history entry
      if (window.history.state?.dmContact) {
        window.history.back();
        return; // popstate handler will set selectedContact=null
      }
    }
    setSelectedContact(id);
  }, [selectedContact]);

  useEffect(() => {
    const onPopState = () => {
      if (selectedContact) {
        setSelectedContact(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectedContact]);

  // Load DM history when contact selected
  useEffect(() => {
    if (!selectedContact || !myId) return;
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl(`/messages/with/${selectedContact}`), { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          const msgs: ChatMessage[] = (Array.isArray(data) ? data : []).map((m: any) => ({
            id: m.id,
            role: m.fromUserId === myId ? 'user' as const : 'other' as const,
            text: m.text,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            edited: !!m.editedAt,
            ...(m.mediaUrl ? { media: { type: m.mediaType || 'image', url: m.mediaUrl.startsWith('/uploads/') ? resolveAssetUrl(m.mediaUrl) : m.mediaUrl } } : {}),
          }));
          setDmMessages(prev => ({ ...prev, [selectedContact]: msgs }));
        }
      } catch { /* use empty */ }
    })();
  }, [selectedContact, myId]);

  // AI send
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text, time }]);
    setLoading(true);
    try {
      const r = await authFetch(resolveApiUrl('/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok) throw new Error('ai_error');
      const data = await r.json();
      setMessages(prev => [...prev, {
        role: 'bot', text: data.text || 'Не удалось получить ответ.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Ошибка соединения. Попробуй ещё раз.', time }]);
    } finally { setLoading(false); }
  };

  // DM send
  const handleDmSend = async () => {
    if (!dmInput.trim() || !selectedContact) return;
    const text = dmInput.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setDmInput('');
    setDmMessages(prev => ({
      ...prev,
      [selectedContact]: [...(prev[selectedContact] || []), { role: 'user', text, time }]
    }));
    try {
      const res = await authFetch(resolveApiUrl('/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ toUserId: selectedContact, text }),
      });
      if (!res.ok) throw new Error('send failed');
      const saved = await res.json().catch(() => null);
      // Update msg with server ID for edit/delete
      if (saved?.id) {
        setDmMessages(prev => {
          const arr = [...(prev[selectedContact] || [])];
          const last = arr[arr.length - 1];
          if (last && last.text === text) arr[arr.length - 1] = { ...last, id: saved.id };
          return { ...prev, [selectedContact]: arr };
        });
      }
    } catch { toast.show('Не удалось отправить сообщение'); }
  };

  // Keep file reference for upload
  const pendingFileRef = useRef<File | null>(null);
  const sendingMediaRef = useRef(false);

  // Media handlers
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    setMediaPreview({ type: file.type.startsWith('video') ? 'video' : 'image', url: URL.createObjectURL(file) });
    // Reset input so re-selecting same file triggers onChange again
    e.target.value = '';
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true, video: type === 'video' ? { facingMode: 'user', width: 480, height: 480 } : false
      });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: type === 'video' ? 'video/webm' : 'audio/webm' });
        const localUrl = URL.createObjectURL(blob);
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const mediaType = type === 'video' ? 'video-bubble' : 'audio';

        // Upload media to server for persistence
        let serverMediaUrl: string | null = null;
        if (activeTab === 'dm' && selectedContact) {
          try {
            const fd = new FormData();
            fd.append('file', blob, type === 'video' ? 'video.webm' : 'voice.webm');
            const uploadRes = await authFetch(resolveApiUrl('/messages/upload-media'), {
              method: 'POST', credentials: 'include', body: fd,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              serverMediaUrl = uploadData.url || uploadData.mediaUrl || null;
            }
          } catch { /* fallback to local URL */ }
        }

        const url = serverMediaUrl || localUrl;
        const msg: ChatMessage = { role: 'user', time, media: { type: mediaType, url } };

        if (activeTab === 'dm' && selectedContact) {
          // Send DM with media
          setDmMessages(prev => ({ ...prev, [selectedContact]: [...(prev[selectedContact] || []), msg] }));
          if (serverMediaUrl) {
            try {
              const sendRes = await authFetch(resolveApiUrl('/messages'), {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  toUserId: selectedContact,
                  text: '',
                  mediaUrl: serverMediaUrl,
                  mediaType: type === 'video' ? 'video-bubble' : 'audio',
                }),
              });
              if (sendRes.ok) {
                const saved = await sendRes.json().catch(() => null);
                if (saved?.id) {
                  setDmMessages(prev => {
                    const arr = [...(prev[selectedContact] || [])];
                    const last = arr[arr.length - 1];
                    if (last?.media) arr[arr.length - 1] = { ...last, id: saved.id };
                    return { ...prev, [selectedContact]: arr };
                  });
                }
              }
            } catch { toast.show('Не удалось отправить медиа'); }
          }
        } else {
          setMessages(prev => [...prev, msg]);
          if ((type === 'audio' || type === 'video') && activeTab === 'assistant') {
            setLoading(true);
            try {
              const formData = new FormData();
              formData.append('audio', blob, 'voice.webm');
              const tr = await authFetch(resolveApiUrl('/ai/transcribe'), {
                method: 'POST', credentials: 'include', body: formData,
              });
              if (tr.ok) {
                const { text: transcript } = await tr.json();
                if (transcript) {
                  const prefix = type === 'video' ? '[Видео-сообщение]' : '[Голосовое сообщение]';
                  const aiRes = await authFetch(resolveApiUrl('/ai/chat'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ message: `${prefix} ${transcript}` }),
                  });
                  if (aiRes.ok) {
                    const data = await aiRes.json();
                    setMessages(prev => [...prev, {
                      role: 'bot', text: data.text || 'Не удалось получить ответ.',
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                  }
                }
              } else {
                setMessages(prev => [...prev, {
                  role: 'bot', text: '🎤 Получил голосовое! К сожалению, транскрипция временно недоступна. Попробуй написать текстом.',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
              }
            } catch {
              setMessages(prev => [...prev, {
                role: 'bot', text: 'Ошибка обработки аудио. Попробуй ещё раз.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }]);
            } finally { setLoading(false); }
          }
        }
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      setIsRecording(type);
      setRecordingTime(0);
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => { if (prev + 1 >= MAX_RECORDING_SEC) stopRecording(); return prev + 1; });
      }, 1000);
      if (type === 'video') setTimeout(() => { if (livePreviewRef.current && streamRef.current) livePreviewRef.current.srcObject = streamRef.current; }, 50);

      // Set up audio analyser for live waveform
      if (type === 'audio') {
        try {
          const actx = new AudioContext();
          audioCtxRef.current = actx;
          const src = actx.createMediaStreamSource(stream);
          const analyser = actx.createAnalyser();
          analyser.fftSize = 64;
          src.connect(analyser);
          analyserRef.current = analyser;
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const tick = () => {
            analyser.getByteFrequencyData(dataArr);
            const bars: number[] = [];
            const step = Math.floor(dataArr.length / 24);
            for (let j = 0; j < 24; j++) {
              const v = dataArr[j * step] / 255;
              bars.push(Math.max(0.08, v));
            }
            setAudioLevels(bars);
            animFrameRef.current = requestAnimationFrame(tick);
          };
          tick();
        } catch { /* no analyser — static bars */ }
      }
    } catch { toast.show('Нет доступа к камере/микрофону'); }
  };

  const cleanupAudioAnalyser = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    setAudioLevels(Array(24).fill(0.15));
  };

  const stopRecording = () => {
    if (recordingInterval.current) { clearInterval(recordingInterval.current); recordingInterval.current = null; }
    cleanupAudioAnalyser();
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    setIsRecording(null);
  };

  const cancelRecording = () => {
    if (recordingInterval.current) { clearInterval(recordingInterval.current); recordingInterval.current = null; }
    cleanupAudioAnalyser();
    if (mediaRecorderRef.current) { mediaRecorderRef.current.onstop = null; if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(null);
    setRecordingTime(0);
  };

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const contact = useMemo(() => dmContacts.find(c => c.id === selectedContact), [dmContacts, selectedContact]);

  // ── Presence / typing helpers («как в Telegram») ──
  function relLastSeen(iso: string | null): string {
    if (!iso) return '';
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} ч назад`;
    return `${Math.floor(hr / 24)} дн назад`;
  }
  function peerStatus(peerId: string | null | undefined): { text: string; tone: 'typing' | 'online' | 'offline' } {
    if (!peerId) return { text: '', tone: 'offline' };
    if ((typingPeers[peerId] || 0) > Date.now()) return { text: 'печатает…', tone: 'typing' };
    const p = presence[peerId];
    if (p?.online) return { text: 'в сети', tone: 'online' };
    const seen = p?.lastSeenAt ?? null;
    return { text: seen ? `был(а) в сети ${relLastSeen(seen)}` : 'не в сети', tone: 'offline' };
  }
  function isPeerOnline(peerId: string): boolean {
    return presence[peerId]?.online ?? false;
  }
  function sendTyping(to: string): void {
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendDm({ type: 'typing', to });
    }
  }

  /* ── Long-press handlers for context menu ── */
  const handleMsgPointerDown = useCallback((e: React.PointerEvent, idx: number, tab: 'assistant' | 'dm', isOwn: boolean, hasMedia: boolean, hasText: boolean) => {
    const { clientX, clientY } = e;
    longPressTimer.current = setTimeout(() => {
      setCtxMenu({ visible: true, x: clientX, y: clientY, msgIndex: idx, msgTab: tab, isOwn, hasMedia, hasText });
    }, 500);
  }, []);
  const handleMsgPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }, []);

  /* ── Message actions ── */
  const handleCopyMsg = useCallback(() => {
    const msgs = ctxMenu.msgTab === 'assistant' ? messages : (dmMessages[selectedContact || ''] || []);
    const msg = msgs[ctxMenu.msgIndex];
    if (msg?.text) {
      navigator.clipboard.writeText(msg.text).catch(() => {});
      toast.show('Скопировано');
    }
  }, [ctxMenu, messages, dmMessages, selectedContact, toast]);

  const handleEditMsg = useCallback(() => {
    const msgs = ctxMenu.msgTab === 'assistant' ? messages : (dmMessages[selectedContact || ''] || []);
    const msg = msgs[ctxMenu.msgIndex];
    if (msg?.text) {
      setEditingIndex(ctxMenu.msgIndex);
      setEditText(msg.text);
    }
  }, [ctxMenu, messages, dmMessages, selectedContact]);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null) return;
    const newText = editText.trim();
    if (!newText) return;
    if (ctxMenu.msgTab === 'assistant') {
      setMessages(prev => prev.map((m, i) => i === editingIndex ? { ...m, text: newText, edited: true } : m));
    } else if (selectedContact) {
      setDmMessages(prev => {
        const arr = [...(prev[selectedContact] || [])];
        if (arr[editingIndex]) arr[editingIndex] = { ...arr[editingIndex], text: newText, edited: true };
        return { ...prev, [selectedContact]: arr };
      });
      // Persist edit on server
      const msg = (dmMessages[selectedContact] || [])[editingIndex];
      if (msg?.id) {
        authFetch(resolveApiUrl(`/messages/${msg.id}`), {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: newText }),
        }).catch(() => {});
      }
    }
    setEditingIndex(null);
    setEditText('');
  }, [editingIndex, editText, ctxMenu.msgTab, selectedContact, dmMessages]);

  const handleDeleteMsg = useCallback(() => {
    if (ctxMenu.msgTab === 'assistant') {
      setMessages(prev => prev.filter((_, i) => i !== ctxMenu.msgIndex));
    } else if (selectedContact) {
      const msg = (dmMessages[selectedContact] || [])[ctxMenu.msgIndex];
      setDmMessages(prev => {
        const arr = (prev[selectedContact] || []).filter((_, i) => i !== ctxMenu.msgIndex);
        return { ...prev, [selectedContact]: arr };
      });
      if (msg?.id) {
        authFetch(resolveApiUrl(`/messages/${msg.id}`), {
          method: 'DELETE', credentials: 'include',
        }).catch(() => {});
      }
    }
  }, [ctxMenu, selectedContact, dmMessages]);

  const handleForwardMsg = useCallback(() => {
    const msgs = ctxMenu.msgTab === 'assistant' ? messages : (dmMessages[selectedContact || ''] || []);
    const msg = msgs[ctxMenu.msgIndex];
    if (msg) setForwardingMsg(msg);
  }, [ctxMenu, messages, dmMessages, selectedContact]);

  const doForward = useCallback(async (targetContactId: string) => {
    if (!forwardingMsg) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fwdText = forwardingMsg.text ? `[Переслано] ${forwardingMsg.text}` : '[Переслано]';
    const fwdMsg: ChatMessage = {
      role: 'user' as const,
      text: fwdText,
      time,
      ...(forwardingMsg.media ? { media: forwardingMsg.media } : {}),
    };
    setDmMessages(prev => ({
      ...prev,
      [targetContactId]: [...(prev[targetContactId] || []), fwdMsg],
    }));
    try {
      await authFetch(resolveApiUrl('/messages'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: targetContactId,
          text: fwdText,
          ...(forwardingMsg.media ? { mediaUrl: forwardingMsg.media.url, mediaType: forwardingMsg.media.type } : {}),
        }),
      });
    } catch { toast.show('Не удалось переслать'); }
    setForwardingMsg(null);
    toast.show('Переслано');
  }, [forwardingMsg, toast]);

  const handleDownloadMedia = useCallback(async () => {
    const msgs = ctxMenu.msgTab === 'assistant' ? messages : (dmMessages[selectedContact || ''] || []);
    const msg = msgs[ctxMenu.msgIndex];
    if (!msg?.media?.url) return;
    try {
      const response = await fetch(msg.media.url);
      const blob = await response.blob();
      const ext = msg.media.type === 'image' ? 'jpg' : msg.media.type === 'audio' ? 'webm' : 'mp4';
      const filename = `techforum_${msg.media.type}_${Date.now()}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.show('Скачивание начато');
    } catch {
      toast.show('Не удалось скачать');
    }
  }, [ctxMenu, messages, dmMessages, selectedContact, toast]);

  // Quick prompts for AI
  const quickPrompts = [
    { text: 'Что сейчас идёт?', icon: '🕐' },
    { text: 'Посоветуй про AI', icon: '🤖' },
    { text: 'Где кофе-брейк?', icon: '☕' },
    { text: 'Топ спикеры', icon: '🎤' },
  ];

  const reportContact = async () => {
    if (!selectedContact) return;
    const reason = window.prompt('Кратко опишите нарушение. Жалоба будет передана организатору.');
    if (!reason?.trim()) return;
    try {
      const r = await authFetch(resolveApiUrl('/moderation/report'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportedUserId: selectedContact, reason: reason.trim() }) });
      if (!r.ok) throw new Error(String(r.status));
      toast.show('Жалоба отправлена организатору');
    } catch { toast.show('Не удалось отправить жалобу'); }
  };

  const blockContact = async () => {
    if (!selectedContact || !window.confirm('Заблокировать этого пользователя? Он не сможет писать вам.')) return;
    try {
      const r = await authFetch(resolveApiUrl(`/moderation/blocks/${selectedContact}`), { method: 'PUT', credentials: 'include' });
      if (!r.ok) throw new Error(String(r.status));
      toast.show('Пользователь заблокирован'); selectContactWithHistory(null);
    } catch { toast.show('Не удалось заблокировать пользователя'); }
  };

  return (
    <div className="flex flex-col relative" style={{ minHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))', height: 'calc(100dvh - env(safe-area-inset-top, 0px))', overflow: 'hidden' }}>
      {/* Header */}
      <header className="shrink-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 4px)' }}>
        {activeTab === 'dm' && selectedContact ? (
          /* DM chat header — zero wasted space */
          <div className="flex items-center gap-3 px-4 py-2">
            <button onClick={() => selectContactWithHistory(null)} className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-card text-foreground/85 active:scale-90 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => selectedContact && navigate(`/users/${selectedContact}`)}
              className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden border-2 border-primary/30 active:scale-95 transition-transform"
            >
              {(() => {
                const cAv = contact?.avatar ? (contact.avatar.startsWith('/uploads/') ? resolveAssetUrl(contact.avatar) : contact.avatar) : null;
                return cAv
                  ? <img src={cAv} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <span className="text-[16px] font-bold text-foreground/60">{contact?.name?.charAt(0) || '?'}</span>;
              })()}
            </button>
            <button
              onClick={() => selectedContact && navigate(`/users/${selectedContact}`)}
              className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
            >
              <span className="font-display text-[17px] font-bold text-foreground block truncate leading-tight">{contact?.name || 'Чат'}</span>
              {(() => {
                const st = peerStatus(selectedContact);
                const color = st.tone === 'typing' ? 'text-primary' : st.tone === 'online' ? 'text-emerald-400' : 'text-foreground/40';
                return <span className={`text-[11px] leading-none transition-colors ${color}`}>{st.text || contact?.role || 'Участник'}</span>;
              })()}
            </button>
            <button type="button" onClick={() => void reportContact()} aria-label="Пожаловаться" className="h-9 w-9 shrink-0 rounded-xl border border-border bg-card flex items-center justify-center text-amber-300"><ShieldAlert className="h-4 w-4" /></button>
            <button type="button" onClick={() => void blockContact()} aria-label="Заблокировать" className="h-9 w-9 shrink-0 rounded-xl border border-border bg-card flex items-center justify-center text-rose-300"><Ban className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="px-5 pb-2.5 space-y-2.5 pt-0.5">
            <div className="flex items-center gap-3">
              <BackButton to="/" />
              <h1
                className="font-display text-[24px] leading-none font-bold"
                style={{
                  background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {activeTab === 'assistant' ? 'AI Ассистент' : 'Сообщения'}
              </h1>
            </div>

            {/* Tabs */}
            <div className="flex bg-muted/50 p-1 rounded-xl gap-1">
              <button onClick={() => setActiveTab('assistant')}
                className={cn('flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'assistant' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground')}>
                <Sparkles className="w-3.5 h-3.5" /> Ассистент
              </button>
              <button onClick={() => { setActiveTab('dm'); setSelectedContact(null); }}
                className={cn('flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5',
                  activeTab === 'dm' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground')}>
                <MessageCircle className="w-3.5 h-3.5" /> Личные
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Content — slightly lighter background for messages area with smooth gradient */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide min-h-0"
        style={{ background: 'transparent' }}>
        <div className="p-5 pb-4">
          {activeTab === 'assistant' ? (
            <div className="flex flex-col gap-1.5">
              {!aiHistoryLoaded ? (
                /* Skeleton while AI history loads — prevents flash */
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={cn('flex gap-2', i % 2 === 1 ? 'flex-row-reverse' : 'flex-row')}>
                      <div className="w-7 h-7 rounded-full bg-muted animate-pulse shrink-0" />
                      <div className={cn('rounded-2xl animate-pulse bg-muted/60', i % 2 === 1 ? 'rounded-tr-sm' : 'rounded-tl-sm')} style={{ width: `${50 + i * 15}%`, height: 40 }} />
                    </div>
                  ))}
                </>
              ) : (<>
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const isEditing = editingIndex === i && ctxMenu.msgTab === 'assistant';
                return (
                  <motion.div
                    key={`${msg.role}-${msg.time}-${i}`}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
                    onPointerDown={e => (msg.text || msg.media) ? handleMsgPointerDown(e, i, 'assistant', isUser, !!msg.media, !!msg.text) : undefined}
                    onPointerUp={handleMsgPointerUp}
                    onPointerCancel={handleMsgPointerUp}
                    onContextMenu={e => { e.preventDefault(); if (msg.text || msg.media) setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, msgIndex: i, msgTab: 'assistant', isOwn: isUser, hasMedia: !!msg.media, hasText: !!msg.text }); }}
                  >
                    <div className={cn('w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0',
                      isUser ? 'bg-primary/20' : 'bg-accent/15')}>
                      {isUser ? (
                        myAvatar ? <img src={myAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-3.5 h-3.5 text-primary" />
                      ) : <Bot className="w-3.5 h-3.5 text-accent" />}
                    </div>
                    <div className={cn('max-w-[78%]', isUser ? 'items-end' : 'items-start')}>
                      <div className={(msg.media?.type === 'video-bubble' && !msg.text && !isEditing)
                        ? 'bg-transparent'
                        : cn('px-3 py-2 text-[13px] leading-snug',
                        isUser
                          ? 'bg-primary/15 border border-primary/20 rounded-2xl rounded-tr-sm text-foreground'
                          : 'bg-card border border-border rounded-2xl rounded-tl-sm text-foreground/90')}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full bg-transparent border border-primary/30 rounded-lg px-2 py-1.5 text-[13px] text-foreground resize-none focus:outline-none" rows={2} autoFocus />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setEditingIndex(null); setEditText(''); }} className="text-[11px] text-muted-foreground px-2 py-1">Отмена</button>
                              <button onClick={handleSaveEdit} className="text-[11px] text-primary font-semibold px-2 py-1 flex items-center gap-1"><Check className="w-3 h-3" />Сохранить</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                            {msg.media && <MediaMessage media={msg.media} role={msg.role} />}
                          </>
                        )}
                      </div>
                      <span className={cn('text-[9px] text-muted-foreground px-1.5 mt-0.5 block', isUser ? 'text-right' : '')}>
                        {msg.time}{msg.edited ? ' (ред.)' : ''}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                  <div className="bg-card border border-border px-4 py-3.5 rounded-2xl rounded-tl-md flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              {/* Quick prompts — only show at start */}
              {messages.length <= 1 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="space-y-3 mt-4"
                >
                  <p className="text-[11px] text-foreground/30 font-semibold uppercase tracking-wider px-1">Быстрые вопросы</p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickPrompts.map(q => (
                      <button key={q.text} onClick={() => { setInput(q.text); }}
                        className="flex items-center gap-2.5 px-3.5 py-3 bg-card border border-border rounded-xl text-left hover:border-primary/30 transition-all active:scale-[0.97]">
                        <span className="text-base">{q.icon}</span>
                        <span className="text-[12px] font-medium text-foreground/70 leading-tight">{q.text}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
              </>)}
            </div>
          ) : activeTab === 'dm' && !selectedContact ? (
            <div className="space-y-2">
              {loadingDm ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 bg-card border border-border p-4 rounded-xl animate-pulse">
                    <div className="w-11 h-11 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2"><div className="h-3 bg-muted rounded w-1/3" /><div className="h-2 bg-muted rounded w-2/3" /></div>
                  </div>
                ))
              ) : dmContacts.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center space-y-3">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-foreground/60 text-sm">Пока нет контактов</p>
                  <p className="text-muted-foreground text-xs">Найди участников в разделе «Участники»</p>
                </div>
              ) : (
                dmContacts.map(c => {
                  const cAvatar = c.avatar ? (c.avatar.startsWith('/uploads/') ? resolveAssetUrl(c.avatar) : c.avatar) : null;
                  return (
                  <button key={c.id} onClick={() => selectContactWithHistory(c.id)}
                    className="w-full flex items-center gap-3 bg-card border border-border p-3.5 rounded-xl hover:border-primary/30 active:scale-[0.98] transition-all">
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-foreground font-display font-bold text-sm overflow-hidden">
                        {cAvatar ? <img src={cAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : c.name.charAt(0)}
                      </div>
                      {isPeerOnline(c.id) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.role}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </button>
                  );
                })
              )}
            </div>
          ) : activeTab === 'dm' && selectedContact ? (
            <div className="flex flex-col gap-1.5">
              {(dmMessages[selectedContact] || []).length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-xs">Начните диалог</div>
              )}
              {(dmMessages[selectedContact] || []).map((msg, i) => {
                const isUser = msg.role === 'user';
                const isEditing = editingIndex === i && ctxMenu.msgTab === 'dm';
                const contactAvatar = contact?.avatar ? (contact.avatar.startsWith('/uploads/') ? resolveAssetUrl(contact.avatar) : contact.avatar) : null;
                return (
                  <motion.div
                    key={`dm-${msg.role}-${msg.time}-${i}`}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                    className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
                    onPointerDown={e => (msg.text || msg.media) ? handleMsgPointerDown(e, i, 'dm', isUser, !!msg.media, !!msg.text) : undefined}
                    onPointerUp={handleMsgPointerUp}
                    onPointerCancel={handleMsgPointerUp}
                    onContextMenu={e => { e.preventDefault(); if (msg.text || msg.media) setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, msgIndex: i, msgTab: 'dm', isOwn: isUser, hasMedia: !!msg.media, hasText: !!msg.text }); }}
                  >
                    <div className={cn('w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0',
                      isUser ? 'bg-primary/20' : 'bg-muted')}>
                      {isUser ? (
                        myAvatar ? <img src={myAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        contactAvatar ? <img src={contactAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <span className="text-[10px] font-bold text-foreground/60">{contact?.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="max-w-[78%]">
                      <div className={(msg.media?.type === 'video-bubble' && !msg.text && !isEditing)
                        ? 'bg-transparent'
                        : cn('px-3 py-2 text-[13px] leading-snug',
                        isUser
                          ? 'bg-primary/15 border border-primary/20 rounded-2xl rounded-tr-sm text-foreground'
                          : 'bg-card border border-border rounded-2xl rounded-tl-sm text-foreground/90')}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full bg-transparent border border-primary/30 rounded-lg px-2 py-1.5 text-[13px] text-foreground resize-none focus:outline-none" rows={2} autoFocus />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setEditingIndex(null); setEditText(''); }} className="text-[11px] text-muted-foreground px-2 py-1">Отмена</button>
                              <button onClick={handleSaveEdit} className="text-[11px] text-primary font-semibold px-2 py-1 flex items-center gap-1"><Check className="w-3 h-3" />Сохранить</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                            {msg.media && <MediaMessage media={msg.media} role={msg.role} />}
                          </>
                        )}
                      </div>
                      <span className={cn('text-[9px] text-muted-foreground px-1.5 mt-0.5 block', isUser ? 'text-right' : '')}>
                        {msg.time}{msg.edited ? ' (ред.)' : ''}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={endRef} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Video recording overlay — 2x bigger circle, positioned lower */}
      <AnimatePresence>
        {isRecording === 'video' && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/80 backdrop-blur-sm"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)' }}>
            <div className="flex flex-col items-center gap-5">
              <div className="relative rounded-full overflow-hidden border-4 border-primary shadow-neon-magenta bg-black"
                style={{ width: 'min(340px, calc(100vw - 32px))', aspectRatio: '1 / 1', boxShadow: '0 0 40px rgba(255,51,153,0.4), 0 0 80px rgba(255,51,153,0.15)' }}>
                <video ref={livePreviewRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500/90 px-2.5 py-1 rounded-full">
                  <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase">REC</span>
                </div>
              </div>
              <div className="text-white font-mono text-2xl font-bold">{fmtTimer(recordingTime)}</div>
              <div className="flex gap-4">
                <button onClick={cancelRecording} className="w-14 h-14 bg-foreground/10 border border-foreground/20 rounded-full flex items-center justify-center text-white"><X className="w-6 h-6" /></button>
                <button onClick={stopRecording} className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white shadow-neon-magenta"><Square className="w-7 h-7 fill-current" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Forward picker modal */}
      <AnimatePresence>
        {forwardingMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              className="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-5 space-y-3 max-h-[60vh] overflow-y-auto"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-foreground">Переслать в:</h3>
                <button onClick={() => setForwardingMsg(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
              {dmContacts.map(c => (
                <button key={c.id} onClick={() => doForward(c.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border hover:border-primary/30 active:scale-[0.98] transition-all">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-sm shrink-0 overflow-hidden">
                    {(() => { const a = c.avatar ? (c.avatar.startsWith('/uploads/') ? resolveAssetUrl(c.avatar) : c.avatar) : null; return a ? <img src={a} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : c.name.charAt(0); })()}
                  </div>
                  <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu */}
      <AnimatePresence>
        <MessageContextMenu
          state={ctxMenu}
          onClose={() => setCtxMenu(prev => ({ ...prev, visible: false }))}
          onCopy={handleCopyMsg}
          onEdit={handleEditMsg}
          onDelete={handleDeleteMsg}
          onForward={handleForwardMsg}
          onDownload={handleDownloadMedia}
        />
      </AnimatePresence>

      {/* Input bar */}
      {!(activeTab === 'dm' && !selectedContact) && (
        <div className="shrink-0 px-4 pt-2 bg-background/90 backdrop-blur-xl border-t border-border z-30"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
          <AnimatePresence>
            {mediaPreview && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                className="mb-3 relative rounded-xl overflow-hidden border-2 border-primary/40 bg-card p-2">
                <button onClick={() => setMediaPreview(null)} className="absolute top-3 right-3 z-10 p-1.5 bg-black/60 rounded-full text-white"><X className="w-4 h-4" /></button>
                {mediaPreview.type === 'image'
                  ? <img src={mediaPreview.url} className="w-full h-48 object-cover rounded-lg" />
                  : <video src={mediaPreview.url} className="w-full h-48 object-cover rounded-lg" />}
                <button onClick={async () => {
                  // Prevent double-send
                  if (sendingMediaRef.current) return;
                  sendingMediaRef.current = true;
                  try {
                    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    let finalUrl = mediaPreview.url;
                    const mType = mediaPreview.type;

                    // Upload file to server for persistence
                    if (activeTab === 'dm' && selectedContact && pendingFileRef.current) {
                      try {
                        const fd = new FormData();
                        fd.append('file', pendingFileRef.current);
                        const uploadRes = await authFetch(resolveApiUrl('/messages/upload-media'), {
                          method: 'POST', credentials: 'include', body: fd,
                        });
                        if (uploadRes.ok) {
                          const uploadData = await uploadRes.json();
                          finalUrl = uploadData.url || uploadData.mediaUrl || finalUrl;
                        }
                      } catch { /* fallback to blob */ }
                    }

                    const msg: ChatMessage = { role: 'user', time, media: { type: mType, url: finalUrl } };
                    if (activeTab === 'dm' && selectedContact) {
                      setDmMessages(prev => ({ ...prev, [selectedContact]: [...(prev[selectedContact] || []), msg] }));
                      // Send message with media to server
                      if (finalUrl && !finalUrl.startsWith('blob:')) {
                        try {
                          const sendRes = await authFetch(resolveApiUrl('/messages'), {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ toUserId: selectedContact, text: '', mediaUrl: finalUrl, mediaType: mType }),
                          });
                          if (sendRes.ok) {
                            const saved = await sendRes.json().catch(() => null);
                            if (saved?.id) {
                              setDmMessages(prev => {
                                const arr = [...(prev[selectedContact] || [])];
                                const last = arr[arr.length - 1];
                                if (last?.media) arr[arr.length - 1] = { ...last, id: saved.id };
                                return { ...prev, [selectedContact]: arr };
                              });
                            }
                          }
                        } catch { toast.show('Не удалось отправить'); }
                      }
                    } else {
                      setMessages(prev => [...prev, msg]);
                    }
                    pendingFileRef.current = null;
                    setMediaPreview(null);
                  } finally {
                    sendingMediaRef.current = false;
                  }
                }} className="mt-2 w-full py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg">
                  Отправить
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {isRecording === 'audio' ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-card border border-primary/30 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-mono font-bold text-foreground">{fmtTimer(recordingTime)}</span>
              </div>
              {/* Live waveform bars */}
              <div className="flex-1 flex items-center justify-center gap-[2px] h-10 overflow-hidden">
                {audioLevels.map((level, idx) => (
                  <div
                    key={idx}
                    className="rounded-full"
                    style={{
                      width: '3px',
                      height: `${Math.max(4, level * 40)}px`,
                      backgroundColor: `rgba(255, 51, 153, ${0.4 + level * 0.6})`,
                      transition: 'height 80ms ease-out',
                    }}
                  />
                ))}
              </div>
              <button onClick={cancelRecording} className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center text-muted-foreground shrink-0"><X className="w-4 h-4" /></button>
              <button onClick={stopRecording} className="w-11 h-11 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"><Square className="w-5 h-5 fill-current" /></button>
            </motion.div>
          ) : (
            <div className="flex items-end gap-2">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
              {/* Пилюля в стиле Telegram: скрепка + текст + тумблер голос/видео. Стикеров нет. */}
              <div className="flex-1 flex items-end gap-0.5 rounded-[22px] border border-border bg-card pl-1.5 pr-1 py-1">
                <button onClick={() => fileInputRef.current?.click()} aria-label="Прикрепить"
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors active:scale-90 shrink-0 self-end">
                  <Paperclip className="w-[21px] h-[21px]" />
                </button>
                <textarea
                  value={activeTab === 'assistant' ? input : dmInput}
                  onChange={e => {
                    if (activeTab === 'assistant') { setInput(e.target.value); }
                    else { setDmInput(e.target.value); if (selectedContact) sendTyping(selectedContact); }
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); activeTab === 'assistant' ? handleSend() : handleDmSend(); } }}
                  placeholder={activeTab === 'assistant' ? 'Спрашивай…' : 'Сообщение'}
                  rows={1}
                  className="flex-1 bg-transparent border-0 px-1 py-2 text-[15px] leading-snug focus:outline-none text-foreground placeholder:text-muted-foreground resize-none min-h-[38px] max-h-32"
                />
                {activeTab === 'dm' && !dmInput.trim() && (
                  <button onClick={() => setRecordMode(m => (m === 'audio' ? 'video' : 'audio'))}
                    aria-label={recordMode === 'audio' ? 'Переключить на видео' : 'Переключить на голос'}
                    className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors active:scale-90 shrink-0 self-end">
                    {recordMode === 'audio' ? <Camera className="w-[21px] h-[21px]" /> : <Mic className="w-[21px] h-[21px]" />}
                  </button>
                )}
              </div>
              {/* Круглая кнопка: отправка (если есть текст) или запись в текущем режиме */}
              {(activeTab === 'assistant' ? input : dmInput).trim() ? (
                <button onClick={activeTab === 'assistant' ? handleSend : handleDmSend}
                  disabled={activeTab === 'assistant' ? loading : false}
                  aria-label="Отправить"
                  className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-30 transition-all active:scale-95 shadow-neon-magenta shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => startRecording(activeTab === 'assistant' ? 'audio' : recordMode)}
                  aria-label={(activeTab === 'assistant' || recordMode === 'audio') ? 'Записать голосовое' : 'Записать видео'}
                  className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center text-primary transition-all active:scale-95 hover:border-primary/40 shrink-0">
                  {(activeTab === 'assistant' || recordMode === 'audio') ? <Mic className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
