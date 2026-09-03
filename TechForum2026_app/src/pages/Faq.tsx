// FILE: src/pages/Faq.tsx
// Round 6: «Гид по мероприятию» — категоризованный FAQ из БД.
// Раздел эталонного Eventicious. Поиск + аккордеон по категориям.

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, ChevronDown, HelpCircle, Mail, Send } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import Skeleton from '@/src/components/ui/Skeleton';
import { resolveApiUrl, authFetch } from '@/src/lib/runtimeEndpoint';
import { useAppContent } from '@/src/lib/useAppContent';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function Faq() {
  const content = useAppContent();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(resolveApiUrl('/faq'), { credentials: 'include' });
        if (r.ok) {
          const data: FaqItem[] = await r.json();
          if (!cancelled) setItems(data);
        }
      } catch { /* offline */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) =>
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q),
    );
  }, [items, search]);

  // Группируем по категории, сохраняя порядок появления.
  const grouped = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const f of filtered) {
      const arr = map.get(f.category) ?? [];
      arr.push(f);
      map.set(f.category, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <PageShell kicker="Помощь" title="Гид" subtitle="Ответы на частые вопросы">
      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-primary/65"
          strokeWidth={1.6}
        />
        <input
          type="text"
          placeholder="Билет, программа, адрес…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          inputMode="search"
          className="w-full rounded-[14px] border border-primary/30 bg-card py-3.5 pl-12 pr-12 text-[15px] text-foreground placeholder:text-foreground/40 outline-none focus:border-primary/70 focus:bg-foreground/[0.06] transition-colors font-sans"
        />
        {search && (
          <button
            type="button"
            aria-label="Очистить"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-foreground/40 hover:text-foreground"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
        )}
      </div>

      {loading && items.length === 0 && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-primary/22 bg-card p-5 space-y-2">
              <Skeleton height={11} width="20%" />
              <Skeleton height={15} width="80%" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-primary/25 bg-card p-8 text-center">
          <HelpCircle className="w-9 h-9 mx-auto text-primary/60" strokeWidth={1.4} />
          <p className="mt-3 text-foreground/75">
            {search ? `По запросу «${search}» ничего не нашли.` : 'Раздел пока пуст.'}
          </p>
          <p className="mt-1 text-[12px] text-foreground/40">Не нашли ответ? Мы на связи.</p>
          <div className="mt-4 flex justify-center gap-2">
            <a href={`mailto:${content.email}`} className="inline-flex items-center gap-1.5 rounded-xl border border-accent/25 bg-accent/[0.07] px-3 py-2 text-[11px] font-bold text-accent"><Mail className="w-3.5 h-3.5" /> Email</a>
            <a href={`https://t.me/${content.organizerTelegram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2 text-[11px] font-bold text-primary"><Send className="w-3.5 h-3.5" /> Telegram</a>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([category, list]) => (
          <section key={category} className="space-y-2">
            <h3 className="font-display text-[11px] uppercase tracking-[0.28em] font-semibold text-primary/85 px-1">
              {category}
            </h3>
            <div className="space-y-2">
              {list.map((f, idx) => {
                const isOpen = openId === f.id;
                return (
                  <motion.article
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(idx * 0.03, 0.3) }}
                    className="rounded-2xl border border-primary/22 bg-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : f.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left active:scale-[0.99] transition-transform"
                    >
                      <span className="font-display text-[14px] font-semibold text-foreground leading-snug">
                        {f.question}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 text-primary"
                      >
                        <ChevronDown className="w-4 h-4" strokeWidth={1.8} />
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="answer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 text-[13px] text-foreground/80 leading-relaxed border-t border-primary/15 pt-3">
                            {f.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
