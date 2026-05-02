import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, MessageCircle, Share2, Play, Pause, Search, Hash, Plus, 
  History, Camera, X, Music, Check, User, Send, Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';

export default function Feed() {
  const [activeType, setActiveType] = useState<'posts' | 'reels'>('reels');
  const [posts, setPosts] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);

  // Data fetching
  const refreshData = async () => {
    try {
      const query = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const postsUrl = resolveApiUrl(`/posts${query}`);
      const statusesUrl = resolveApiUrl('/statuses');
      const [postsRes, statusRes] = await Promise.all([
        fetch(postsUrl, { credentials: 'include' }),
        fetch(statusesUrl, { credentials: 'include' })
      ]);
      const postsData = await postsRes.json();
      const statusData = await statusRes.json();
      setPosts(postsData);
      setStatuses(statusData);
    } catch (e) {
      console.error("Failed to load feed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [searchQuery]);

  // Social Interactions
  const handleLike = async (postId: string) => {
    try {
      const likeUrl = resolveApiUrl(`/posts/${postId}/like`);
      const res = await fetch(likeUrl, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: data.likes, liked: data.liked } : p));
      }
    } catch (e) { console.error(e); }
  };

  const [commentText, setCommentText] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  const handleComment = async (postId: string) => {
    if (!commentText.trim()) return;
    try {
      const commentUrl = resolveApiUrl(`/posts/${postId}/comment`);
      const res = await fetch(commentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: commentText })
      });
      if (res.ok) {
        setCommentText('');
        setActiveCommentId(null);
        refreshData();
      }
    } catch (e) { console.error(e); }
  };

  const mockReels = [
    { id: 'r1', user: { name: 'Дмитрий Волков', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry' }, url: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screens-1151-large.mp4', likes: 120, comments: 45, text: 'Кодим будущее #tech #future' },
    { id: 'r2', user: { name: 'Анна Дизайн', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anna' }, url: 'https://assets.mixkit.co/videos/preview/mixkit-woman-working-on-a-laptop-in-a-cafe-43486-large.mp4', likes: 890, comments: 12, text: 'Утро с Фигмой ✨ #design #ui' },
  ];
  const feedPosts = posts.filter(p => p.type !== 'video' && p.type !== 'status');

  // Video Recording Logic for Reels
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPreview, setRecordingPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordingPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // State
  const [showCreate, setShowCreate] = useState<'post' | 'reel' | 'status' | null>(null);
  const [newPostText, setNewPostText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleCreateContent = async () => {
    let type: string = 'text';
    if (showCreate === 'reel') type = 'video';
    else if (showCreate === 'status') type = recordingPreview ? 'image' : 'status';

    const text = newPostText + (selectedTags.length > 0 ? ' ' + selectedTags.join(' ') : '');
    const url = recordingPreview || (type === 'video' ? 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screens-1151-large.mp4' : '');
    
    try {
      const endpoint = showCreate === 'status' ? resolveApiUrl('/statuses') : resolveApiUrl('/posts');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, text, url })
      });
      if (res.ok) {
        setNewPostText('');
        setSelectedTags([]);
        setRecordingPreview(null);
        setShowCreate(null);
        refreshData();
      }
    } catch (e) { console.error(e); }
  };

  const [viewingStatus, setViewingStatus] = useState<any | null>(null);

  return (
    <div className="flex-1 flex flex-col h-full relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      {/* Feed Header */}
      <header className="p-6 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-card/50 border border-card-border p-1 rounded-2xl w-[200px]">
            <button 
              onClick={() => setActiveType('reels')}
              className={cn(
                "flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl",
                activeType === 'reels' ? "bg-accent text-surface shadow-lg shadow-accent/20" : "text-muted"
              )}
            >
              Reels
            </button>
            <button 
              onClick={() => setActiveType('posts')}
              className={cn(
                "flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl",
                activeType === 'posts' ? "bg-accent text-surface shadow-lg shadow-accent/20" : "text-muted"
              )}
            >
              Лента
            </button>
          </div>
          <div className="flex gap-2">
            <AnimatePresence>
              {isSearching && (
                <motion.input 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 140, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск..."
                  className="bg-card border border-card-border rounded-xl px-4 py-2 text-[10px] outline-none text-primary"
                  autoFocus
                />
              )}
            </AnimatePresence>
            <button 
              onClick={() => setIsSearching(!isSearching)}
              className={cn(
                "w-10 h-10 bg-card border border-card-border rounded-xl flex items-center justify-center transition-colors",
                isSearching ? "text-accent border-accent/40" : "text-muted"
              )}
            >
              {isSearching ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Statuses / Tags */}
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <button 
            onClick={() => setShowCreate('status')}
            className="flex flex-col items-center gap-2 shrink-0 group"
          >
            <div className="w-14 h-14 rounded-[1.5rem] border-2 border-accent border-dashed p-0.5 group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-[1.3rem] bg-accent/10 flex items-center justify-center">
                <Plus className="w-5 h-5 text-accent" />
              </div>
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Статус</span>
          </button>
          
          {statuses.map(status => (
            <button 
              key={status.id} 
              onClick={() => setViewingStatus(status)}
              className="flex flex-col items-center gap-2 shrink-0 active:scale-90 transition-transform"
            >
              <div className="w-14 h-14 rounded-[1.5rem] border-2 border-accent p-0.5">
                <img src={status.user?.avatar} className="w-full h-full rounded-[1.3rem] object-cover" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40 truncate w-14 text-center">{status.user?.name.split(' ')[0]}</span>
            </button>
          ))}

          {['AI', 'Future', 'Tech', 'Code'].map(tag => (
            <div key={tag} className="flex flex-col items-center gap-2 shrink-0 opacity-30">
              <div className="w-14 h-14 rounded-[1.5rem] bg-card border border-card-border flex items-center justify-center">
                <Hash className="w-4 h-4" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest">{tag}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pt-0 space-y-6">
        {activeType === 'reels' ? (
          <div className="grid grid-cols-1 gap-6">
            <button 
              onClick={() => setShowCreate('reel')}
              className="w-full aspect-[9/16] rounded-[2.5rem] border-2 border-dashed border-card-border bg-card/20 flex flex-col items-center justify-center gap-4 group hover:border-accent/40 transition-colors mb-4"
            >
              <div className="w-16 h-16 bg-accent/10 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-8 h-8 text-accent" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">ЗАПИСАТЬ REEL</p>
            </button>

            {posts.filter(p => p.type === 'video').concat(mockReels).map(reel => (
              <div key={reel.id} className="relative aspect-[9/16] rounded-[2.5rem] overflow-hidden bg-card border border-white/5 shadow-2xl group">
                <video src={reel.url || reel.video} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <button 
                      onClick={() => setPlayingMusicId(playingMusicId === reel.id ? null : reel.id)}
                      className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center border border-white/20 transition-all",
                        playingMusicId === reel.id ? "bg-accent scale-110" : "bg-white/20 backdrop-blur-md"
                      )}
                    >
                      {playingMusicId === reel.id ? <Pause className="w-4 h-4 text-surface fill-surface" /> : <Music className="w-4 h-4 text-white" />}
                    </button>
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-widest">{reel.user?.name || reel.user}</p>
                      <p className="text-[10px] text-white/60 font-medium truncate w-40">{reel.text}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <button onClick={() => handleLike(reel.id)} className={cn("flex items-center gap-2 transition-transform active:scale-125", reel.liked ? "text-accent" : "text-white")}>
                      <Heart className={cn("w-5 h-5", reel.liked && "fill-current")} />
                      <span className="text-[10px] font-black uppercase">{reel.likes}</span>
                    </button>
                    <button 
                      onClick={() => setActiveCommentId(activeCommentId === reel.id ? null : reel.id)}
                      className="flex items-center gap-2 text-white"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase">{reel.comments?.length || reel.comments}</span>
                    </button>
                    <Share2 className="w-5 h-5 text-white/60 ml-auto" />
                  </div>

                  {activeCommentId === reel.id && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-32 inset-x-8 bg-surface/95 backdrop-blur-md p-4 rounded-3xl border border-white/10 shadow-2xl z-50">
                      <div className="flex gap-2">
                        <input 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Написать комментарий..."
                          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-[11px] outline-none text-white"
                        />
                        <button onClick={() => handleComment(reel.id)} className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-surface">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <button 
              onClick={() => setShowCreate('post')}
              className="w-full py-6 rounded-[2rem] border-2 border-dashed border-card-border bg-card/20 flex items-center justify-center gap-3 text-muted group hover:border-accent/40 transition-colors"
            >
              <Plus className="w-5 h-5 group-hover:text-accent transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">НОВАЯ ПУБЛИКАЦИЯ</span>
            </button>
            
            {feedPosts.length === 0 ? (
              <div className="py-20 text-center opacity-40">
                <History className="w-12 h-12 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Лента пуста</p>
              </div>
            ) : (
              feedPosts.map(post => (
                <div key={post.id} className="bg-card border border-card-border rounded-[2rem] p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <img src={post.user?.avatar} alt="" className="w-10 h-10 rounded-2xl border border-card-border" />
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-widest">{post.user?.name}</p>
                      <p className="text-[9px] text-muted font-mono">{new Date(post.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <p className="text-sm text-primary/80">{post.text}</p>
                  {post.type === 'image' && (
                    <div className="rounded-2xl overflow-hidden border border-white/5">
                      <img src={post.url} className="w-full h-auto" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2">
                    <button onClick={() => handleLike(post.id)} className={cn("flex items-center gap-2 pr-4 transition-all active:scale-125", post.liked ? "text-accent" : "text-muted")}>
                      <Heart className={cn("w-4 h-4", post.liked && "fill-current")} />
                      <span className="text-[9px] font-black uppercase">{post.likes}</span>
                    </button>
                    <button 
                      onClick={() => setActiveCommentId(activeCommentId === post.id ? null : post.id)}
                      className="flex items-center gap-2 text-muted"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-[9px] font-black uppercase">{post.comments?.length || 0}</span>
                    </button>
                    <Share2 className="w-4 h-4 text-muted ml-auto" />
                  </div>

                  {activeCommentId === post.id && (
                    <div className="mt-4 pt-4 border-t border-card-border">
                      <div className="space-y-3 mb-4 max-h-40 overflow-y-auto scrollbar-hide">
                        {post.comments?.map((c: any) => (
                          <div key={c.id} className="flex gap-2">
                            <span className="text-[10px] font-black text-accent shrink-0">@USER:</span>
                            <p className="text-[11px] text-primary/70">{c.text}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Ваш ответ..."
                          className="flex-1 bg-white/5 border border-card-border rounded-xl px-4 py-2 text-[11px] outline-none"
                        />
                        <button onClick={() => handleComment(post.id)} className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-surface">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-surface/98 backdrop-blur-2xl flex flex-col p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-primary uppercase tracking-tighter">
                {showCreate === 'reel' ? 'Запись REEL' : showCreate === 'status' ? 'Новый Статус' : 'Публикация'}
              </h2>
              <button 
                onClick={() => { setShowCreate(null); setRecordingPreview(null); }}
                className="w-10 h-10 bg-card border border-card-border rounded-xl flex items-center justify-center text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
              {showCreate === 'reel' && (
                <div className="relative aspect-[9/16] bg-black rounded-[2rem] overflow-hidden border border-card-border">
                  {!recordingPreview ? (
                    <>
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-8 flex justify-center">
                        {!isRecording ? (
                          <button onClick={startRecording} className="w-20 h-20 bg-white border-8 border-white/20 rounded-full flex items-center justify-center animate-pulse" />
                        ) : (
                          <button onClick={stopRecording} className="w-20 h-20 bg-accent border-8 border-accent/20 rounded-xl flex items-center justify-center" />
                        )}
                      </div>
                    </>
                  ) : (
                    <video src={recordingPreview} autoPlay loop playsInline className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              {showCreate !== 'reel' && (
                <div className="space-y-4">
                  <textarea 
                    autoFocus
                    value={newPostText}
                    onChange={e => setNewPostText(e.target.value)}
                    className="w-full min-h-[120px] bg-card border border-card-border rounded-[2rem] p-6 text-sm text-primary outline-none focus:border-accent transition-colors resize-none"
                    placeholder={showCreate === 'status' ? "Что у вас на уме?" : "Поделитесь мыслями..."}
                  />
                  
                  {showCreate === 'status' && (
                    <div className="flex flex-col gap-4">
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest ml-2">ДОБАВИТЬ МЕДИА</p>
                      <div className="flex gap-3">
                        <label className="flex-1 cursor-pointer">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setRecordingPreview(URL.createObjectURL(file));
                              }
                            }} 
                          />
                          <div className="bg-card border border-card-border rounded-2xl p-4 flex items-center justify-center gap-2 hover:border-accent transition-colors">
                            <ImageIcon className="w-5 h-5 text-accent" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">ИЗ ГАЛЕРЕИ</span>
                          </div>
                        </label>
                      </div>
                      
                      {recordingPreview && (
                        <div className="relative rounded-2xl overflow-hidden border border-card-border aspect-square w-32">
                          <img src={recordingPreview} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setRecordingPreview(null)}
                            className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest ml-2">ЗАКРЕПИТЬ ХЕШТЕГИ</p>
                <div className="flex flex-wrap gap-2">
                  {['#tech', '#future', '#ai', '#conference', '#coding', '#networking'].map(tag => (
                    <button 
                      key={tag}
                      onClick={() => {
                        setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                      }}
                      className={cn(
                        "px-4 py-2 border rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                        selectedTags.includes(tag) ? "bg-accent border-accent text-surface shadow-lg shadow-accent/20" : "border-card-border text-muted"
                      )}
                    >
                      {tag} {selectedTags.includes(tag) && <Check className="w-3 h-3 inline ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              onClick={handleCreateContent}
              disabled={loading}
              className="mt-8 w-full bg-accent text-surface py-5 rounded-[2.5rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-accent/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <span>{loading ? 'ЗАГРУЗКА...' : 'ПОДТВЕРДИТЬ'}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Viewing Status Modal */}
      <AnimatePresence>
        {viewingStatus && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="absolute inset-0 z-[150] bg-black flex flex-col p-6 overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 flex gap-1 p-2">
              <div className="flex-1 h-full bg-white/40 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5 }}
                  onAnimationComplete={() => setViewingStatus(null)}
                  className="h-full bg-white" 
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between mb-12">
              <div className="flex items-center gap-3">
                <img src={viewingStatus.user?.avatar} className="w-10 h-10 rounded-2xl border border-white/20" />
                <div>
                  <p className="text-xs font-black text-white uppercase tracking-widest">{viewingStatus.user?.name}</p>
                  <p className="text-[9px] text-white/40 uppercase font-mono">СЕЙЧАС</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingStatus(null)}
                className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              {viewingStatus.type === 'image' ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <img src={viewingStatus.url} className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-2xl" />
                  <p className="mt-6 text-lg font-bold text-white italic">{viewingStatus.text}</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-accent/20 rounded-[2.5rem] flex items-center justify-center mb-8 border border-accent/30">
                    <User className="w-10 h-10 text-accent" />
                  </div>
                  <p className="text-2xl font-black text-white italic leading-tight">«{viewingStatus.text}»</p>
                </>
              )}
            </div>

            <div className="mt-auto flex gap-4 p-4 border-t border-white/10">
              <input 
                placeholder="Ответить другу..."
                className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white outline-none"
              />
              <button className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center text-surface shadow-lg shadow-accent/20">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
