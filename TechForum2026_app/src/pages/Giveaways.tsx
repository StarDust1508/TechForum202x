import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Clock, Gift, Loader2, Sparkles, Trophy, Users, XCircle, Zap } from 'lucide-react';
import BackButton from '@/src/components/BackButton';
import { authFetch, resolveApiUrl } from '@/src/lib/runtimeEndpoint';

interface Giveaway {
  id: string;
  title: string;
  category: string;
  item: string;
  imageUrl?: string | null;
  gradient?: string | null;
  description?: string | null;
  condition?: string | null;
  endTime?: string | null;
  endsAt?: string | null;
  participants: number;
  featured?: boolean;
}

type Notice = { type: 'success' | 'error'; text: string } | null;

export default function Giveaways() {
  const [items, setItems] = useState<Giveaway[]>([]);
  const [participatingIds, setParticipatingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogResponse, mineResponse] = await Promise.all([
        fetch(resolveApiUrl('/giveaways'), { credentials: 'include', cache: 'no-store' }),
        authFetch(resolveApiUrl('/me/giveaways'), { cache: 'no-store' }),
      ]);
      if (!catalogResponse.ok) throw new Error('catalog_unavailable');
      const catalog = await catalogResponse.json() as Giveaway[];
      const mine = mineResponse.ok
        ? await mineResponse.json() as { giveawayIds?: string[] }
        : { giveawayIds: [] };
      setItems(Array.isArray(catalog) ? catalog : []);
      setParticipatingIds(Array.isArray(mine.giveawayIds) ? mine.giveawayIds : []);
    } catch {
      setItems([]);
      setNotice({ type: 'error', text: 'Не удалось получить актуальные розыгрыши. Попробуйте обновить страницу.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleParticipation = async (id: string) => {
    if (busyId) return;
    const joined = participatingIds.includes(id);
    setBusyId(id);
    setNotice(null);
    try {
      const response = await authFetch(resolveApiUrl(`/giveaways/${encodeURIComponent(id)}/join`), {
        method: joined ? 'DELETE' : 'POST',
      });
      if (response.status === 401) throw new Error('auth');
      if (response.status === 403) throw new Error('closed');
      if (!response.ok) throw new Error('failed');
      setParticipatingIds((current) => joined ? current.filter((value) => value !== id) : [...current, id]);
      setItems((current) => current.map((item) => item.id === id
        ? { ...item, participants: Math.max(0, item.participants + (joined ? -1 : 1)) }
        : item));
      setNotice({ type: 'success', text: joined ? 'Участие отменено.' : 'Участие зарегистрировано в системе.' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      setNotice({
        type: 'error',
        text: reason === 'auth'
          ? 'Войдите в аккаунт, чтобы участвовать.'
          : reason === 'closed'
            ? 'Приём заявок уже закрыт.'
            : 'Не удалось изменить участие. Попробуйте ещё раз.',
      });
    } finally {
      setBusyId('');
      window.setTimeout(() => setNotice(null), 3500);
    }
  };

  return (
    <div className="flex-1 px-5 space-y-7 relative" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <BackButton to="/" />
          <h1 className="font-display text-[28px] leading-none font-bold bg-gradient-to-r from-[#ff3399] via-[#ff66b2] to-[#00ffff] bg-clip-text text-transparent">Розыгрыши</h1>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
          <Trophy className="absolute -right-2 -top-2 h-24 w-24 text-primary opacity-[0.055]" />
          <div className="relative z-10 space-y-2">
            <h2 className="text-[15px] font-bold text-foreground/90">Только подтверждённые предложения партнёров</h2>
            <p className="max-w-[88%] text-[11px] leading-relaxed text-foreground/45">Условия, сроки и количество участников приходят с сервера. Заявка сохраняется в вашем аккаунте и доступна организатору.</p>
          </div>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between px-1 text-[11px] text-foreground/40">
            <span className="inline-flex items-center gap-2"><Gift className="h-3.5 w-3.5 text-primary/60" /><b className="text-foreground/70">{items.length}</b> активных</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-green-400/60" />Вы участвуете: <b className="text-green-400">{participatingIds.length}</b></span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.02]"><Loader2 className="h-8 w-8 animate-spin text-primary/70" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-12 text-center">
          <Gift className="mx-auto h-10 w-10 text-primary/35" />
          <h2 className="mt-4 text-[17px] font-bold text-foreground/85">Активных розыгрышей пока нет</h2>
          <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-foreground/45">Новые предложения появятся здесь только после подтверждения приза, условий и сроков организатором.</p>
          <button onClick={() => void load()} className="mt-5 rounded-xl border border-primary/25 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Обновить</button>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map((giveaway, index) => {
            const joined = participatingIds.includes(giveaway.id);
            return (
              <motion.article
                key={giveaway.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className={`overflow-hidden rounded-2xl border ${joined ? 'border-green-500/30 bg-green-500/[0.035]' : 'border-white/[0.07] bg-white/[0.025]'}`}
              >
                {giveaway.imageUrl ? (
                  <div className="relative h-44 overflow-hidden">
                    <img src={giveaway.imageUrl} alt={giveaway.item} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f1118] via-[#0f1118]/35 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5"><h3 className="text-[19px] font-bold text-white">{giveaway.item}</h3><p className="mt-1 text-[11px] text-white/55">{giveaway.title || giveaway.category}</p></div>
                  </div>
                ) : (
                  <div className="relative overflow-hidden border-b border-white/[0.06] px-5 py-7">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,51,153,0.14),transparent_55%)]" />
                    <Gift className="absolute right-5 top-4 h-16 w-16 text-primary opacity-10" />
                    <div className="relative"><h3 className="text-[19px] font-bold text-foreground/95">{giveaway.item}</h3><p className="mt-1 text-[11px] text-foreground/45">{giveaway.title || giveaway.category}</p></div>
                  </div>
                )}

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap gap-2">
                    {giveaway.featured && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-primary"><Sparkles className="h-2.5 w-2.5" />Главный приз</span>}
                    {giveaway.endTime && <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-foreground/55"><Clock className="h-2.5 w-2.5" />{giveaway.endTime}</span>}
                  </div>
                  {giveaway.description && <p className="text-[12px] leading-relaxed text-foreground/55">{giveaway.description}</p>}
                  {giveaway.condition && (
                    <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary/75" />
                      <div><span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/30">Условие участия</span><p className="mt-1 text-[12px] font-medium leading-snug text-foreground/70">{giveaway.condition}</p></div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/45"><Users className="h-3.5 w-3.5 text-primary/60" /><b className="font-mono text-foreground/80">{giveaway.participants}</b> участников</span>
                    <button
                      onClick={() => void toggleParticipation(giveaway.id)}
                      disabled={Boolean(busyId)}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition disabled:opacity-50 ${joined ? 'border border-red-500/20 bg-red-500/10 text-red-400' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
                    >
                      {busyId === giveaway.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : joined ? <XCircle className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                      {joined ? 'Отказаться' : 'Участвовать'}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} className={`fixed bottom-24 left-5 right-5 z-50 flex items-center gap-3 rounded-2xl border p-4 shadow-2xl ${notice.type === 'success' ? 'border-green-400/25 bg-green-500 text-white' : 'border-red-400/25 bg-[#29161c] text-red-100'}`}>
            {notice.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <p className="text-[12px] font-semibold">{notice.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
