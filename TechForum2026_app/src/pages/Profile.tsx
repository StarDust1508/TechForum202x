import { useState } from 'react';
import { User, Settings, Shield, LogOut, ChevronRight, X, Mail, Phone, Info, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { clearLocalSession, isLocalAuthFallbackEnabled, updateLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';

interface ProfileProps {
  user: any;
}

export default function Profile({ user: initialUser }: ProfileProps) {
  const [user, setUser] = useState(initialUser);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    bio: user.bio || ''
  });
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    // BUG_FIX_CONTEXT: v1 чистил только локальную сессию в localStorage,
    // но серверная cookie-сессия оставалась валидной до истечения maxAge=24h.
    // При повторном /auth/me юзер всё ещё считался залогиненным.
    // Сейчас явно бьём в /auth/logout (best-effort, без блокировки UI).
    try {
      const logoutUrl = resolveApiUrl('/auth/logout');
      await fetch(logoutUrl, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Backend logout failed (continuing with local cleanup)', e);
    }
    clearLocalSession();
    window.location.reload();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileUrl = resolveApiUrl('/auth/me');
      const res = await fetch(profileUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setShowEdit(false);
        return;
      }
      throw new Error('Backend profile save failed');
    } catch (e) {
      if (isLocalAuthFallbackEnabled()) {
        try {
          const updatedLocal = updateLocalUser(String(user.id || ''), editForm);
          if (updatedLocal) {
            setUser(updatedLocal);
            setShowEdit(false);
            return;
          }
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 pb-24 pt-12 px-6 space-y-8 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-4 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-accent/10 border-2 border-accent/30 rounded-[2.5rem] flex items-center justify-center text-3xl font-black text-accent shadow-xl shadow-accent/5 relative overflow-hidden group">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || 'avatar'}
              className="relative z-10 w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-accent select-none">
            {String(user.name || '?').trim().charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white">{user.name}</h1>
          <p className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">{user.role || 'Пользователь'}</p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="bg-[#13161f]/40 backdrop-blur-md border border-card-border rounded-[2rem] p-6 space-y-6 shadow-xl circuit-border">
          <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em] mb-2 px-1">Настройки аккаунта</h2>
          
          <div className="space-y-2">
            <button 
              onClick={() => setShowEdit(true)}
              className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <Settings className="w-5 h-5 text-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-primary">Био и Профиль</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-accent" />
            </button>

            <button className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group">
              <div className="flex items-center gap-4">
                <Shield className="w-5 h-5 text-accent" />
                <span className="text-xs font-black uppercase tracking-widest text-primary">Безопасность</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-accent border border-accent/20 px-1.5 py-0.5 rounded">HIGH</span>
                <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-accent" />
              </div>
            </button>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-6 bg-red-500/5 border border-red-500/10 rounded-[2rem] hover:bg-red-500/10 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-500/60" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest text-red-500/80">Выйти из системы</span>
          </div>
        </button>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] bg-surface flex flex-col p-8"
          >
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-xl font-black text-primary uppercase tracking-tighter">Редактировать</h2>
              <button 
                onClick={() => setShowEdit(false)}
                className="w-10 h-10 bg-card border border-card-border rounded-xl flex items-center justify-center text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto scrollbar-hide pb-20">
              <div className="space-y-2">
                <label className="text-[10px] text-muted font-black uppercase tracking-widest ml-1">Полное имя</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <input 
                    value={editForm.name}
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-muted font-black uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <input 
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-muted font-black uppercase tracking-widest ml-1">Телефон</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <input 
                    value={editForm.phone}
                    onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-muted font-black uppercase tracking-widest ml-1">О себе (Био)</label>
                <div className="relative">
                  <Info className="absolute left-4 top-4 w-4 h-4 text-accent" />
                  <textarea 
                    value={editForm.bio}
                    onChange={e => setEditForm({...editForm, bio: e.target.value})}
                    className="w-full h-32 bg-card border border-card-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-accent outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={saving}
              className="mt-auto bg-accent text-surface py-5 rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Check className="w-5 h-5 animate-pulse" /> : 'СОХРАНИТЬ ИЗМЕНЕНИЯ'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
