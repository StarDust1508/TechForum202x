import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Loader2, Fingerprint, X as XIcon } from 'lucide-react';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { isBiometricAvailable, isBiometricEnabled, enableBiometric } from '@/src/lib/biometric';
import AppBackground from '@/src/components/AppBackground';
import BrandTitle from '@/src/components/ui/BrandTitle';
import EventBadge from '@/src/components/ui/EventBadge';
import Input from '@/src/components/ui/Input';
import Button from '@/src/components/ui/Button';
import Checkbox from '@/src/components/ui/Checkbox';

interface AuthProps {
  onSuccess: (user: any) => void;
}

type Mode = 'login' | 'register';

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState('');
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '', name: '' });
  const [consent, setConsent] = useState(false);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [showBioOffer, setShowBioOffer] = useState(false);
  const [pendingUser, setPendingUser] = useState<unknown | null>(null);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const [bioBusy, setBioBusy] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  // Автофокус на первое поле при монтировании / переключении режима
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
          name: form.name || form.email.split('@')[0],
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
      // Диагностика, видимая прямо в UI на устройстве — чтобы понять, что
      // реально происходит без adb/devtools. Удалим, когда стабилизируется.
      const debugLine = `${endpoint} → ${httpStatus ?? 'no-response'} | ${rawMessage.slice(0, 120)}`;
      if (!isLocalAuthFallbackEnabled()) {
        setError(isNetworkError ? 'Нет соединения с сервером. Проверьте интернет.' : (rawMessage || 'Ошибка входа'));
        setDebugInfo(debugLine);
        setLoading(false);
        return;
      }
      try {
        const user = mode === 'register'
          ? await registerLocalUser({ name: form.name || form.email.split('@')[0], identifier: form.email, password: form.password, method: 'email' })
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
      <div
        className="flex flex-1 flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 36px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        }}
      >
        {/* DIAG: версионный бейдж + всегда-видимая кнопка "Тест связи".
            Чтобы можно было удостовериться, что установлен именно этот APK,
            и проверить связь с сервером прямо со старта. Удалить после
            стабилизации. */}
        <div className="absolute top-2 right-2 z-50 select-text font-mono text-[10px] text-[#7aa8a4] bg-[#03161c]/80 px-2 py-1 rounded border border-[#4ec9c0]/20">
          build d180647 · diag
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

        <BrandTitle />

        <div className="mt-5 flex justify-center">
          <EventBadge />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.h2
            key={`title-${mode}`}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="mt-8 mb-5 font-display text-[28px] font-semibold text-[#d8f0ee] tracking-wide"
          >
            {mode === 'login' ? 'Войти' : 'Регистрация'}
          </motion.h2>
        </AnimatePresence>

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
                onClick={() => setMode('register')}
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

          {debugInfo && (
            <p className="text-[10px] leading-tight font-mono text-rose-200/70 break-all px-1 select-text">
              debug: {debugInfo}
            </p>
          )}

          <div className="pt-3">
            <Button type="submit" loading={loading} disabled={mode === 'register' && !consent}>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </div>

          {(error || debugInfo) && (
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={runConnectivityProbe}
                disabled={probing}
                className="w-full text-[12px] font-blueprint tracking-wider uppercase py-2 rounded-xl border border-[#4ec9c0]/40 text-[#d8f0ee] bg-[#4ec9c0]/5 active:bg-[#4ec9c0]/10 disabled:opacity-50"
              >
                {probing ? 'Проверка…' : 'Проверить связь с сервером'}
              </button>
              {probeResult && (
                <p className="text-[10px] leading-tight font-mono text-[#d8f0ee]/80 break-all px-1 select-text">
                  {probeResult}
                </p>
              )}
            </div>
          )}
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-[13px] text-[#7aa8a4] hover:text-[#d8f0ee] font-blueprint tracking-wider uppercase"
          >
            {mode === 'login' ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

        <div className="flex-1" />

        <p
          className="mt-8 max-w-[220px] self-end text-right font-display text-[11px] uppercase tracking-[0.18em] text-[#4ec9c0]/55 leading-relaxed whitespace-pre-line"
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
                <h2 className="font-display text-[24px] font-semibold text-[#d8f0ee] mb-2 leading-tight">
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
