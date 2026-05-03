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
      <div
        className="relative px-6"
        style={{
          minHeight: '100lvh',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 36px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
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

        {/* На Auth год не анимируем: каждый возврат с register→login дёргал
            blur-flash. Сильную анимацию оставляем только на Splash. */}
        <BrandTitle animateYear={false} />

        <div className="mt-5 flex justify-center">
          <EventBadge />
        </div>

        {/* Слот заголовка фиксированной высоты — иначе AnimatePresence на h2
            даёт скачок при смене режима. */}
        <div className="relative mt-8 mb-5 h-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h2
              key={`title-${mode}`}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0 font-display-cyrl text-[28px] font-semibold text-[#d8f0ee] tracking-wide"
            >
              {mode === 'login' ? 'Войти' : 'Регистрация'}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* Слот формы фиксированной мин-высоты — переход login(2 поля)→register(3)
            не дёргает кнопку CTA. */}
        <div className="relative" style={{ minHeight: 248 }}>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'register' ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'register' ? -24 : 24 }}
                transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-3.5"
              >
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
              </motion.div>
            </AnimatePresence>

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    // BACKEND_TODO: эндпоинт POST /auth/forgot-password (email→reset-link).
                    // Пока стаб-toast вместо неправильного редиректа на регистрацию.
                    toast.show('Восстановление пароля скоро будет доступно. Свяжитесь с организаторами.', 3200);
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

        <p
          className="pointer-events-none absolute bottom-6 right-6 max-w-[220px] text-right font-display-cyrl text-[11px] uppercase tracking-[0.18em] text-[#4ec9c0]/55 leading-relaxed whitespace-pre-line"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {sectionTagline}
        </p>
      </div>

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
