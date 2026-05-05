import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Trophy, ChevronRight, CheckCircle2, Clock, Sparkles, X, Loader2, Award,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { resolveApiUrl } from '@/src/lib/runtimeEndpoint';
import { iconForKey, type GiveawayApi } from '@/src/lib/giveawayIcons';

// Round 5: данные тянутся из БД (/giveaways). LucideIcon resolves через
// iconForKey(iconKey). Раньше захардкоженный GIVEAWAYS массив + LS_KEY +
// readJoinedGiveaways остаётся только как backwards-compat re-export для
// MyRecords (он импортирует readJoinedGiveaways как fallback при offline).
export type Giveaway = GiveawayApi;

// Призы от партнёров форума. Сейчас захардкожены — если форум вырастет
// в постоянный продукт и потребует админку, переедем на серверный
// эндпоинт `/giveaways` с CRUD.

// Round 5: данные перешли в БД (миграция 0009 + seed). Backwards-compat
// экспорты — пустые / no-op чтобы MyRecords не сломался при импорте старого
// API. Real source: useGiveaways hook ниже.
export const LS_KEY = 'techforum_giveaways_legacy';
export const GIVEAWAYS: Giveaway[] = [];
export function readJoinedGiveaways(): string[] { return []; }

export default function Giveaways() {
  const [list, setList] = useState<Giveaway[]>([]);
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Round 5: список призов из БД (/giveaways), участия из /me/giveaways.
  // Параллельный fetch на mount.
  const fetchAll = useCallback(async (): Promise<void> => {
    try {
      const [glist, mine] = await Promise.all([
        fetch(resolveApiUrl('/giveaways'), { credentials: 'include' }).then((r) => r.ok ? r.json() : [] as Giveaway[]),
        fetch(resolveApiUrl('/me/giveaways'), { credentials: 'include' })
          .then((r) => r.ok ? r.json() : { giveawayIds: [] }),
      ]);
      setList(glist as Giveaway[]);
      setParticipatingIds(((mine as { giveawayIds: string[] }).giveawayIds) ?? []);
    } catch { /* offline — список останется пустым */ } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const join = async (id: string) => {
    if (busyId || participatingIds.includes(id)) return;
    setBusyId(id);
    // Optimistic update.
    setParticipatingIds((prev) => [...prev, id]);
    try {
      const r = await fetch(resolveApiUrl(`/giveaways/${id}/join`), {
        method: 'POST', credentials: 'include',
      });
      if (!r.ok) throw new Error(`join_failed_${r.status}`);
      setShowSuccess(id);
      window.setTimeout(() => setShowSuccess(null), 3200);
    } catch {
      // Rollback.
      setParticipatingIds((prev) => prev.filter((x) => x !== id));
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (id: string) => {
    setConfirmLeave(null);
    if (busyId) return;
    setBusyId(id);
    const before = participatingIds;
    setParticipatingIds((prev) => prev.filter((x) => x !== id));
    try {
      const r = await fetch(resolveApiUrl(`/giveaways/${id}/join`), {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error(`leave_failed_${r.status}`);
    } catch {
      setParticipatingIds(before);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell kicker="Зона призов" title="Розыгрыши">
      {/* Презентабельный banner — статистика, призовой фонд, призыв */}
      <section className="relative overflow-hidden rounded-3xl border border-[#4ec9c0]/40 bg-gradient-to-br from-[#0a2f38]/80 via-[#0a2f38]/55 to-[#03161c]/40 p-6 mb-6">
        <Trophy className="absolute -right-6 -top-6 w-32 h-32 text-[#4ec9c0]/8" strokeWidth={1.1} />
        <Sparkles className="absolute right-12 top-3 w-5 h-5 text-[#4ec9c0]/70" />
        <Sparkles className="absolute right-4 top-14 w-4 h-4 text-[#4ec9c0]/40" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#4ec9c0]/45 bg-[#03161c]/70 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ec9c0] animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#4ec9c0]">{list.length} активных розыгрышей</span>
          </div>
          <h2 className="font-display-cyrl text-[24px] font-semibold text-[#d8f0ee] leading-tight max-w-[80%]">
            Призовой фонд — больше миллиона рублей
          </h2>
          <p className="text-[13px] text-[#d8f0ee]/75 leading-relaxed max-w-[88%]">
            От ноутбуков и флагманских смартфонов до годовой подписки на курсы и поездки на международные IT-конференции.
            Чтобы участвовать, выполни условие розыгрыша. Победителей объявят на главной сцене 21 мая в 19:00.
          </p>
          <div className="flex gap-3 pt-1">
            <div className="flex-1 rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/55 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#7aa8a4]">Вы участвуете</p>
              <p className="font-display-cyrl text-[20px] font-semibold text-[#4ec9c0] mt-0.5">{participatingIds.length}</p>
            </div>
            <div className="flex-1 rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/55 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#7aa8a4]">Доступно</p>
              <p className="font-display-cyrl text-[20px] font-semibold text-[#d8f0ee] mt-0.5">{list.length - participatingIds.length}</p>
            </div>
          </div>
        </div>
      </section>

      {loading && list.length === 0 && (
        <div className="space-y-4 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 overflow-hidden">
              <Skeleton height={176} className="rounded-none" />
              <div className="p-5 space-y-3">
                <Skeleton height={18} width="65%" />
                <Skeleton height={11} width="92%" />
                <Skeleton height={36} />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#4ec9c0]/25 bg-[#0a2f38]/30 p-8 text-center">
          <Trophy className="w-9 h-9 mx-auto text-[#4ec9c0]/60" strokeWidth={1.4} />
          <p className="mt-3 text-[#d8f0ee]/75">Пока нет активных розыгрышей.</p>
          <p className="mt-1 text-[12px] text-[#7aa8a4]">Загляните позже — призы открываются ближе к форуму.</p>
        </div>
      )}

      <div className="space-y-4">
        {list.map((g) => {
          const joined = participatingIds.includes(g.id);
          const Icon = iconForKey(g.iconKey);
          return (
            <article
              key={g.id}
              className={cn(
                'rounded-3xl border bg-[#0a2f38]/40 overflow-hidden transition-all',
                joined ? 'border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.18)]' : 'border-[#4ec9c0]/22',
              )}
            >
              {/* Hero: gradient + центральная иконка + бейджи */}
              <div className={cn('relative h-44 overflow-hidden flex items-center justify-center bg-gradient-to-br', g.gradient)}>
                {/* Layered рисунок: SVG-сетка + большая полупрозрачная иконка */}
                <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id={`grid-${g.id}`} width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4ec9c0" strokeWidth="0.4" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill={`url(#grid-${g.id})`} />
                </svg>
                <Icon className="absolute -right-4 -bottom-6 w-44 h-44 text-white/8" strokeWidth={0.8} />
                <Icon className="relative z-10 w-24 h-24 text-[#d8f0ee] drop-shadow-[0_0_24px_rgba(255,255,255,0.4)]" strokeWidth={1.1} />

                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {g.featured && (
                    <span className="inline-flex items-center gap-1 bg-[#4ec9c0] text-[#03161c] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" strokeWidth={2} />
                      Главный приз
                    </span>
                  )}
                  <span className="bg-[#03161c]/85 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full border border-[#4ec9c0]/40 uppercase tracking-widest">
                    {g.category}
                  </span>
                </div>

                <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-[#03161c]/85 backdrop-blur-md text-[#d8f0ee] font-mono text-[9px] font-semibold px-2.5 py-1 rounded-full border border-[#4ec9c0]/40 uppercase tracking-widest">
                  <Clock className="w-3 h-3 text-[#4ec9c0]" strokeWidth={1.6} />
                  {g.endTime}
                </div>
              </div>

              <div className="p-5 space-y-3">
                <h3 className="font-display-cyrl text-[19px] font-semibold text-[#d8f0ee] leading-tight">{g.item}</h3>
                <p className="text-[13px] leading-relaxed text-[#d8f0ee]/80">{g.description}</p>

                {/* Условие участия — как требование/правило */}
                <div className="rounded-2xl border border-[#4ec9c0]/22 bg-[#03161c]/40 p-3 flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-[#4ec9c0] mt-0.5 shrink-0" strokeWidth={1.8} />
                  <div className="space-y-1 min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#4ec9c0]/85">Условие участия</p>
                    <p className="text-[12px] leading-relaxed text-[#d8f0ee]/75">{g.condition}</p>
                  </div>
                </div>

                {/* CTA: join → outline-teal; joined → emerald with leave-option */}
                <div className="flex items-center gap-2 pt-1">
                  {joined ? (
                    <>
                      <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] border border-emerald-500/45 bg-emerald-500/10 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-300 font-display-cyrl">
                        <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
                        Вы участвуете
                      </div>
                      <button
                        onClick={() => setConfirmLeave(g.id)}
                        className="px-4 py-3 rounded-[12px] border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 active:scale-95 transition-all"
                        aria-label="Отказаться от участия"
                      >
                        <X className="w-4 h-4" strokeWidth={1.8} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => join(g.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-[12px] border border-[#4ec9c0]/55 bg-[#0a2f38]/70 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#d8f0ee] hover:border-[#4ec9c0]/85 hover:bg-[#0e3a44]/85 active:scale-[0.98] transition-all font-display-cyrl"
                    >
                      Участвовать
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Toast successful join */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-6 right-6 z-40 max-w-[420px] mx-auto rounded-3xl border border-[#4ec9c0]/55 bg-[#03161c]/95 backdrop-blur-xl shadow-[0_24px_60px_rgba(78,201,192,0.25)] p-4 flex items-center gap-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#4ec9c0] flex items-center justify-center text-[#03161c]">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#4ec9c0]">Заявка принята</p>
              <p className="text-[13px] font-semibold text-[#d8f0ee] mt-0.5">
                Условия проверим у входа в зал по QR-билету
              </p>
            </div>
            <Gift className="w-5 h-5 text-[#4ec9c0]/65" strokeWidth={1.4} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm leave modal */}
      <AnimatePresence>
        {confirmLeave && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#03161c]/85 backdrop-blur-md"
            onClick={() => setConfirmLeave(null)}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 24, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[380px] rounded-3xl border border-[#4ec9c0]/30 bg-[#052830]/95 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            >
              <h3 className="font-display-cyrl text-[20px] text-[#d8f0ee] mb-2">Отказаться от участия?</h3>
              <p className="text-[13px] text-[#7aa8a4] mb-5 leading-relaxed">
                Вы выйдете из этого розыгрыша. Можно вернуться в любой момент до окончания приёма заявок.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLeave(null)}
                  className="flex-1 rounded-[12px] border border-[#4ec9c0]/30 bg-[#0a2f38]/40 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#d8f0ee] hover:border-[#4ec9c0]/55 transition-all"
                >
                  Остаться
                </button>
                <button
                  onClick={() => leave(confirmLeave)}
                  className="flex-1 rounded-[12px] border border-rose-500/55 bg-rose-500/15 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-300 hover:bg-rose-500/25 transition-all"
                >
                  Отказаться
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
