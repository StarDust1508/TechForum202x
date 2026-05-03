import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Fingerprint, X as XIcon } from 'lucide-react';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric } from '@/src/lib/biometric';
import AppBackground from '@/src/components/AppBackground';
import BrandTitle from '@/src/components/ui/BrandTitle';
import EventBadge from '@/src/components/ui/EventBadge';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';
import { useToast } from '@/src/components/Toast';

interface AuthProps {
  onSuccess: (user: any) => void;
}

type Mode = 'login' | 'register';

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setModeRaw] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // BACKEND_DIAG: видимая в UI диагностика для cleartext-debug. Удалить вместе
  // с TEST/probe-плашками сверху, как только подтвердится стабильность сети.
  const [debugInfo, setDebugInfo] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState('');
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '' });
  const [consent, setConsent] = useState(false);
  const toast = useToast();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [showBioOffer, setShowBioOffer] = useState(false);
  const [pendingUser, setPendingUser] = useState<unknown | null>(null);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const [bioBusy, setBioBusy] = useState(false);

  // Forgot-password 2-step flow.
  // Шаг 1: ввести email, бэк создаёт reset-token и (пока stub) пишет в server log.
  // Шаг 2: ввести token, который выдадут организаторы вручную, + новый пароль.
  // Когда подключим SMTP — токен будет приходить на email автоматически.
  type ForgotStep = null | 'start' | 'verify';
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPwd, setForgotNewPwd] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);

  const handleForgotStart = async () => {
    if (!forgotEmail.trim()) {
      toast.show('Введите email');
      return;
    }
    setForgotBusy(true);
    try {
      const r = await fetch(resolveApiUrl('/auth/forgot-password/start'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      if (r.ok) {
        toast.show('Запрос отправлен. Свяжитесь с организаторами для получения кода восстановления.', 4200);
        setForgotStep('verify');
      } else if (r.status === 429) {
        toast.show('Слишком много попыток. Попробуйте позже.');
      } else {
        toast.show('Ошибка запроса');
      }
    } catch {
      toast.show('Нет соединения с сервером');
    } finally {
      setForgotBusy(false);
    }
  };

  const handleForgotVerify = async () => {
    if (forgotToken.trim().length < 8) { toast.show('Введите код полностью'); return; }
    if (forgotNewPwd.length < 6) { toast.show('Пароль минимум 6 символов'); return; }
    setForgotBusy(true);
    try {
      const r = await fetch(resolveApiUrl('/auth/forgot-password/verify'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: forgotToken.trim(), newPassword: forgotNewPwd }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok) {
        toast.show('Пароль изменён. Теперь войдите с новым паролем.', 3500);
        setForgotStep(null);
        setForgotToken(''); setForgotNewPwd('');
        setForm({ ...form, email: forgotEmail, password: forgotNewPwd });
      } else if (data?.error === 'invalid_token') {
        toast.show('Неверный код');
      } else if (data?.error === 'token_expired') {
        toast.show('Код истёк, начните заново');
        setForgotStep('start');
      } else if (data?.error === 'too_many_attempts') {
        toast.show('Превышено число попыток');
        setForgotStep(null);
      } else {
        toast.show('Не удалось сменить пароль');
      }
    } catch {
      toast.show('Нет соединения с сервером');
    } finally {
      setForgotBusy(false);
    }
  };

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  // Переключение режима пишет history-entry, чтобы системный back/swipe-back
  // на Android возвращал юзера с регистрации на логин, а не закрывал app.
  const setMode = useCallback((next: Mode) => {
    setModeRaw((prev) => {
      if (prev === next) return prev;
      if (next === 'register') {
        try { window.history.pushState({ authMode: 'register' }, ''); } catch { /* noop */ }
      } else if (prev === 'register') {
        try { if (window.history.state?.authMode === 'register') window.history.back(); } catch { /* noop */ }
      }
      setError('');
      return next;
    });
  }, []);

  useEffect(() => {
    const onPop = () => { setModeRaw('login'); setError(''); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Автофокус первого поля при монтировании / переключении режима.
  useEffect(() => {
    const t = setTimeout(() => emailRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [mode]);

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
    setError('');
    setDebugInfo('');
    if (mode === 'register' && form.password !== form.passwordConfirm) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);

    const endpointPath = mode === 'login' ? '/auth/login' : '/auth/register';
    const endpoint = resolveApiUrl(endpointPath);

    let httpStatus: number | null = null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.email.split('@')[0],
        }),
      });
      httpStatus = res.status;
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      const data = ct.includes('application/json') ? await res.json() : null;
      if (!ct.includes('application/json')) throw new Error('backend_invalid_response');
      if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
      if (!data || typeof data !== 'object') throw new Error('backend_invalid_response');
      if (bioAvailable && !isBiometricEnabled()) {
        setPendingUser(data);
        setPendingCreds({ email: form.email, password: form.password });
        setShowBioOffer(true);
        setLoading(false);
        return;
      }
      onSuccess(data);
    } catch (err: any) {
      const rawMessage = String(err?.message || '');
      const isNetworkError = /failed to fetch|networkerror|fetch|backend_invalid_response|unexpected token|load failed|cors|typeerror/i.test(rawMessage);
      const debugLine = `${endpoint} → ${httpStatus ?? 'no-response'} | ${rawMessage.slice(0, 120)}`;
      if (!isLocalAuthFallbackEnabled()) {
        setError(isNetworkError ? 'Нет соединения с сервером. Проверьте интернет.' : (rawMessage || 'Ошибка входа'));
        setDebugInfo(debugLine);
        setLoading(false);
        return;
      }
      try {
        const user = mode === 'register'
          ? await registerLocalUser({ name: form.email.split('@')[0], identifier: form.email, password: form.password, method: 'email' })
          : await loginLocalUser({ identifier: form.email, password: form.password });
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
        setDebugInfo(`${debugLine} | local: ${msg.slice(0, 80)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const runConnectivityProbe = async () => {
    setProbing(true);
    setProbeResult('');
    const base = resolveApiUrl('/health');
    try {
      const t0 = Date.now();
      const res = await fetch(base, { method: 'GET' });
      const dt = Date.now() - t0;
      const txt = await res.text();
      setProbeResult(`OK ${res.status} (${dt}ms): ${txt.slice(0, 100)}`);
    } catch (err: any) {
      setProbeResult(`FAIL: ${String(err?.message || err).slice(0, 160)} | URL: ${base}`);
    } finally {
      setProbing(false);
    }
  };

  const sectionTagline = mode === 'login'
    ? 'ТЕХНОЛОГИИ СОЗДАЮТ БУДУЩЕЕ.\nБУДУЩЕЕ СОЗДАЁТ ВОЗМОЖНОСТИ.'
    : 'ИННОВАЦИИ.\nТЕХНОЛОГИИ.\nБУДУЩЕЕ.';

  return (
    <AppBackground>
      {/*
        Раньше внешний div был flex flex-1 + spacer — при появлении клавиатуры
        он пересчитывался и пампил контент. Сейчас фикс-высота 100lvh + слоты
        фиксированной высоты под title и форму, tagline absolute.
      */}
      {/* Без minHeight: 100lvh — позволяем странице расти по контенту, чтобы
          родительский scroll-контейнер (App.tsx) корректно прокручивал на
          маленьких экранах. Раньше при появлении клавиатуры контент
          переворачивался и tagline уезжал за границу. */}
      <div
        className="relative px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        }}
      >
        {/* DIAG-плашки скрыты в production — видны только в dev (npm run dev). */}
        {import.meta.env.DEV && (
          <>
            <div className="absolute top-2 right-2 z-50 select-text font-mono text-[10px] text-[#7aa8a4] bg-[#03161c]/80 px-2 py-1 rounded border border-[#4ec9c0]/20">
              build nsc-debug-fix · diag
            </div>
            <div className="absolute top-2 left-2 z-50 flex flex-col gap-1 max-w-[60vw]">
              <button
                type="button"
                onClick={runConnectivityProbe}
                disabled={probing}
                className="text-[10px] font-mono px-2 py-1 rounded border border-[#4ec9c0]/40 text-[#d8f0ee] bg-[#03161c]/80 active:bg-[#4ec9c0]/15 disabled:opacity-50"
              >
                {probing ? '…' : 'TEST /health'}
              </button>
              {probeResult && (
                <p className="text-[10px] leading-tight font-mono text-[#d8f0ee]/90 break-all bg-[#03161c]/85 px-2 py-1 rounded border border-[#4ec9c0]/20 select-text">
                  {probeResult}
                </p>
              )}
            </div>
          </>
        )}

        {/* На Auth год не анимируем: каждый key-change компонента триггерил
            blur-reveal по цифрам — юзер воспринимает это как "шрифт меняется
            на ходу". compact чтобы не съедать половину экрана. */}
        <BrandTitle animateYear={false} compact />

        <div className="mt-3 flex justify-center">
          <EventBadge />
        </div>

        {/* Заголовок — без motion-анимаций. Раньше slide+blur при key-change
            юзер воспринимал как «шрифт меняется на ходу». */}
        <h2 className="mt-6 mb-4 font-display-cyrl text-[28px] font-semibold text-[#d8f0ee] tracking-wide">
          {mode === 'login' ? 'Войти' : 'Регистрация'}
        </h2>

        {/* Форма — без AnimatePresence. Третье поле (passwordConfirm) просто
            рендерится условно. minHeight гарантирует что CTA не прыгает. */}
        <div className="relative" style={{ minHeight: 248 }}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-3.5">
                <Input
                  ref={emailRef}
                  icon={Mail}
                  type="email"
                  placeholder="@mail или телефон"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); } }}
                />
                <Input
                  ref={passwordRef}
                  icon={Lock}
                  type="password"
                  placeholder={mode === 'register' ? 'Придумайте пароль' : 'Пароль'}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  toggleablePassword
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (mode === 'register') { e.preventDefault(); passwordConfirmRef.current?.focus(); }
                    }
                  }}
                />
                {mode === 'register' && (
                  <Input
                    ref={passwordConfirmRef}
                    icon={Lock}
                    type="password"
                    placeholder="Подтвердите пароль"
                    required
                    autoComplete="new-password"
                    toggleablePassword
                    value={form.passwordConfirm}
                    onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
                  />
                )}
              </div>

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(form.email);
                    setForgotStep('start');
                  }}
                  className="text-[14px] text-[#7aa8a4] hover:text-[#d8f0ee] font-blueprint"
                >
                  Забыли пароль?
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div className="pt-1">
                <Checkbox checked={consent} onChange={setConsent} id="consent">
                  Я согласен с политикой конфиденциальности
                </Checkbox>
              </div>
            )}

            <AnimatePresence>
              {error && (
                <motion.p
                  key={error}
                  initial={{ opacity: 0, y: -6, x: 0 }}
                  animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
                  className="text-[14px] font-semibold text-rose-300 text-center font-blueprint"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {import.meta.env.DEV && debugInfo && (
              <p className="text-[10px] leading-tight font-mono text-[#d8f0ee]/80 break-all bg-[#03161c]/70 border border-[#4ec9c0]/20 rounded p-2 select-text">
                {debugInfo}
              </p>
            )}

            <div className="pt-3">
              <Button type="submit" loading={loading} disabled={mode === 'register' && !consent}>
                {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-[13px] text-[#7aa8a4] hover:text-[#d8f0ee] font-blueprint tracking-wider uppercase"
          >
            {mode === 'login' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

        {/* Tagline в обычном flow (не absolute) — чтобы не перекрывал форму
            на маленьких экранах и корректно прокручивался вместе со всем. */}
        <p className="mt-10 mx-auto max-w-[260px] text-center font-display-cyrl text-[11px] uppercase tracking-[0.18em] text-[#4ec9c0]/55 leading-relaxed whitespace-pre-line">
          {sectionTagline}
        </p>
      </div>

      {/* Forgot-password modal — 2 шага. Бэк: POST /auth/forgot-password/start
          → создаёт токен (TTL 30мин); /verify {token, newPassword} меняет пароль.
          Пока SMTP не подключён, токен видят только организаторы в server log. */}
      <AnimatePresence>
        {forgotStep && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#03161c]/85 backdrop-blur-md"
            onClick={() => { if (!forgotBusy) setForgotStep(null); }}
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[380px] rounded-3xl border border-[#4ec9c0]/30 bg-[#052830]/95 p-6 shadow-[0_24px_60px_rgba(78,201,192,0.18)]"
            >
              <button
                type="button"
                onClick={() => setForgotStep(null)}
                disabled={forgotBusy}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border border-[#4ec9c0]/30 flex items-center justify-center text-[#7aa8a4] hover:text-[#d8f0ee] disabled:opacity-50"
                aria-label="Закрыть"
              >
                <XIcon className="w-4 h-4" />
              </button>

              {forgotStep === 'start' ? (
                <>
                  <h3 className="font-display-cyrl text-[20px] text-[#d8f0ee] mb-2">Восстановление пароля</h3>
                  <p className="text-[13px] text-[#7aa8a4] mb-5 leading-relaxed">
                    Введи email, на который регистрировался. Получишь код через организаторов — пока интеграция SMS/email в работе.
                  </p>
                  <Input
                    icon={Mail}
                    type="email"
                    inputMode="email"
                    placeholder="email@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                  <div className="pt-4">
                    <Button onClick={handleForgotStart} loading={forgotBusy}>Запросить код</Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotStep('verify')}
                    className="w-full mt-3 text-[12px] text-[#7aa8a4] hover:text-[#d8f0ee]"
                  >
                    У меня уже есть код →
                  </button>
                </>
              ) : (
                <>
                  <h3 className="font-display-cyrl text-[20px] text-[#d8f0ee] mb-2">Введи код</h3>
                  <p className="text-[13px] text-[#7aa8a4] mb-5 leading-relaxed">
                    Код выдают организаторы по запросу. Срок действия — 30 минут.
                  </p>
                  <div className="space-y-3">
                    <Input
                      icon={Lock}
                      type="text"
                      placeholder="Код восстановления"
                      value={forgotToken}
                      onChange={(e) => setForgotToken(e.target.value)}
                      autoFocus
                    />
                    <Input
                      icon={Lock}
                      type="password"
                      placeholder="Новый пароль (минимум 6)"
                      value={forgotNewPwd}
                      onChange={(e) => setForgotNewPwd(e.target.value)}
                      toggleablePassword
                    />
                  </div>
                  <div className="pt-4">
                    <Button onClick={handleForgotVerify} loading={forgotBusy}>Сменить пароль</Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotStep('start')}
                    className="w-full mt-3 text-[12px] text-[#7aa8a4] hover:text-[#d8f0ee]"
                  >
                    ← Запросить новый код
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBioOffer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-7 bg-[#03161c]/85 backdrop-blur-md"
          >
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="relative w-full max-w-[380px] rounded-3xl border border-[#4ec9c0]/30 bg-[#052830]/95 p-7 shadow-[0_24px_60px_rgba(78,201,192,0.18)]"
            >
              <button
                type="button"
                onClick={() => {
                  if (bioBusy) return;
                  setShowBioOffer(false);
                  if (pendingUser) onSuccess(pendingUser);
                }}
                aria-label="Закрыть"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#7aa8a4] hover:text-[#d8f0ee] hover:bg-white/[0.06] transition-colors"
              >
                <XIcon className="h-[18px] w-[18px]" />
              </button>

              <div className="flex flex-col items-center text-center pt-2">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#4ec9c0]/40 bg-[#0a2f38]/70 shadow-[0_8px_28px_rgba(78,201,192,0.25)]">
                  <Fingerprint className="h-8 w-8 text-[#4ec9c0]" strokeWidth={1.5} />
                </div>
                <h2 className="font-display-cyrl text-[24px] font-semibold text-[#d8f0ee] mb-2 leading-tight">
                  Включить вход<br />по биометрии?
                </h2>
                <p className="mb-6 text-[15px] leading-relaxed text-[#7aa8a4] font-blueprint">
                  Открывайте TechForum за секунду без ввода пароля — Face ID, отпечаток или PIN телефона.
                </p>

                <Button
                  type="button"
                  loading={bioBusy}
                  onClick={async () => {
                    if (!pendingCreds || !pendingUser) return;
                    setBioBusy(true);
                    try {
                      await enableBiometric(pendingCreds.email, pendingCreds.password);
                      setShowBioOffer(false);
                      onSuccess(pendingUser);
                    } catch {
                      setShowBioOffer(false);
                      onSuccess(pendingUser);
                    } finally {
                      setBioBusy(false);
                    }
                  }}
                >
                  <Fingerprint className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  <span>Включить</span>
                </Button>
                <button
                  type="button"
                  disabled={bioBusy}
                  onClick={() => {
                    setShowBioOffer(false);
                    if (pendingUser) onSuccess(pendingUser);
                  }}
                  className="mt-3 w-full py-3 text-[14px] font-semibold uppercase tracking-wider text-[#7aa8a4] hover:text-[#d8f0ee] transition-colors font-blueprint"
                >
                  Не сейчас
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppBackground>
  );
}
