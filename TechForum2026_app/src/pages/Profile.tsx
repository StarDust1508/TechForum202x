import { useRef, useState, useMemo, useEffect, useCallback, type ChangeEvent } from 'react';
import { User, Mail, Phone, Building2, Briefcase, GraduationCap, LogOut, Check, FileText, Plus, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clearLocalSession, isLocalAuthFallbackEnabled, updateLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl, resolveAssetUrl, authFetch, clearSessionToken } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import { INTERESTS } from '../data';
import { clearPushRegistrationLocally, getStoredPushToken, unregisterPushNotifications } from '@/src/lib/push';

interface UserData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  role?: string;
  avatar?: string;
  company?: string;
  workplace?: string;
  education?: string;
  birthday?: string;
  interestsCount?: number;
  [key: string]: any;
}

interface ProfileProps {
  user: UserData;
  onUpdate?: (user: UserData) => void;
}

const fields = [
  { key: 'name', label: 'Имя', icon: User, type: 'text', placeholder: 'Иванов Иван Иванович' },
  { key: 'email', label: 'Email', icon: Mail, type: 'email', placeholder: 'email@example.com' },
  { key: 'phone', label: 'Телефон', icon: Phone, type: 'tel', placeholder: '+7 (999) 123-45-67' },
  { key: 'company', label: 'Компания', icon: Building2, type: 'text', placeholder: 'ООО «Компания»' },
  { key: 'workplace', label: 'Место работы', icon: Briefcase, type: 'text', placeholder: 'Должность / отдел' },
  { key: 'education', label: 'Место учёбы', icon: GraduationCap, type: 'text', placeholder: 'Университет / курс' },
] as const;

type FieldKey = (typeof fields)[number]['key'];

export default function Profile({ user: initialUser, onUpdate }: ProfileProps) {
  const [user, setUser] = useState(initialUser);

  const updateUser = (updated: UserData) => {
    // Preserve interestsCount from current user if server response doesn't include it
    const merged = { ...user, ...updated };
    if (updated.interestsCount === undefined && user.interestsCount !== undefined) {
      merged.interestsCount = user.interestsCount;
    }
    setUser(merged);
    onUpdate?.(merged);
  };

  const buildForm = (u: UserData): Record<FieldKey, string> => ({
    name: u.name || '',
    email: u.email || '',
    phone: u.phone || '',
    company: u.company || '',
    workplace: u.workplace || '',
    education: u.education || '',
  });

  const [editForm, setEditForm] = useState<Record<FieldKey, string>>(buildForm(user));
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(user.bio || '');
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSaved, setBioSaved] = useState(false);
  const bioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [interests, setInterests] = useState<Array<{ id: string; label: string; color: string }>>([]);

  // Load user interests (API returns { interestIds: string[] }, map to INTERESTS data)
  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl('/me/interests'), { credentials: 'include' });
        if (r.ok) {
          const data = await r.json();
          const ids: string[] = data?.interestIds || [];
          const mapped = ids
            .map(id => INTERESTS.find(it => it.id === id))
            .filter(Boolean) as Array<{ id: string; label: string; color: string }>;
          setInterests(mapped);
        }
      } catch { /* offline */ }
    })();
  }, []);

  const saveBio = useCallback(async (value: string) => {
    setBioSaving(true);
    try {
      const res = await authFetch(resolveApiUrl('/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bio: value }),
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser(updated);
        setBioSaved(true);
        setTimeout(() => setBioSaved(false), 2000);
      }
    } catch { /* offline */ }
    finally { setBioSaving(false); }
  }, [user]);

  const handleBioChange = (value: string) => {
    setBio(value);
    setBioSaved(false);
    if (bioTimerRef.current) clearTimeout(bioTimerRef.current);
    bioTimerRef.current = setTimeout(() => saveBio(value), 1200);
  };

  useEffect(() => () => { if (bioTimerRef.current) clearTimeout(bioTimerRef.current); }, []);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialForm = useMemo(() => buildForm(user), [user]);

  const hasChanges = useMemo(() => {
    return fields.some(f => editForm[f.key] !== initialForm[f.key]);
  }, [editForm, initialForm]);

  const handleFieldChange = (key: FieldKey, value: string) => {
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const handleLogout = async () => {
    const pushToken = getStoredPushToken();
    if (pushToken) {
      // Сначала используем уже развёрнутый endpoint удаления. Если сеть/сервер
      // недоступны, всё равно инвалидируем native token: старый аккаунт не
      // должен продолжать получать сообщения на этом телефоне.
      const removed = await unregisterPushNotifications();
      if (!removed) await clearPushRegistrationLocally();
    }
    try {
      const logoutUrl = resolveApiUrl('/auth/logout');
      const response = await authFetch(logoutUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToken: pushToken || null }),
      });
      if (response.ok) await clearPushRegistrationLocally();
    } catch (e) {
      console.error('Backend logout failed (continuing with local cleanup)', e);
    }
    clearSessionToken();
    clearLocalSession();
    window.location.reload();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profileUrl = resolveApiUrl('/auth/me');
      const res = await authFetch(profileUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        updateUser(updated);
        return;
      }
      throw new Error('Backend profile save failed');
    } catch (e) {
      if (isLocalAuthFallbackEnabled()) {
        try {
          const updatedLocal = updateLocalUser(String(user.id || ''), editForm);
          if (updatedLocal) {
            updateUser(updatedLocal);
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

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(resolveApiUrl('/me/avatar'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `upload_failed_${res.status}`);
      }
      const data = await res.json();
      const updated = { ...user, avatar: data.avatar };
      updateUser(updated);
    } catch (err) {
      console.error('Avatar upload failed', err);
      setAvatarError(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const avatarSrc = resolveAssetUrl(user.avatar);

  // Preload avatar into browser cache so it renders instantly
  const [avatarReady, setAvatarReady] = useState(!avatarSrc);
  useEffect(() => {
    if (!avatarSrc) { setAvatarReady(true); return; }
    const img = new Image();
    img.onload = () => setAvatarReady(true);
    img.onerror = () => setAvatarReady(true);
    img.src = avatarSrc;
  }, [avatarSrc]);

  return (
    <div className="flex-1 px-5 space-y-6 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <div className="flex items-center gap-3">
        <BackButton />
        <h1
          className="font-display text-[28px] leading-none font-bold"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >Профиль</h1>
      </div>

      <header className="space-y-4 text-center flex flex-col items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        {/* Avatar with "+" button in bottom-right corner */}
        <div className="relative">
          <div
            className="w-44 h-44 bg-primary/10 border-[4px] border-primary/40 rounded-full flex items-center justify-center text-4xl font-black text-primary shadow-xl shadow-primary/10 overflow-hidden"
          >
            {avatarSrc && avatarReady ? (
              <img
                src={avatarSrc}
                alt={user.name || 'avatar'}
                className="w-full h-full object-cover relative z-10"
                referrerPolicy="no-referrer"
              />
            ) : avatarSrc && !avatarReady ? (
              /* Shimmer placeholder while avatar image preloads */
              <div className="w-full h-full bg-primary/10 animate-pulse" />
            ) : (
              <span className="text-5xl font-black text-primary select-none">
                {String(user.name || '?').trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          {/* Small "+" button to change avatar */}
          <button
            type="button"
            disabled={uploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-primary border-[3px] border-background flex items-center justify-center text-primary-foreground shadow-lg active:scale-90 transition-transform disabled:opacity-50 z-10"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
          </button>
        </div>
        {avatarError && (
          <p className="text-[10px] text-red-400 font-medium">{avatarError}</p>
        )}
        <div className="space-y-1">
          <h2
            className="font-display text-2xl font-bold text-foreground"
          >{user.name || 'Пользователь'}</h2>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.3em]">{user.role || 'Пользователь'}</p>
        </div>
      </header>

      <div className="space-y-5">
        {fields.map((field, i) => {
          const Icon = field.icon;
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="space-y-2"
            >
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider ml-1">
                {field.label}
              </label>
              <div className="relative">
                <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <input
                  type={field.type}
                  value={editForm[field.key]}
                  placeholder={field.placeholder}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                  className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 outline-none transition-colors"
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bio field */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider ml-1">
            О себе
          </label>
          {bioSaving && <span className="text-[9px] text-primary/60 animate-pulse">Сохраняю...</span>}
          {bioSaved && <span className="text-[9px] text-green-400">Сохранено</span>}
        </div>
        <div className="relative">
          <FileText className="absolute left-4 top-4 w-4 h-4 text-primary" />
          <textarea
            value={bio}
            onChange={e => handleBioChange(e.target.value)}
            placeholder="Расскажите о себе — интересы, опыт, чем занимаетесь..."
            maxLength={500}
            rows={3}
            className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 outline-none transition-colors resize-none"
          />
        </div>
        <p className="text-[9px] text-muted-foreground/40 text-right mr-1">{bio.length}/500</p>
      </motion.div>

      {/* Interests section */}
      {interests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 ml-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
              Интересы
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {interests.map(it => (
              <span
                key={it.id}
                className="px-3.5 py-2 rounded-2xl text-[12px] font-semibold border"
                style={{
                  color: it.color,
                  borderColor: `${it.color}30`,
                  backgroundColor: `${it.color}10`,
                }}
              >
                {it.label}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pt-2"
          >
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-primary-foreground py-5 rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Check className="w-5 h-5 animate-pulse" /> : 'Сохранить'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-3 p-5 bg-red-500/5 border border-red-500/10 rounded-2xl hover:bg-red-500/10 transition-all active:scale-[0.98]"
      >
        <LogOut className="w-5 h-5 text-red-500/60" />
        <span className="text-sm font-semibold uppercase tracking-wider text-red-500/80">Выйти</span>
      </button>
    </div>
  );
}
