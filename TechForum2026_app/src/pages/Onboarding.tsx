// FILE: src/pages/Onboarding.tsx
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Onboarding-экран — первый вход после регистрации. Юзер выбирает
//          3-10 направлений интересов из 22. Сохраняем на сервере (best-effort)
//          + всегда в localStorage. UI никогда не блокирует юзера сетевыми
//          ошибками — после клика "Готово" с валидным выбором всегда onDone().
// END_MODULE_CONTRACT

import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { INTERESTS } from '../data';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { cn } from '@/src/lib/utils';

interface OnboardingProps {
  onDone: () => void;
}

const MIN_PICK = 3;
const MAX_PICK = 10;
const LS_KEY = 'techforum_my_interests';

export default function Onboarding({ onDone }: OnboardingProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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
    const interestIds = Array.from(selected);

    // BUG_FIX_CONTEXT: Юзер видел "Failed to fetch" и не мог пройти onboarding.
    // Причины могут быть разные (SameSite cookie на cross-origin PUT в Capacitor
    // WebView, network hiccup, local-auth fallback без cookie). Делаем сохранение
    // best-effort: пишем В ЛЮБОМ СЛУЧАЕ в localStorage, серверный PUT — попытка
    // в фоне, успех/провал не блокирует переход в app. Schedule-ранжирование
    // подтянет интересы из localStorage если /me/interests недоступен.
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(interestIds));
    } catch { /* private mode / quota — ignore */ }

    try {
      await fetch(resolveApiUrl('/me/interests'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestIds }),
      });
    } catch { /* offline / cors — игнор: данные уже в localStorage */ }

    setLoading(false);
    onDone();
  }

  const canSubmit = selected.size >= MIN_PICK && !loading;
  const remaining = Math.max(0, MIN_PICK - selected.size);

  return (
    <div
      className="relative bg-[#04020f] text-white overflow-y-auto"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 120px)',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(94,234,212,0.18),transparent_55%)] pointer-events-none" />

      <div className="relative z-10 px-7 space-y-6">
        <div className="space-y-3 pt-4">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-[#ccfbf1]">
            Что тебе интересно?
          </h1>
          <p className="text-[14px] text-white/65 leading-relaxed">
            Отметь от {MIN_PICK} до {MAX_PICK} направлений — мы подсветим релевантные сессии в расписании. Минимум — {MIN_PICK}.
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
                  active ? 'text-[#04020f]' : 'bg-white/[0.04] border-white/10 text-white/70 hover:border-white/25',
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
          <span className="text-white/55">
            Выбрано: <span className="text-[#5eead4] font-bold">{selected.size}</span> / {MAX_PICK}
          </span>
          {remaining > 0 ? (
            <span className="text-amber-300/80 font-semibold">
              Нужно ещё {remaining}, чтобы продолжить
            </span>
          ) : (
            <span className="text-[#5eead4] font-semibold">Можно продолжать</span>
          )}
        </div>
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
