import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Lock, ArrowRight, Loader2, User as UserIcon, Fingerprint, X as XIcon, KeyRound } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl, saveSessionToken, authFetch } from '@/src/lib/runtimeEndpoint';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric } from '@/src/lib/biometric';

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // BUG_FIX_CONTEXT: focus-стейт для тонкой анимации backdrop'а — при фокусе
  // на input приглушаем blueprint и слегка увеличиваем масштаб, чтобы
  // создать ощущение "фокус на форме". Не блокирует interactivity.
  const [focused, setFocused] = useState(false);

  const [form, setForm] = useState({ email: '', phone: '+7', password: '', name: '' });
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  // BUG_FIX_CONTEXT: По требованию 152-ФЗ при регистрации нужно явное
  // согласие на обработку ПД. На login-моде чекбокс не нужен.
  const [consent, setConsent] = useState(false);

  // BUG_FIX_CONTEXT: Биометрия — после успешного login/register предлагаем
  // включить, если (1) сенсор доступен, (2) биометрия ещё не включена.
  // Реальное предложение — отдельный мини-экран после onSuccess (см. ниже),
  // здесь только кэшируем availability.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [showBioOffer, setShowBioOffer] = useState(false);
  const [pendingUser, setPendingUser] = useState<unknown | null>(null);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const ok = await isBiometricAvailable();
      if (mounted) setBioAvailable(ok);
    })();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpointPath = mode === 'login' ? '/auth/login' : '/auth/register';
    const endpoint = resolveApiUrl(endpointPath);
    const identifier = method === 'email' ? form.email : form.phone;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: identifier, password: form.password, name: form.name }),
      });
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      const data = ct.includes('application/json') ? await res.json() : null;
      if (!ct.includes('application/json')) throw new Error('backend_invalid_response');
      if (!res.ok) throw new Error(data?.error || 'Ошибка входа');
      if (!data || typeof data !== 'object') throw new Error('backend_invalid_response');
      if (data.token) saveSessionToken(data.token);
      // BUG_FIX_CONTEXT: Если биометрия доступна и ещё не включена —
      // НЕ переходим в App мгновенно. Показываем оффер. После выбора
      // (включить / "не сейчас") — onSuccess.
      if (bioAvailable && !isBiometricEnabled() && method === 'email') {
        setPendingUser(data);
        setPendingCreds({ email: identifier, password: form.password });
        setShowBioOffer(true);
        setLoading(false);
        return;
      }
      onSuccess(data);
    } catch (err: any) {
      const rawMessage = String(err?.message || '');
      const isNetworkError = /failed to fetch|networkerror|fetch|backend_invalid_response|unexpected token|load failed|cors|typeerror/i.test(rawMessage);
      if (!isLocalAuthFallbackEnabled()) {
        // BUG_FIX_CONTEXT: Раньше сообщение было общее «Нет соединения», но
        // у нас 5 разных причин (VPN, mixed-content, CORS, DNS, backend down).
        // Дописываем технический rawMessage в скобках — юзер видит «Нет
        // соединения [Failed to fetch]» и я по скрину могу определить точную
        // причину, не возвращаясь к нему за logs.
        setError(isNetworkError
          ? `Нет соединения с сервером. [${rawMessage.slice(0, 80)}] Проверьте интернет / выключите VPN.`
          : (rawMessage || 'Ошибка входа'));
        setLoading(false);
        return;
      }
      try {
        const user = mode === 'register'
          ? await registerLocalUser({ name: form.name, identifier, password: form.password, method })
          : await loginLocalUser({ identifier, password: form.password });
        onSuccess(user);
      } catch (fb: any) {
        const msg = String(fb?.message || '');
        const friendly =
          /invalid_credentials|wrong[_ ]?password|user[_ ]?not[_ ]?found|неверные/i.test(msg) ? 'Неверный логин или пароль'
          : /already[_ ]?exists|duplicate|уже существует/i.test(msg) ? 'Пользователь с такими данными уже зарегистрирован'
          : /password.*(short|weak|min)|укажите пароль/i.test(msg) ? 'Пароль слишком короткий — минимум 6 символов'
          : /укажите/i.test(msg) ? msg
          : isNetworkError ? 'Нет соединения. Попробуйте ещё раз через минуту.'
          : (msg || 'Не удалось выполнить вход');
        setError(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  // Унифицированные стили формы.
  // Минимальный размер input на мобильном — 17px (iOS не зумит при focus
  // только при ≥16px). Все ярлыки и табы — 16px font-semibold, Inter (default body font).
  // Headings use font-display (Unbounded). Primary color = magenta via CSS var.
  const labelClass = 'text-[16px] font-semibold tracking-[0.01em] text-foreground/80';
  const inputClass = 'w-full bg-white/[0.05] border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-[17px] font-medium text-foreground placeholder:text-foreground/30 focus:border-primary/60 focus:bg-white/[0.08] outline-none transition-all';
  const iconClass  = 'absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-foreground/45';

  // BUG_FIX_CONTEXT: focus-handlers навешиваются на каждый input через
  // spread {...inputFocusProps}. Toggle CSS-класса на body чтобы body::before
  // (глобальный blueprint) получил приглушение при focus — единый эффект
  // для любых форм в приложении.
  const inputFocusProps = {
    onFocus: () => { setFocused(true); document.body.classList.add('bp-focused'); },
    onBlur: () => { setFocused(false); document.body.classList.remove('bp-focused'); },
  };
  // Cleanup на unmount чтобы класс не остался если юзер перешёл на другой экран
  // во время фокуса.
  useEffect(() => {
    return () => { document.body.classList.remove('bp-focused'); };
  }, []);

  return (
    // BUG_FIX_CONTEXT: Свой backdrop из Auth убран — теперь полагается на
    // глобальный body::before (см. index.css). Один источник blueprint для
    // всех экранов, никаких расхождений между Auth/Home/etc. focus-эффект
    // переехал на CSS-класс `auth-focused-on-body` который body получает
    // когда любой input в фокусе — body::before меняет blur/opacity.
    <div
      className="relative"
      style={{ minHeight: '100lvh' }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/hero-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1118] via-[#0f1118]/80 to-[#0f1118]/40" />
      <div
        className="relative z-10 flex flex-col justify-center px-7"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          className="text-center mb-10 pt-2"
        >
          <motion.h1
            className="font-display font-extrabold"
            style={{
              fontSize: 'clamp(28px, 9vw, 44px)',
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 40%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(255,51,153,0.5)) drop-shadow(0 0 40px rgba(255,51,153,0.2))',
            }}
            initial={{ letterSpacing: '0.08em' }}
            animate={{ letterSpacing: '0.03em' }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          >
            ТехнологИИ Права
          </motion.h1>
          <motion.p
            className="mt-3 text-[13px] uppercase tracking-[0.3em] text-accent font-semibold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{ textShadow: '0 0 12px rgba(0,255,255,0.4)' }}
          >
            25–26 сентября · Москва
          </motion.p>
        </motion.div>

        {/* Тонкий переключатель login / register с плавной motion-индикацией.
            BUG_FIX_CONTEXT: Раньше был layout + одновременный inline style.left —
            двойная анимация дёргала бегунок. Теперь чисто motion.animate{left}. */}
        <div className="relative flex bg-white/[0.04] border border-white/10 p-1 rounded-2xl mb-6">
          <motion.span
            initial={false}
            animate={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-primary/15 border border-primary/40"
          />
          {(['login','register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={cn(
                'relative flex-1 py-3 text-[16px] font-semibold rounded-xl transition-colors z-10',
                mode === m ? 'text-primary' : 'text-foreground/55'
              )}
            >
              {m === 'login' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        {/* Email / телефон — мини-таб */}
        <div className="flex bg-white/[0.04] border border-white/10 p-1 rounded-2xl mb-6">
          {(['email','phone'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={cn(
                'flex-1 py-2.5 text-[16px] font-semibold rounded-xl transition-all',
                method === m ? 'bg-white/[0.06] text-primary' : 'text-foreground/55'
              )}
            >
              {m === 'email' ? 'Email' : 'Телефон'}
            </button>
          ))}
        </div>

        {/* Форма с плавным переходом login ↔ register.
            BUG_FIX_CONTEXT: РАНЬШЕ всю форму оборачивали в AnimatePresence с
            key={mode} — Email и Пароль перерендеривались при каждом
            переключении и дублировались на время exit-фазы (визуальный
            "мусор", двойные поля). Юзер описал это как "панель летает".
            ТЕПЕРЬ Email и Пароль постоянны в DOM, анимируется ТОЛЬКО
            поле «Имя» через AnimatePresence + height/opacity. motion.form
            layout сам сглаживает изменение высоты, submit не прыгает. */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className={labelClass}>Имя</label>
                <div className="relative">
                  <UserIcon className={iconClass} />
                  <input
                    type="text"
                    required={mode === 'register'}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    {...inputFocusProps}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className={labelClass}>{method === 'email' ? 'Email' : 'Телефон'}</label>
            <div className="relative">
              {method === 'email' ? <Mail className={iconClass} /> : <Phone className={iconClass} />}
              {method === 'email' ? (
                <input
                  type="email"
                  required
                  placeholder=""
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <input
                  type="tel"
                  required
                  placeholder="+7 (___) ___-__-__"
                  value={form.phone}
                  onChange={(e) => {
                    let v = e.target.value.replace(/[^\d+]/g, '');
                    if (!v.startsWith('+7')) v = '+7' + v.replace(/^\+?7?/, '');
                    if (v.length > 12) v = v.slice(0, 12);
                    setForm({ ...form, phone: v });
                  }}
                  className={inputClass}
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className={labelClass}>Пароль</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(form.email); setForgotSent(false); setForgotError(''); }}
                  className="text-[13px] text-accent/70 hover:text-accent font-medium transition-colors"
                >
                  Забыли пароль?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-[15px] font-semibold text-rose-300 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {mode === 'register' && (
            <label className="flex items-start gap-3 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-[18px] h-[18px] accent-primary rounded"
              />
              <span className="text-[14px] leading-snug text-foreground/70">
                Я согласен на обработку персональных данных в соответствии с 152-ФЗ.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && !consent)}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl text-[17px] font-bold tracking-[0.02em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(var(--primary-rgb),0.25)] mt-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</span>
                <ArrowRight className="w-[18px] h-[18px]" />
              </>
            )}
          </button>
        </form>
        {/* BUG_FIX_CONTEXT: По требованию заказчика удалена нижняя ссылка
            "Нет аккаунта? Зарегистрироваться / Уже есть аккаунт? Войти".
            Переключение режима остаётся через таб-бегунок выше. */}
      </div>

      {/* Забыли пароль — модалка */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-7 bg-background/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-[380px] bg-background border border-white/10 rounded-3xl p-7 shadow-[0_24px_60px_rgba(0,255,255,0.12)] relative"
            >
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                aria-label="Закрыть"
                className="absolute right-4 top-4 w-9 h-9 flex items-center justify-center rounded-full text-foreground/55 hover:text-foreground/85 hover:bg-white/[0.06] transition-colors"
              >
                <XIcon className="w-[18px] h-[18px]" />
              </button>

              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/40 flex items-center justify-center mb-5">
                  <KeyRound className="w-7 h-7 text-accent" />
                </div>
                <h2 className="font-display text-[22px] leading-tight font-bold text-foreground mb-2">
                  Восстановление пароля
                </h2>

                {forgotSent ? (
                  <div className="space-y-4 mt-2">
                    <p className="text-[14px] leading-relaxed text-foreground/65">
                      Инструкция отправлена на <span className="text-accent font-semibold">{forgotEmail}</span>. Проверьте почту и следуйте указаниям.
                    </p>
                    <p className="text-[13px] text-foreground/45">
                      Не пришло? Напишите нам в Telegram:
                    </p>
                    <a
                      href="https://t.me/NeuroPravo_Bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent/10 border border-accent/30 text-accent rounded-xl text-[13px] font-semibold hover:bg-accent/15 transition-colors"
                    >
                      @NeuroPravo_Bot
                    </a>
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="w-full mt-2 text-[15px] font-semibold text-foreground/55 hover:text-foreground/85 transition-colors py-3"
                    >
                      Закрыть
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 mt-2 w-full">
                    <p className="text-[14px] leading-relaxed text-foreground/65">
                      Введите email, на который зарегистрирован аккаунт. Мы отправим ссылку для сброса пароля.
                    </p>
                    <input
                      type="email"
                      placeholder=""
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={inputClass}
                    />
                    {forgotError && (
                      <p className="text-[13px] font-semibold text-rose-300 text-center">{forgotError}</p>
                    )}
                    <button
                      type="button"
                      disabled={forgotLoading || !forgotEmail.trim()}
                      onClick={async () => {
                        setForgotLoading(true);
                        setForgotError('');
                        try {
                          const res = await fetch(resolveApiUrl('/auth/forgot-password'), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: forgotEmail.trim() }),
                          });
                          if (res.ok) {
                            setForgotSent(true);
                          } else {
                            const data = await res.json().catch(() => null);
                            setForgotError(data?.error === 'user_not_found' ? 'Пользователь с таким email не найден' : 'Ошибка. Попробуйте позже.');
                          }
                        } catch {
                          setForgotError('Нет соединения с сервером');
                        } finally {
                          setForgotLoading(false);
                        }
                      }}
                      className="w-full bg-primary text-primary-foreground py-4 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(255,51,153,0.2)]"
                    >
                      {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Отправить'}
                    </button>
                    <div className="text-center">
                      <p className="text-[12px] text-foreground/40 mb-2">Или свяжитесь с поддержкой:</p>
                      <div className="flex justify-center gap-3">
                        <a href="https://t.me/NeuroPravo_Bot" target="_blank" rel="noopener noreferrer"
                          className="text-[12px] text-accent/70 hover:text-accent font-medium">
                          @NeuroPravo_Bot
                        </a>
                        <span className="text-foreground/20">·</span>
                        <a href="mailto:pravotechhub@mail.ru"
                          className="text-[12px] text-accent/70 hover:text-accent font-medium">
                          pravotechhub@mail.ru
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Биометрический оффер. Появляется ПОВЕРХ Auth поверх blueprint-фона
          сразу после успешного login/register, если: (a) сенсор есть,
          (b) биометрия ещё не включена, (c) метод входа email (при phone
          credentials/password в этой версии не валидируются на сервере). */}
      <AnimatePresence>
        {showBioOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-7 bg-background/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-[380px] bg-background border border-white/10 rounded-3xl p-7 shadow-[0_24px_60px_rgba(var(--primary-rgb),0.18)]"
            >
              <button
                type="button"
                onClick={() => {
                  if (bioBusy) return;
                  setShowBioOffer(false);
                  if (pendingUser) onSuccess(pendingUser);
                }}
                aria-label="Закрыть"
                className="absolute right-5 top-5 w-9 h-9 flex items-center justify-center rounded-full text-foreground/55 hover:text-foreground/85 hover:bg-white/[0.06] transition-colors"
              >
                <XIcon className="w-[18px] h-[18px]" />
              </button>

              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/40 flex items-center justify-center mb-5 shadow-[0_8px_28px_rgba(var(--primary-rgb),0.25)]">
                  <Fingerprint className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-display text-[26px] leading-tight font-bold text-primary mb-2">
                  Включить вход<br />по биометрии?
                </h2>
                <p className="text-[15px] leading-relaxed text-foreground/65 mb-6">
                  Открывайте ТехнологИИ Права за секунду без ввода пароля — Face ID, отпечаток или PIN телефона.
                </p>

                <button
                  type="button"
                  disabled={bioBusy}
                  onClick={async () => {
                    if (!pendingCreds || !pendingUser) return;
                    setBioBusy(true);
                    setError('');
                    try {
                      await enableBiometric(pendingCreds.email, pendingCreds.password);
                      setShowBioOffer(false);
                      onSuccess(pendingUser);
                    } catch (e: unknown) {
                      // Юзер отменил BiometricPrompt или ОС вернула ошибку.
                      // Не блокируем вход — закрываем оффер и просто пускаем
                      // в App. Можно будет включить позже из Профиля.
                      setShowBioOffer(false);
                      onSuccess(pendingUser);
                    } finally {
                      setBioBusy(false);
                    }
                  }}
                  className="w-full bg-primary text-primary-foreground py-4 rounded-2xl text-[17px] font-bold tracking-[0.02em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(var(--primary-rgb),0.25)]"
                >
                  {bioBusy ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Fingerprint className="w-[18px] h-[18px]" />
                      <span>Включить</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={bioBusy}
                  onClick={() => {
                    setShowBioOffer(false);
                    if (pendingUser) onSuccess(pendingUser);
                  }}
                  className="mt-3 w-full text-[15px] font-semibold text-foreground/55 hover:text-foreground/85 transition-colors py-3"
                >
                  Не сейчас
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
