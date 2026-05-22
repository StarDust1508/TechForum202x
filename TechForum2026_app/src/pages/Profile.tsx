import { useRef, useState, type ChangeEvent } from 'react';
import { User, Settings, Shield, LogOut, ChevronRight, X, Mail, Phone, Info, Check, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clearLocalSession, isLocalAuthFallbackEnabled, updateLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl, resolveAssetUrl } from '@/src/lib/runtimeEndpoint';
import BackButton from '@/src/components/BackButton';
import AppBackground from '@/src/components/AppBackground';

interface UserData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
  role?: string;
  avatar?: string;
}

interface ProfileProps {
  user: UserData;
}

export default function Profile({ user: initialUser }: ProfileProps) {
  const [user, setUser] = useState(initialUser);
  const [showEdit, setShowEdit] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    bio: user.bio || ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // BUG_FIX_CONTEXT: FormData с файлом — без явного Content-Type, чтобы браузер
  // сам выставил multipart/form-data с boundary. Если поставить вручную, boundary
  // не добавится и multer на бэке не распарсит.
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
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
      setUser((prev) => ({ ...prev, avatar: data.avatar }));
    } catch (err) {
      console.error('Avatar upload failed', err);
      setAvatarError(err instanceof Error ? err.message : 'upload_failed');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const avatarSrc = resolveAssetUrl(user.avatar);

  return (
    <div className="flex-1 pb-24 pt-12 px-5 space-y-8 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-4 text-center flex flex-col items-center">
        <div className="w-24 h-24 bg-accent/10 border-2 border-accent/30 rounded-[2.5rem] flex items-center justify-center text-3xl font-black text-accent shadow-xl shadow-accent/5 relative overflow-hidden group">
          {avatarSrc ? (
            <img
              src={avatarSrc}
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
        <div className="bg-[#111827]/40 backdrop-blur-md border border-card-border rounded-[2rem] p-6 space-y-6 shadow-xl circuit-border">
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

            <button
              onClick={() => setShowSecurity(true)}
              className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all group"
            >
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
            className="absolute inset-0 z-[100]"
          >
            <AppBackground>
              <div className="flex flex-col p-8 flex-1" style={{ minHeight: '100dvh' }}>
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
                  {/* Avatar block */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-24 h-24 bg-accent/10 border-2 border-accent/30 rounded-full flex items-center justify-center text-3xl font-black text-accent shadow-xl shadow-accent/5 relative overflow-hidden">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-accent/10 border border-accent/30 text-accent text-[11px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      {uploadingAvatar ? 'Загрузка...' : 'Изменить фото'}
                    </button>
                    {avatarError && (
                      <p className="text-[10px] text-red-400 font-medium">{avatarError}</p>
                    )}
                  </div>

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
              </div>
            </AppBackground>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security / User Agreement Modal */}
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
              <div className="flex flex-col p-8 flex-1" style={{ minHeight: '100dvh' }}>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black text-primary uppercase tracking-tighter">Соглашение</h2>
                  <button
                    onClick={() => setShowSecurity(false)}
                    className="w-10 h-10 bg-card border border-card-border rounded-xl flex items-center justify-center text-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide pb-24 space-y-4 text-[13px] leading-relaxed text-white/80">
                  <h3 className="text-sm font-black text-accent uppercase tracking-widest">
                    Пользовательское соглашение и согласие на обработку персональных данных
                  </h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Редакция от 2 мая 2026 г.</p>

                  <p>
                    Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения
                    между ООО «Bubble Group» (далее — «Оператор», ИНН/ОГРН указаны на сайте техфорум.рф,
                    адрес электронной почты оператора: <span className="text-accent">info@techforum.ru</span>)
                    и физическим лицом — пользователем мобильного приложения TechForum 2026 (далее — «Пользователь»),
                    в связи с использованием функций приложения и обработкой персональных данных в соответствии
                    с Федеральным законом № 152-ФЗ «О персональных данных».
                  </p>

                  <p>
                    <strong className="text-white">1. Предмет соглашения.</strong> Принимая настоящее Соглашение,
                    Пользователь даёт согласие на обработку Оператором его персональных данных в целях:
                    регистрации и аутентификации в приложении; организации участия в конференции TechForum 2026;
                    направления уведомлений и сервисных сообщений; обеспечения работы личного кабинета,
                    ленты, чата и иных функций приложения; формирования аналитики и улучшения сервиса.
                  </p>

                  <p>
                    <strong className="text-white">2. Перечень обрабатываемых персональных данных.</strong>
                    Оператор обрабатывает: фамилию, имя, отчество (при наличии); адрес электронной почты;
                    номер мобильного телефона; должность и место работы (при наличии, по желанию пользователя);
                    биографическую информацию, указанную Пользователем добровольно; фотографию профиля;
                    идентификаторы устройства, IP-адрес, технические сведения о сессии и журналы действий.
                  </p>

                  <p>
                    <strong className="text-white">3. Способы обработки.</strong> Обработка осуществляется
                    как с использованием средств автоматизации, так и без таковых: сбор, запись, систематизация,
                    накопление, хранение, уточнение, извлечение, использование, передача (предоставление,
                    доступ), обезличивание, блокирование, удаление и уничтожение персональных данных.
                  </p>

                  <p>
                    <strong className="text-white">4. Передача данных третьим лицам.</strong> Оператор не передаёт
                    персональные данные третьим лицам, за исключением случаев, прямо предусмотренных законом,
                    а также привлечения процессоров (хостинг, доставка push-уведомлений, аналитика), которые
                    обрабатывают данные исключительно по поручению Оператора и на условиях конфиденциальности.
                  </p>

                  <p>
                    <strong className="text-white">5. Срок хранения.</strong> Персональные данные хранятся в
                    течение всего срока использования приложения и в течение 3 (трёх) лет после удаления
                    учётной записи или отзыва согласия — для исполнения требований законодательства РФ
                    о бухгалтерском учёте и противодействии неправомерным действиям. По истечении срока
                    данные подлежат уничтожению либо обезличиванию.
                  </p>

                  <p>
                    <strong className="text-white">6. Cookies и аналогичные технологии.</strong> Принимая настоящее
                    Соглашение, Пользователь соглашается на использование файлов cookie, локального хранилища
                    и иных идентификаторов устройства, необходимых для аутентификации, поддержки сессии,
                    запоминания предпочтений и сбора обезличенной аналитики посещений.
                  </p>

                  <p>
                    <strong className="text-white">7. Права Пользователя как субъекта персональных данных.</strong>
                    Пользователь вправе: получать сведения об обработке своих данных; требовать уточнения,
                    блокирования или уничтожения данных, если они являются неполными, устаревшими, неточными,
                    незаконно полученными или не являются необходимыми для заявленной цели обработки;
                    отозвать согласие в любой момент; обжаловать действия Оператора в Роскомнадзоре или суде.
                    Запросы направляются по адресу <span className="text-accent">info@techforum.ru</span>;
                    срок ответа — 10 рабочих дней.
                  </p>

                  <p>
                    <strong className="text-white">8. Безопасность.</strong> Оператор применяет организационные
                    и технические меры защиты персональных данных, в том числе шифрование канала (TLS),
                    хеширование паролей, разграничение доступа, журналирование действий, регулярное
                    резервное копирование и контроль уязвимостей.
                  </p>

                  <p>
                    <strong className="text-white">9. Ответственность Пользователя.</strong> Пользователь обязуется
                    не использовать приложение для размещения противоправного контента, оскорблений, спама,
                    рекламы без согласования, а также не предпринимать действий, направленных на нарушение
                    работы сервиса, обход систем безопасности и получение несанкционированного доступа
                    к данным других пользователей.
                  </p>

                  <p>
                    <strong className="text-white">10. Изменения соглашения.</strong> Оператор вправе вносить
                    изменения в настоящее Соглашение, публикуя новую редакцию в приложении. Продолжение
                    использования приложения после изменений означает согласие Пользователя с новой редакцией.
                  </p>

                  <p>
                    <strong className="text-white">11. Контакты оператора.</strong> ООО «Bubble Group»,
                    ответственный за обработку персональных данных: <span className="text-accent">info@techforum.ru</span>.
                    По любым вопросам, связанным с реализацией прав субъекта персональных данных, Пользователь
                    может обратиться по указанному адресу. Оператор обязуется рассмотреть обращение в срок,
                    установленный действующим законодательством Российской Федерации.
                  </p>

                  <p className="text-white/50 text-[11px]">
                    Принимая настоящее Соглашение, Пользователь подтверждает, что ознакомлен с его условиями,
                    согласен на обработку персональных данных в указанных целях и обладает дееспособностью,
                    необходимой для заключения настоящего Соглашения.
                  </p>
                </div>

                <button
                  onClick={() => setShowSecurity(false)}
                  className="mt-auto bg-accent text-surface py-5 rounded-[2.5rem] font-black uppercase tracking-widest shadow-2xl shadow-accent/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  Закрыть
                </button>
              </div>
            </AppBackground>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
