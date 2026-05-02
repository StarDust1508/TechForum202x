// FILE: src/pages/Onboarding.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Onboarding-экран — первый вход после регистрации. Юзер выбирает
//          3-10 направлений интересов из 22. Ответ сохраняется в БД через
//          PUT /api/v1/me/interests. Дальше Schedule показывает таб
//          "Recommended" с ранжированием по этим интересам.
// SCOPE: UI выбора + одна сетевая операция.
// INPUT: props.onDone — колбек, вызывается после успешного PUT.
// OUTPUT: JSX-страница на 100dvh, dark bg + turquoise accent (стиль Auth.tsx).
// KEYWORDS: DOMAIN(8): UserOnboarding; CONCEPT(7): MultiSelectPills; TECH(6): React, Tailwind
// LINKS: CALLS_API(9): /me/interests; READS_DATA_FROM(7): src/data INTERESTS
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему 3-10, а не 1-N?
// A: <3 — мало сигнала для score-ранжирования (Recommended вырождается).
//    >10 — пользователь "выбрал всё", сигнала тоже нет. 3-10 — sweet spot.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 - Первичная реализация: 22 pills, валидация 3-10,
//                       PUT /me/interests, onDone-callback.]
// END_CHANGE_SUMMARY

import { useState } from 'react';
import { Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { INTERESTS } from '../data';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { cn } from '@/src/lib/utils';

interface OnboardingProps {
  onDone: () => void;
}

const MIN_PICK = 3;
const MAX_PICK = 10;

export default function Onboarding({ onDone }: OnboardingProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(id: string): void {
    setError('');
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_PICK) return prev; // soft-cap, без визуального шейка — pill просто не выделится
        next.add(id);
      }
      return next;
    });
  }

  async function submit(): Promise<void> {
    if (selected.size < MIN_PICK) {
      setError(`Выбери минимум ${MIN_PICK} направления`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(resolveApiUrl('/me/interests'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'save_failed');
      }
      onDone();
    } catch (e: any) {
      setError(e?.message === 'save_failed' ? 'Не удалось сохранить. Проверь соединение.' : (e?.message || 'Ошибка'));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = selected.size >= MIN_PICK && !loading;

  return (
    <div
      className="relative bg-[#04020f] text-white overflow-y-auto"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
      }}
    >
      {/* Background accent — повторяет turquoise vibe Auth.tsx */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(94,234,212,0.18),transparent_55%)] pointer-events-none" />

      <div className="relative z-10 px-7 space-y-6">
        <div className="space-y-3 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5eead4]/10 border border-[#5eead4]/30">
            <Sparkles className="w-3.5 h-3.5 text-[#5eead4]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5eead4]">Onboarding</span>
          </div>
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#ccfbf1]">
            Что тебе интересно?
          </h1>
          <p className="text-[14px] text-white/65 leading-relaxed">
            Выбери {MIN_PICK}–{MAX_PICK} направлений — мы покажем релевантные сессии в топе расписания.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {INTERESTS.map((it) => {
            const active = selected.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => toggle(it.id)}
                className={cn(
                  'px-4 py-2.5 rounded-2xl text-[13px] font-semibold border transition-all active:scale-[0.97]',
                  active
                    ? 'text-[#04020f]'
                    : 'bg-white/[0.04] border-white/10 text-white/70 hover:border-white/25',
                )}
                style={
                  active
                    ? {
                        backgroundColor: it.color,
                        borderColor: it.color,
                        boxShadow: `0 0 18px ${it.color}66`,
                      }
                    : undefined
                }
              >
                {it.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 text-[12px] font-medium">
          <span className="text-white/50">
            Выбрано: <span className="text-[#5eead4] font-bold">{selected.size}</span> / {MAX_PICK}
          </span>
          {selected.size > 0 && selected.size < MIN_PICK && (
            <span className="text-amber-300/80">ещё {MIN_PICK - selected.size}</span>
          )}
        </div>

        {error && (
          <p className="text-[14px] font-semibold text-rose-300 text-center">{error}</p>
        )}
      </div>

      {/* Sticky submit */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 px-7 pt-3 bg-gradient-to-t from-[#04020f] via-[#04020f]/95 to-transparent"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className="max-w-[420px] mx-auto">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="w-full bg-gradient-to-r from-[#5eead4] to-[#2dd4bf] text-[#04020f] py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40 shadow-[0_8px_28px_rgba(94,234,212,0.35)]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Готово</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
