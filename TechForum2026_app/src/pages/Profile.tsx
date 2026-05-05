// FILE: src/pages/Profile.tsx
// VERSION: 2.0.0 — Round 8 flatten.
// Все поля профиля inline на главном экране (фото, имя, email, телефон, bio).
// Раньше были отдельные модалки «Редактировать» и «Безопасность» — убраны.
// Безопасность переехала в Settings → Согласие на обработку ПД.

import { useRef, useState, type ChangeEvent, useEffect } from 'react';
import { LogOut, Mail, Phone, User as UserIcon, Info, Camera, Loader2, Check } from 'lucide-react';
import { clearLocalSession, isLocalAuthFallbackEnabled, updateLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import HudFrame from '@/src/components/ui/HudFrame';
import Input from '@/src/components/ui/Input';
import AvatarImage from '@/src/components/ui/AvatarImage';
import { formatPhone, getValidationMessage, isValidPhone } from '@/src/lib/phone';

interface ProfileProps {
  user: any;
  onUpdate?: (next: any) => void;
}

export default function Profile({ user: initialUser, onUpdate }: ProfileProps) {
  const [user, setUserLocal] = useState(initialUser);
  const setUser = (next: any | ((prev: any) => any)) => {
    setUserLocal((prev: any) => {
      const resolved = typeof next === 'function' ? (next as (p: any) => any)(prev) : next;
      onUpdate?.(resolved);
      return resolved;
    });
  };

  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: formatPhone(user.phone || ''),
    bio: user.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Если приходит initialUser обновлённый из App.tsx (после prefetch /auth/me) —
  // обновляем форму, чтобы сохранённые на бэке данные показывались.
  useEffect(() => {
    setUserLocal(initialUser);
    setForm({
      name: initialUser.name,
      email: initialUser.email,
      phone: formatPhone(initialUser.phone || ''),
      bio: initialUser.bio || '',
    });
  }, [initialUser]);

  // Проверка изменений: показываем кнопку «Сохранить» только если форма
  // отличается от user.
  const hasChanges =
    form.name !== user.name ||
    form.email !== user.email ||
    formatPhone(user.phone || '') !== form.phone ||
    (user.bio || '') !== form.bio;

  const handleLogout = async () => {
    try {
      await fetch(resolveApiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Backend logout failed (continuing with local cleanup)', e);
    }
    clearLocalSession();
    window.location.reload();
  };

  const handleSave = async () => {
    if (form.phone && form.phone.trim() !== '+7' && form.phone.trim() !== '+7 ' && !isValidPhone(form.phone)) {
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(resolveApiUrl('/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
        return;
      }
      throw new Error('save_failed');
    } catch {
      if (isLocalAuthFallbackEnabled()) {
        try {
          const updatedLocal = updateLocalUser(String(user.id || ''), form);
          if (updatedLocal) {
            setUser(updatedLocal);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
            return;
          }
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Сжимает изображение до max 1024×1024 jpeg ~85% quality.
  const compressImage = async (file: File): Promise<Blob> => {
    if (!('createImageBitmap' in window) || typeof OffscreenCanvas === 'undefined') {
      return file;
    }
    try {
      const bmp = await createImageBitmap(file);
      const MAX = 1024;
      const ratio = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * ratio);
      const h = Math.round(bmp.height * ratio);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, w, h);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      return blob;
    } catch {
      return file;
    }
  };

  const friendlyAvatarError = (raw: string): string => {
    if (raw.includes('413') || raw === 'LIMIT_FILE_SIZE') return 'Файл слишком большой. Попробуйте меньше 5 МБ.';
    if (raw.includes('unsupported_mime')) return 'Формат не поддерживается. Используйте JPG, PNG или WEBP.';
    if (raw.includes('file_required')) return 'Файл не выбран.';
    if (raw.includes('Не авторизован') || raw.includes('401')) return 'Сессия истекла, войдите снова.';
    if (/network|failed to fetch|load failed|typeerror/i.test(raw)) return 'Нет соединения с сервером.';
    return `Не удалось загрузить: ${raw}`;
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const upload = compressed instanceof File
        ? compressed
        : new File([compressed], 'avatar.jpg', { type: 'image/jpeg' });
      const fd = new FormData();
      fd.append('file', upload);
      const res = await fetch(resolveApiUrl('/me/avatar'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `upload_failed_${res.status}`);
      }
      const data = await res.json();
      setUser((prev: any) => ({ ...prev, avatar: data.avatar }));
      setAvatarVersion((v) => v + 1);
    } catch (err) {
      console.error('Avatar upload failed', err);
      const raw = err instanceof Error ? err.message : 'upload_failed';
      setAvatarError(friendlyAvatarError(raw));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isUserUploaded = typeof user.avatar === 'string' && user.avatar.startsWith('/uploads/');
  const avatarBase = isUserUploaded ? resolveAssetUrl(user.avatar) : null;
  const avatarSrc = avatarBase ? `${avatarBase}${avatarBase.includes('?') ? '&' : '?'}v=${avatarVersion}` : null;

  // Аватар Round 8: ровный квадратный octagon (h=w). Раньше h=round(w*0.92)
  // делал октагон растянутым по вертикали, фото выглядело «неровно».
  // Теперь форма точно симметричная, фото вписано идеально.
  const buildOctagonClip = (size: number): string => {
    const cut = Math.round(size * 0.18);
    const px = (x: number, y: number): string =>
      `${((x / size) * 100).toFixed(2)}% ${((y / size) * 100).toFixed(2)}%`;
    return `polygon(${px(cut, 4)}, ${px(size - cut, 4)}, ${px(size - 4, cut)}, ${px(size - 4, size - cut)}, ${px(size - cut, size - 4)}, ${px(cut, size - 4)}, ${px(4, size - cut)}, ${px(4, cut)})`;
  };

  const renderAvatar = (sizePx: number) => {
    const clip = buildOctagonClip(sizePx);
    return (
      <HudFrame size={{ w: sizePx, h: sizePx }} fillOpacity={0.35} glow={14}>
        <div
          className="absolute inset-0 overflow-hidden bg-[#0a2f38]"
          style={{ clipPath: clip, WebkitClipPath: clip }}
        >
          <AvatarImage src={avatarSrc} name={user.name} className="h-full w-full" letterClassName="text-2xl" />
        </div>
      </HudFrame>
    );
  };

  const phoneValidationMsg = getValidationMessage(form.phone || '');

  return (
    <div
      className="relative px-6 pb-32"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
      }}
    >
      <BackButton />

      {/* Аватар + имя — центрировано */}
      <header className="space-y-4 text-center flex flex-col items-center mb-7">
        {renderAvatar(120)}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <button
          type="button"
          disabled={uploadingAvatar}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] border border-[#4ec9c0]/40 bg-[#0a2f38]/55 text-[#4ec9c0] text-[11px] font-semibold uppercase tracking-[0.16em] hover:border-[#4ec9c0]/70 hover:bg-[#0a2f38]/80 active:scale-[0.98] transition-all disabled:opacity-50 font-display-cyrl"
        >
          {uploadingAvatar
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Загрузка</>
            : <><Camera className="w-3.5 h-3.5" strokeWidth={1.6} /> Изменить фото</>}
        </button>
        {avatarError && <p className="text-[11px] text-rose-300 font-medium">{avatarError}</p>}
      </header>

      {/* Поля профиля */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="font-display-cyrl text-[10px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Полное имя</label>
          <Input
            icon={UserIcon}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-display-cyrl text-[10px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Email</label>
          <Input
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-display-cyrl text-[10px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Телефон</label>
          <Input
            icon={Phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 (___) ___-__-__"
            value={form.phone}
            onFocus={() => {
              if (!form.phone) setForm((f) => ({ ...f, phone: '+7 ' }));
            }}
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
          />
          {phoneValidationMsg && (
            <p className="ml-1 text-[11px] text-amber-300/85 font-blueprint">{phoneValidationMsg}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="font-display-cyrl text-[10px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">О себе</label>
          <div className="relative">
            <Info className="pointer-events-none absolute left-4 top-4 w-[18px] h-[18px] text-[#4ec9c0]/65" strokeWidth={1.6} />
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full h-28 rounded-[14px] border border-[#4ec9c0]/30 bg-[#03161c]/40 py-3.5 pl-12 pr-4 text-[15px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/65 focus:border-[#4ec9c0]/70 focus:bg-[#0a2f38]/55 outline-none transition-colors resize-none font-blueprint"
              placeholder="Несколько слов о себе…"
            />
          </div>
        </div>
      </div>

      {/* Logout button — всегда внизу секции */}
      <button
        onClick={handleLogout}
        className="mt-8 w-full flex items-center justify-center gap-3 p-4 rounded-[14px] border border-rose-500/25 bg-rose-500/[0.04] hover:bg-rose-500/[0.10] hover:border-rose-500/40 active:scale-[0.99] transition-all"
      >
        <LogOut className="w-4 h-4 text-rose-300" strokeWidth={1.6} />
        <span className="font-display-cyrl text-[13px] text-rose-200 uppercase tracking-[0.16em]">
          Выйти из системы
        </span>
      </button>

      {/* Floating Save button — появляется когда есть несохранённые изменения */}
      {hasChanges && (
        <div
          className="fixed left-0 right-0 bottom-0 z-30 px-6 pt-3 bg-gradient-to-t from-[#03161c] via-[#03161c]/95 to-transparent"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !!phoneValidationMsg}
            className="w-full flex items-center justify-center gap-2 bg-[#4ec9c0] text-[#03161c] py-4 rounded-2xl text-[13px] font-bold uppercase tracking-[0.16em] active:scale-[0.98] hover:brightness-110 transition-all font-display-cyrl shadow-[0_8px_24px_rgba(78,201,192,0.25)] disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> Сохранение</>
            ) : (
              <>Сохранить изменения</>
            )}
          </button>
        </div>
      )}

      {/* Маленький success-индикатор */}
      {saved && !hasChanges && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/15 backdrop-blur-md px-4 py-2 text-emerald-200 text-[12px] font-semibold">
          <Check className="w-3.5 h-3.5" strokeWidth={2.2} />
          Сохранено
        </div>
      )}
    </div>
  );
}
