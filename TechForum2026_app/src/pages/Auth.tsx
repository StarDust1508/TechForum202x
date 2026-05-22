import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Lock, ArrowRight, Loader2, User as UserIcon, Fingerprint, X as XIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
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

  const [form, setForm] = useState({ email: '', phone: '', password: '', name: '' });
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
  // BUG_FIX_CONTEXT: По требованию заказчика — шрифты крупнее и читаемее.
  // Минимальный размер input на мобильном — 17px (iOS не зумит при focus
  // только при ≥16px, но 17px даёт больший визуальный вес для брендового
  // GOST-серифа). Все ярлыки и табы — 16px font-semibold через GOST Type A.
  const labelClass = 'text-[16px] font-semibold tracking-[0.01em] text-white/80 font-blueprint';
  const inputClass = 'w-full bg-white/[0.05] border border-white/12 rounded-2xl py-4 pl-12 pr-4 text-[17px] font-medium text-white placeholder:text-white/30 focus:border-[#00ffff]/60 focus:bg-white/[0.08] outline-none transition-all font-blueprint';
  const iconClass  = 'absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/45';

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
        className="relative z-10 flex flex-col justify-center px-7"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        {/* TechForum 2026 — выделенный заголовок (единый бренд во всём приложении).
            BUG_FIX_CONTEXT: По требованию заказчика подзаголовок
            "Конференция технологий · 15–16 мая" удалён. Дата перенесена в data.ts
            (DAYS) — она едина во всём приложении. */}
        <div className="text-center mb-8">
          <h1 className="font-blueprint text-[46px] leading-[0.95] font-bold tracking-[0.06em] text-[#b0ffff] drop-shadow-[0_8px_28px_rgba(0,255,255,0.55)]">
            TechForum
            <span className="block mt-1">2026</span>
          </h1>
        </div>

        {/* Тонкий переключатель login / register с плавной motion-индикацией.
            BUG_FIX_CONTEXT: Раньше был layout + одновременный inline style.left —
            двойная анимация дёргала бегунок. Теперь чисто motion.animate{left}. */}
        <div className="relative flex bg-white/[0.04] border border-white/10 p-1 rounded-2xl mb-6">
          <motion.span
            initial={false}
            animate={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.6 }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-[#00ffff]/15 border border-[#00ffff]/40"
          />
          {(['login','register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={cn(
                'relative flex-1 py-3 text-[16px] font-semibold rounded-xl transition-colors z-10 font-blueprint',
                mode === m ? 'text-[#b0ffff]' : 'text-white/55'
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
                'flex-1 py-2.5 text-[16px] font-semibold rounded-xl transition-all font-blueprint',
                method === m ? 'bg-white/[0.06] text-[#b0ffff]' : 'text-white/55'
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
              <input
                type={method === 'email' ? 'email' : 'tel'}
                required
                value={method === 'email' ? form.email : form.phone}
                onChange={(e) => setForm({ ...form, [method]: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Пароль</label>
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
                className="text-[15px] font-semibold text-rose-300 text-center font-blueprint"
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
                className="mt-1 w-[18px] h-[18px] accent-[#00ffff] rounded"
              />
              <span className="text-[14px] leading-snug text-white/70 font-blueprint">
                Я согласен на обработку персональных данных в соответствии с 152-ФЗ.
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && !consent)}
            className="w-full bg-gradient-to-r from-[#00ffff] to-[#ff3399] text-[#0a0e17] py-4 rounded-2xl text-[17px] font-bold tracking-[0.02em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(0,255,255,0.25)] mt-6 font-blueprint"
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
            className="fixed inset-0 z-50 flex items-center justify-center px-7 bg-[#0a0e17]/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-[380px] bg-[#0d1520] border border-white/10 rounded-3xl p-7 shadow-[0_24px_60px_rgba(0,255,255,0.18)]"
            >
              <button
                type="button"
                onClick={() => {
                  if (bioBusy) return;
                  setShowBioOffer(false);
                  if (pendingUser) onSuccess(pendingUser);
                }}
                aria-label="Закрыть"
                className="absolute right-5 top-5 w-9 h-9 flex items-center justify-center rounded-full text-white/55 hover:text-white/85 hover:bg-white/[0.06] transition-colors"
              >
                <XIcon className="w-[18px] h-[18px]" />
              </button>

              <div className="flex flex-col items-center text-center pt-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00ffff]/20 to-[#00cccc]/10 border border-[#00ffff]/40 flex items-center justify-center mb-5 shadow-[0_8px_28px_rgba(0,255,255,0.25)]">
                  <Fingerprint className="w-8 h-8 text-[#00ffff]" />
                </div>
                <h2 className="font-blueprint text-[26px] leading-tight font-bold text-[#b0ffff] mb-2">
                  Включить вход<br />по биометрии?
                </h2>
                <p className="text-[15px] leading-relaxed text-white/65 font-blueprint mb-6">
                  Открывайте TechForum за секунду без ввода пароля — Face ID, отпечаток или PIN телефона.
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
                  className="w-full bg-gradient-to-r from-[#00ffff] to-[#ff3399] text-[#0a0e17] py-4 rounded-2xl text-[17px] font-bold tracking-[0.02em] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(0,255,255,0.25)] font-blueprint"
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
                  className="mt-3 w-full text-[15px] font-semibold text-white/55 hover:text-white/85 transition-colors py-3 font-blueprint"
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
