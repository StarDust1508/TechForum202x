import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { INTERESTS } from '../data';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { cn } from '@/src/lib/utils';
import AppBackground from '@/src/components/AppBackground';

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

  function toggle(id: string): void {
    setSelected((prev) => {
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
    } catch { /* private mode / quota */ }

    try {
      const res = await fetch(resolveApiUrl('/me/interests'), {
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
  const ready = remaining === 0;
  const progress = Math.min(1, selected.size / MIN_PICK);

  return (
    <AppBackground>
      <div
        className="relative w-full overflow-y-auto"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 36px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)',
          minHeight: '100lvh',
        }}
      >
        <div className="relative z-10 px-6 space-y-6">
          <div className="space-y-2 pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#4ec9c0]/85 font-semibold">
              Шаг 2 · Интересы
            </p>
            <h1 className="font-display-cyrl text-[32px] font-semibold leading-[1.05] tracking-wide text-[#d8f0ee]">
              Что тебе интересно?
            </h1>
            <p className="text-[13px] text-[#d8f0ee]/65 leading-relaxed">
              Отметь от {MIN_PICK} до {MAX_PICK} направлений — мы подсветим релевантные сессии в расписании.
            </p>
          </div>

          {/* Прогресс-бар до минимума выбора. Лёгкий, без отвлекающего шума. */}
          <div className="relative h-1 rounded-full bg-[#0a2f38]/55 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[#4ec9c0]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            />
          </div>

          {/* Чипы */}
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((it) => {
              const active = selected.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={cn(
                    'group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[12px] text-[13px] font-display-cyrl font-semibold border transition-all active:scale-[0.97]',
                    active
                      ? 'bg-[#4ec9c0]/15 border-[#4ec9c0]/70 text-[#4ec9c0] shadow-[0_0_18px_rgba(78,201,192,0.28)]'
                      : 'bg-[#03161c]/40 border-[#4ec9c0]/18 text-[#d8f0ee]/75 hover:border-[#4ec9c0]/40',
                  )}
                  aria-pressed={active}
                >
                  {active && <Check className="w-3.5 h-3.5" strokeWidth={2.4} />}
                  {it.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-1 text-[12px]">
            <span className="text-[#7aa8a4]">
              Выбрано: <span className="text-[#4ec9c0] font-mono font-semibold">{selected.size}</span> / {MAX_PICK}
            </span>
            {remaining > 0 ? (
              <span className="text-amber-300/85 font-display-cyrl font-semibold uppercase tracking-wider text-[11px]">
                Ещё {remaining}
              </span>
            ) : (
              <span className="text-[#4ec9c0] font-display-cyrl font-semibold uppercase tracking-wider text-[11px]">
                Можно продолжать
              </span>
            )}
          </div>

          {error && (
            <p className="text-[13px] font-semibold text-rose-300 text-center pt-1" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Sticky submit с тёмной подложкой-fade. */}
        <div
          className="fixed bottom-0 left-0 right-0 z-20 px-6 pt-6 bg-gradient-to-t from-[#03161c] via-[#03161c]/95 to-transparent"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
        >
          <div className="max-w-[420px] mx-auto">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className={cn(
                'w-full py-4 rounded-[14px] text-[14px] font-semibold uppercase tracking-[0.08em] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 backdrop-blur-sm font-display-cyrl border',
                ready
                  ? 'border-[#4ec9c0]/70 bg-[#0a2f38]/80 text-[#d8f0ee] hover:border-[#4ec9c0] shadow-[0_8px_24px_rgba(78,201,192,0.22)]'
                  : 'border-[#4ec9c0]/35 bg-[#03161c]/60 text-[#7aa8a4]',
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : ready ? (
                <>
                  <span>Готово</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.8} />
                </>
              ) : (
                <span>Выбери ещё {remaining}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </AppBackground>
  );
}
