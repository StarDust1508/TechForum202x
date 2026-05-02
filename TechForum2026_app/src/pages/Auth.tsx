import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, Lock, ArrowRight, Loader2, User as UserIcon } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { isLocalAuthFallbackEnabled, loginLocalUser, registerLocalUser } from '@/src/lib/localAuth';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ email: '', phone: '', password: '', name: '' });

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
      onSuccess(data);
    } catch (err: any) {
      const rawMessage = String(err?.message || '');
      const isNetworkError = /failed to fetch|networkerror|fetch|backend_invalid_response|unexpected token|load failed|cors|typeerror/i.test(rawMessage);
      if (!isLocalAuthFallbackEnabled()) {
        setError(isNetworkError ? 'Нет соединения с сервером. Проверьте интернет.' : (rawMessage || 'Ошибка входа'));
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
  // BUG_FIX_CONTEXT: По требованию заказчика "шрифт чуть больше и заметнее на всём
  // экране, кроме «Войти/Регистрация»": label поднят 12→14px и medium→semibold,
  // input поднят 15→16px и normal→medium. Кнопки таба и submit ('Войти'/'Регистрация'/
  // 'Создать аккаунт') не тронуты.
  const labelClass = 'text-[14px] font-semibold text-white/75';
  const inputClass = 'w-full bg-white/[0.04] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[16px] font-medium text-white placeholder:text-white/30 focus:border-[#5eead4]/60 focus:bg-white/[0.06] outline-none transition-all';
  const iconClass  = 'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40';

  return (
    // BUG_FIX_CONTEXT: На Samsung S25 / OnePlus 9R под формой была видна
    // чёрная пустая зона ~1/3 экрана: фон-постер не растягивался, потому что
    // Auth root имел только `flex-1 min-h-full` без явной высоты в условиях
    // когда родитель не задавал ему 100% (зависело от App.tsx flex-структуры).
    // Сейчас явно minHeight: 100dvh — постер всегда заполняет весь viewport.
    <div
      className="relative overflow-hidden bg-[#04020f]"
      style={{ minHeight: '100dvh' }}
    >
      <img
        src="/conference-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover scale-[1.25] opacity-85"
        style={{ objectPosition: 'center 42%', filter: 'blur(3px) saturate(1.15)' }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,2,15,0.78)_0%,rgba(4,2,15,0.32)_22%,rgba(4,2,15,0.42)_72%,rgba(4,2,15,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(94,234,212,0.18),transparent_55%)]" />

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
          <h1 className="font-elite text-[44px] leading-[0.95] font-bold tracking-[0.04em] text-[#ccfbf1] drop-shadow-[0_8px_28px_rgba(94,234,212,0.55)]">
            TechForum
            <span className="block mt-1">2026</span>
          </h1>
        </div>

        {/* Тонкий переключатель login / register с плавной motion-индикацией */}
        <div className="relative flex bg-white/[0.04] border border-white/10 p-1 rounded-2xl mb-6">
          {/* Бегунок */}
          <motion.span
            layout
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-[#5eead4]/15 border border-[#5eead4]/40"
            style={{ left: mode === 'login' ? 4 : 'calc(50% + 0px)' }}
          />
          {(['login','register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={cn(
                'relative flex-1 py-2.5 text-[13px] font-medium rounded-xl transition-colors z-10',
                mode === m ? 'text-[#ccfbf1]' : 'text-white/55'
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
                'flex-1 py-2 text-[14px] font-semibold rounded-xl transition-all',
                method === m ? 'bg-white/[0.06] text-[#ccfbf1]' : 'text-white/55'
              )}
            >
              {m === 'email' ? 'Email' : 'Телефон'}
            </button>
          ))}
        </div>

        {/* Форма с плавным переходом login ↔ register */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="space-y-4"
            >
              {/* BUG_FIX_CONTEXT: По требованию заказчика убраны placeholders
                  (примеры) во всех полях. Подсказка теперь только через label
                  сверху — поле остаётся пустым до ввода. */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className={labelClass}>Имя</label>
                  <div className="relative">
                    <UserIcon className={iconClass} />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

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
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-[14px] font-semibold text-rose-300 text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#5eead4] to-[#2dd4bf] text-[#04020f] py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 shadow-[0_8px_28px_rgba(94,234,212,0.35)] mt-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        {/* BUG_FIX_CONTEXT: По требованию заказчика удалена нижняя ссылка
            "Нет аккаунта? Зарегистрироваться / Уже есть аккаунт? Войти".
            Переключение режима остаётся через таб-бегунок выше. */}
      </div>
    </div>
  );
}
