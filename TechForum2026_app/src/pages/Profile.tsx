import { useRef, useState, type ChangeEvent } from 'react';
import { Settings, Shield, LogOut, ChevronRight, X, Mail, Phone, User as UserIcon, Info, Camera, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clearLocalSession, isLocalAuthFallbackEnabled, updateLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import AppBackground from '@/src/components/AppBackground';
import HudFrame from '@/src/components/ui/HudFrame';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import AvatarImage from '@/src/components/ui/AvatarImage';
import { formatPhone, getValidationMessage, isValidPhone } from '@/src/lib/phone';

interface ProfileProps {
  user: any;
}

export default function Profile({ user: initialUser }: ProfileProps) {
  const [user, setUser] = useState(initialUser);
  const [showEdit, setShowEdit] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    phone: formatPhone(user.phone || ''),
    bio: user.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  // BUG_FIX: бэкенд после POST /me/avatar возвращает тот же путь и браузер кешит.
  const [avatarVersion, setAvatarVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    // Phone — опциональный, но если заполнен, должен быть валиден.
    if (editForm.phone && editForm.phone.trim() !== '+7' && editForm.phone.trim() !== '+7 '
        && !isValidPhone(editForm.phone)) {
      // Live-message уже показан под полем, дополнительно ничего не делаем.
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(resolveApiUrl('/auth/me'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
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

  // Сжимает изображение до max 1024×1024 jpeg ~85% quality. Современные
  // телефоны делают фото 4-12MB, что упирается в 6MB multer лимит и 8MB
  // nginx — пользователь видит upload_failed_413. Resize+jpeg даёт типичный
  // итог 100-300KB, проходит спокойно. Если canvas/blob недоступен (старый
  // WebView) — падаем на исходный файл и серверный лимит примет/отвергнет.
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

  // FormData без явного Content-Type — браузер сам выставит multipart с boundary.
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      // Если получился Blob (а не File) — оборачиваем в File с правильным
      // именем/типом, чтобы multer проставил mime корректно.
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

  // Аватар считается «своим загруженным» только если URL указывает на наш
  // /uploads/ — dicebear-фоллбэк (default seed на бэке) не считается реальным
  // фото. По требованию юзера: пустое нейтральное состояние, пока юзер не
  // загрузил своё фото.
  const isUserUploaded = typeof user.avatar === 'string' && user.avatar.startsWith('/uploads/');
  const avatarBase = isUserUploaded ? resolveAssetUrl(user.avatar) : null;
  const avatarSrc = avatarBase ? `${avatarBase}${avatarBase.includes('?') ? '&' : '?'}v=${avatarVersion}` : null;

  // HUD-аватар: октагональная рамка. AvatarImage primitive ставит инициал
  // как fallback при ошибке загрузки или отсутствии src — единая логика
  // с Chat-списком и других местах.
  // Аватар внутри HUD-octagon. Раньше img был размером с почти весь octagon
  // (inset-2 + rounded-md) и углы фото вылезали за octagon-стенки. Теперь
  // фото — круглое (overflow-hidden + rounded-full), занимает 64% от HUD,
  // центровано — гарантированно вписывается в octagon.
  const renderAvatar = (sizePx: number) => {
    const inner = Math.round(sizePx * 0.64);
    return (
      <HudFrame size={{ w: sizePx, h: sizePx * 0.92 }} fillOpacity={0.35} glow={14}>
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-[#0a2f38] border border-[#4ec9c0]/40"
          style={{ width: inner, height: inner }}
        >
          <AvatarImage src={avatarSrc} name={user.name} className="h-full w-full" letterClassName="text-2xl" />
        </div>
      </HudFrame>
    );
  };

  return (
    <div className="flex-1 pb-24 px-6 space-y-8 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-4 text-center flex flex-col items-center">
        {renderAvatar(112)}
        <div className="space-y-1">
          <h1 className="font-display-cyrl text-[26px] font-semibold text-[#d8f0ee] tracking-wide">{user.name}</h1>
          <p className="font-mono text-[11px] text-[#4ec9c0]/85 uppercase tracking-[0.3em]">{user.role || 'Пользователь'}</p>
        </div>
      </header>

      <div className="space-y-4">
        <div className="rounded-[20px] border border-[#4ec9c0]/30 bg-[#0a2f38]/55 backdrop-blur-md p-5 space-y-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <h2 className="font-display-cyrl text-[11px] uppercase tracking-[0.32em] text-[#7aa8a4]">
            Настройки аккаунта
          </h2>

          <div className="space-y-2">
            <button
              onClick={() => setShowEdit(true)}
              className="w-full flex items-center justify-between p-4 rounded-[14px] border border-[#4ec9c0]/20 bg-[#03161c]/40 hover:border-[#4ec9c0]/45 hover:bg-[#03161c]/60 active:scale-[0.99] transition-all group"
            >
              <div className="flex items-center gap-4">
                <Settings className="w-5 h-5 text-[#4ec9c0]" strokeWidth={1.5} />
                <span className="font-display-cyrl text-[15px] text-[#d8f0ee]">Профиль</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7aa8a4] group-hover:text-[#4ec9c0]" strokeWidth={1.6} />
            </button>

            <button
              onClick={() => setShowSecurity(true)}
              className="w-full flex items-center justify-between p-4 rounded-[14px] border border-[#4ec9c0]/20 bg-[#03161c]/40 hover:border-[#4ec9c0]/45 hover:bg-[#03161c]/60 active:scale-[0.99] transition-all group"
            >
              <div className="flex items-center gap-4">
                <Shield className="w-5 h-5 text-[#4ec9c0]" strokeWidth={1.5} />
                <span className="font-display-cyrl text-[15px] text-[#d8f0ee]">Безопасность</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-widest text-[#4ec9c0] border border-[#4ec9c0]/35 px-1.5 py-0.5 rounded">152-ФЗ</span>
                <ChevronRight className="w-4 h-4 text-[#7aa8a4] group-hover:text-[#4ec9c0]" strokeWidth={1.6} />
              </div>
            </button>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-5 rounded-[20px] border border-rose-500/25 bg-rose-500/[0.04] hover:bg-rose-500/[0.10] hover:border-rose-500/40 active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/30 rounded-[10px] flex items-center justify-center">
              <LogOut className="w-5 h-5 text-rose-300" strokeWidth={1.6} />
            </div>
            <span className="font-display-cyrl text-[15px] text-rose-200">Выйти из системы</span>
          </div>
        </button>
      </div>

      {/* ===== Edit Profile Modal ===== */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100]"
          >
            <AppBackground>
              <div className="flex flex-col px-6 pt-8 flex-1" style={{ minHeight: '100dvh', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-display-cyrl text-[24px] font-semibold text-[#d8f0ee] tracking-wide">Редактировать</h2>
                  <button
                    onClick={() => setShowEdit(false)}
                    aria-label="Закрыть"
                    className="w-10 h-10 rounded-[12px] border border-[#4ec9c0]/35 bg-[#03161c]/60 backdrop-blur-md flex items-center justify-center text-[#4ec9c0] hover:text-[#d8f0ee] hover:border-[#4ec9c0]/60 active:scale-90 transition-all"
                  >
                    <X className="w-5 h-5" strokeWidth={1.6} />
                  </button>
                </div>

                <div className="space-y-5 overflow-y-auto scrollbar-hide pb-28">
                  <div className="flex flex-col items-center gap-4">
                    {renderAvatar(112)}
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
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] border border-[#4ec9c0]/40 bg-[#0a2f38]/55 text-[#4ec9c0] text-[12px] font-semibold uppercase tracking-[0.14em] hover:border-[#4ec9c0]/70 hover:bg-[#0a2f38]/80 active:scale-[0.98] transition-all disabled:opacity-50 font-display-cyrl"
                    >
                      {uploadingAvatar
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Загрузка</>
                        : <><Camera className="w-4 h-4" strokeWidth={1.6} /> Изменить фото</>}
                    </button>
                    {avatarError && <p className="text-[11px] text-rose-300 font-medium">{avatarError}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="font-display-cyrl text-[11px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Полное имя</label>
                    <Input
                      icon={UserIcon}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-display-cyrl text-[11px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Email</label>
                    <Input
                      icon={Mail}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="font-display-cyrl text-[11px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">Телефон</label>
                    <Input
                      icon={Phone}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+7 (___) ___-__-__"
                      value={editForm.phone}
                      onFocus={() => {
                        if (!editForm.phone) setEditForm((f) => ({ ...f, phone: '+7 ' }));
                      }}
                      onChange={(e) => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })}
                    />
                    {/* Live валидация — показываем mismatch до save, чтобы юзер
                        не получал generic 400 от бэка после сохранения. */}
                    {(() => {
                      const msg = getValidationMessage(editForm.phone || '');
                      return msg ? (
                        <p className="ml-1 text-[11px] text-amber-300/85 font-blueprint">{msg}</p>
                      ) : null;
                    })()}
                  </div>

                  <div className="space-y-2">
                    <label className="font-display-cyrl text-[11px] text-[#7aa8a4] uppercase tracking-[0.22em] ml-1">О себе</label>
                    <div className="relative">
                      <Info className="pointer-events-none absolute left-4 top-4 w-[18px] h-[18px] text-[#4ec9c0]/65" strokeWidth={1.6} />
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        className="w-full h-32 rounded-[14px] border border-[#4ec9c0]/30 bg-[#03161c]/40 py-4 pl-12 pr-4 text-[16px] text-[#d8f0ee] placeholder:text-[#7aa8a4]/65 focus:border-[#4ec9c0]/70 focus:bg-[#0a2f38]/55 outline-none transition-colors resize-none font-blueprint"
                        placeholder="Несколько слов о себе…"
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 px-6 pt-3 bg-gradient-to-t from-[#03161c] via-[#03161c]/95 to-transparent"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                >
                  <Button onClick={handleSave} loading={saving}>Сохранить изменения</Button>
                </div>
              </div>
            </AppBackground>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Security / User Agreement Modal ===== */}
      <AnimatePresence>
        {showSecurity && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100]"
          >
            <AppBackground>
              <div className="flex flex-col px-6 pt-8 flex-1" style={{ minHeight: '100dvh', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display-cyrl text-[24px] font-semibold text-[#d8f0ee] tracking-wide">Соглашение</h2>
                  <button
                    onClick={() => setShowSecurity(false)}
                    aria-label="Закрыть"
                    className="w-10 h-10 rounded-[12px] border border-[#4ec9c0]/35 bg-[#03161c]/60 backdrop-blur-md flex items-center justify-center text-[#4ec9c0] hover:text-[#d8f0ee] hover:border-[#4ec9c0]/60 active:scale-90 transition-all"
                  >
                    <X className="w-5 h-5" strokeWidth={1.6} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide pb-28 space-y-4 text-[13px] leading-relaxed text-[#d8f0ee]/80 font-blueprint">
                  <h3 className="font-display-cyrl text-[14px] font-semibold text-[#4ec9c0] uppercase tracking-[0.22em]">
                    Пользовательское соглашение и согласие на обработку персональных данных
                  </h3>
                  <p className="font-mono text-[10px] text-[#7aa8a4] uppercase tracking-widest">Редакция от 2 мая 2026 г.</p>

                  <p>
                    Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения
                    между ООО «Bubble Group» (далее — «Оператор», ИНН/ОГРН указаны на сайте техфорум.рф,
                    адрес электронной почты оператора: <span className="text-[#4ec9c0]">info@techforum.ru</span>)
                    и физическим лицом — пользователем мобильного приложения TechForum 2026 (далее — «Пользователь»),
                    в связи с использованием функций приложения и обработкой персональных данных в соответствии
                    с Федеральным законом № 152-ФЗ «О персональных данных».
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">1. Предмет соглашения.</strong> Принимая настоящее Соглашение,
                    Пользователь даёт согласие на обработку Оператором его персональных данных в целях:
                    регистрации и аутентификации в приложении; организации участия в конференции TechForum 2026;
                    направления уведомлений и сервисных сообщений; обеспечения работы личного кабинета,
                    ленты, чата и иных функций приложения; формирования аналитики и улучшения сервиса.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">2. Перечень обрабатываемых персональных данных.</strong>
                    Оператор обрабатывает: фамилию, имя, отчество (при наличии); адрес электронной почты;
                    номер мобильного телефона; должность и место работы (при наличии, по желанию пользователя);
                    биографическую информацию, указанную Пользователем добровольно; фотографию профиля;
                    идентификаторы устройства, IP-адрес, технические сведения о сессии и журналы действий.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">3. Способы обработки.</strong> Обработка осуществляется
                    как с использованием средств автоматизации, так и без таковых: сбор, запись, систематизация,
                    накопление, хранение, уточнение, извлечение, использование, передача (предоставление,
                    доступ), обезличивание, блокирование, удаление и уничтожение персональных данных.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">4. Передача данных третьим лицам.</strong> Оператор не передаёт
                    персональные данные третьим лицам, за исключением случаев, прямо предусмотренных законом,
                    а также привлечения процессоров (хостинг, доставка push-уведомлений, аналитика), которые
                    обрабатывают данные исключительно по поручению Оператора и на условиях конфиденциальности.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">5. Срок хранения.</strong> Персональные данные хранятся в
                    течение всего срока использования приложения и в течение 3 (трёх) лет после удаления
                    учётной записи или отзыва согласия — для исполнения требований законодательства РФ
                    о бухгалтерском учёте и противодействии неправомерным действиям. По истечении срока
                    данные подлежат уничтожению либо обезличиванию.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">6. Cookies и аналогичные технологии.</strong> Принимая настоящее
                    Соглашение, Пользователь соглашается на использование файлов cookie, локального хранилища
                    и иных идентификаторов устройства, необходимых для аутентификации, поддержки сессии,
                    запоминания предпочтений и сбора обезличенной аналитики посещений.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">7. Права Пользователя как субъекта персональных данных.</strong>
                    Пользователь вправе: получать сведения об обработке своих данных; требовать уточнения,
                    блокирования или уничтожения данных, если они являются неполными, устаревшими, неточными,
                    незаконно полученными или не являются необходимыми для заявленной цели обработки;
                    отозвать согласие в любой момент; обжаловать действия Оператора в Роскомнадзоре или суде.
                    Запросы направляются по адресу <span className="text-[#4ec9c0]">info@techforum.ru</span>;
                    срок ответа — 10 рабочих дней.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">8. Безопасность.</strong> Оператор применяет организационные
                    и технические меры защиты персональных данных, в том числе шифрование канала (TLS),
                    хеширование паролей, разграничение доступа, журналирование действий, регулярное
                    резервное копирование и контроль уязвимостей.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">9. Ответственность Пользователя.</strong> Пользователь обязуется
                    не использовать приложение для размещения противоправного контента, оскорблений, спама,
                    рекламы без согласования, а также не предпринимать действий, направленных на нарушение
                    работы сервиса, обход систем безопасности и получение несанкционированного доступа
                    к данным других пользователей.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">10. Изменения соглашения.</strong> Оператор вправе вносить
                    изменения в настоящее Соглашение, публикуя новую редакцию в приложении. Продолжение
                    использования приложения после изменений означает согласие Пользователя с новой редакцией.
                  </p>

                  <p>
                    <strong className="text-[#d8f0ee]">11. Контакты оператора.</strong> ООО «Bubble Group»,
                    ответственный за обработку персональных данных: <span className="text-[#4ec9c0]">info@techforum.ru</span>.
                    По любым вопросам, связанным с реализацией прав субъекта персональных данных, Пользователь
                    может обратиться по указанному адресу. Оператор обязуется рассмотреть обращение в срок,
                    установленный действующим законодательством Российской Федерации.
                  </p>

                  <p className="text-[#7aa8a4] text-[11px]">
                    Принимая настоящее Соглашение, Пользователь подтверждает, что ознакомлен с его условиями,
                    согласен на обработку персональных данных в указанных целях и обладает дееспособностью,
                    необходимой для заключения настоящего Соглашения.
                  </p>
                </div>

                <div
                  className="absolute bottom-0 left-0 right-0 px-6 pt-3 bg-gradient-to-t from-[#03161c] via-[#03161c]/95 to-transparent"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
                >
                  <Button onClick={() => setShowSecurity(false)} variant="ghost">Закрыть</Button>
                </div>
              </div>
            </AppBackground>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
