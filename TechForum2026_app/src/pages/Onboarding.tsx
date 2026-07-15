// FILE: src/pages/Onboarding.tsx
// VERSION: 2.1.0
// START_MODULE_CONTRACT:
// PURPOSE: Onboarding-экран — первый вход после регистрации. Юзер выбирает
//          3-10 направлений интересов из 22. Сохраняем на сервере (источник
//          истины) + дублируем в localStorage как retry-буфер.
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.1.0 — Был баг: PUT /me/interests был fire-and-forget,
//                       любой 401/network/timeout молча игнорировался,
//                       onDone() вызывался всегда. На cold-start /auth/me
//                       возвращал interestsCount=0 → юзера снова кидало
//                       в онбординг. Теперь await response.ok, при ошибке
//                       показываем сообщение и НЕ закрываем экран.
//                       localStorage остаётся retry-буфером для App.tsx.]
// END_CHANGE_SUMMARY

import { useState, useEffect } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { INTERESTS } from '../data';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import { cn } from '@/src/lib/utils';

interface InterestOpt { id: string; label: string; color: string }

interface OnboardingProps {
  onDone: (interestsCount: number) => void;
}

const MIN_PICK = 3;
const MAX_PICK = 10;
const LS_KEY = 'techforum_my_interests';
const LS_PENDING_KEY = 'techforum_pending_interests';

export default function Onboarding({ onDone }: OnboardingProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  // Интересы берём с сервера (единый источник истины) — так выбор ВСЕГДА
  // валиден при сохранении (никакого unknown_interest_ids из-за рассинхрона
  // бандла и БД). Статический INTERESTS — фолбэк на случай оффлайна.
  const [interests, setInterests] = useState<InterestOpt[]>(INTERESTS as InterestOpt[]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(resolveApiUrl('/interests'));
        if (r.ok && !cancelled) {
          const data = await r.json();
          if (Array.isArray(data) && data.length) setInterests(data);
        }
      } catch {
        /* оффлайн — остаётся статический фолбэк */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggle(id: string): void {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_PICK) return prev;
        next.add(id);
      }
      return next;
    });
  }

  async function submit(): Promise<void> {
    if (selected.size < MIN_PICK) return;
    setLoading(true);
    setError('');
    const interestIds = Array.from(selected);

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(interestIds));
      localStorage.setItem(LS_PENDING_KEY, JSON.stringify(interestIds));
    } catch { /* private mode / quota — ignore */ }

    try {
      const res = await authFetch(resolveApiUrl('/me/interests'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestIds }),
      });
      if (!res.ok) {
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
        const msg = data?.message || data?.error || `Сервер ответил ${res.status}`;
        throw new Error(msg);
      }
      try { localStorage.removeItem(LS_PENDING_KEY); } catch { /* noop */ }
      setLoading(false);
      onDone(interestIds.length);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const isNetwork = /failed to fetch|networkerror|load failed|typeerror/i.test(raw);
      setError(isNetwork
        ? 'Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.'
        : `Не удалось сохранить выбор: ${raw}`);
      setLoading(false);
    }
  }

  const canSubmit = selected.size >= MIN_PICK && !loading;
  const remaining = Math.max(0, MIN_PICK - selected.size);

  return (
    <div
      className="relative text-foreground overflow-y-auto"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
        backgroundColor: 'var(--color-background)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(0,255,255,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(255,51,153,0.1),transparent_50%)] pointer-events-none" />

      <div className="relative z-10 px-7 space-y-6">
        <div className="space-y-3 pt-4">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-accent">
            Что тебе интересно?
          </h1>
          <p className="text-[14px] text-foreground/65 leading-relaxed">
            Отметь от {MIN_PICK} до {MAX_PICK} направлений — мы подсветим релевантные сессии в расписании. Минимум — {MIN_PICK}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {interests.map((it) => {
            const active = selected.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-[13px] font-semibold border transition-all active:scale-[0.97]',
                  active ? 'text-primary-foreground' : 'bg-card border-border text-foreground/70 hover:border-foreground/25',
                )}
                style={
                  active
                    ? { backgroundColor: it.color, borderColor: it.color, boxShadow: `0 0 18px ${it.color}66` }
                    : undefined
                }
              >
                {it.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 text-[13px] font-medium">
          <span className="text-foreground/55">
            Выбрано: <span className="text-primary font-bold">{selected.size}</span> / {MAX_PICK}
          </span>
          {remaining > 0 ? (
            <span className="text-amber-300/80 font-semibold">
              Нужно ещё {remaining}, чтобы продолжить
            </span>
          ) : (
            <span className="text-primary font-semibold">Можно продолжать</span>
          )}
        </div>

        {error && (
          <p className="text-[14px] font-semibold text-rose-300 text-center pt-1" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Sticky submit */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-7 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="max-w-[420px] mx-auto">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full bg-gradient-to-r from-primary to-[#ff3399] text-primary-foreground py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 shadow-[0_8px_28px_rgba(255,51,153,0.25)]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{remaining > 0 ? `Выбери ещё ${remaining}` : 'Готово'}</span>
                {remaining === 0 && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
