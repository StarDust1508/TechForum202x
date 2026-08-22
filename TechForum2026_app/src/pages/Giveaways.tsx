import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Gift, Laptop, MailCheck, Send, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { fetchWithTimeout, resolveApiUrl } from '@/src/lib/runtimeEndpoint';

interface Giveaway { id: string; item: string; description?: string | null; condition?: string | null; endTime?: string | null; featured?: boolean; }

const CANONICAL: Giveaway = {
  id: 'ai-lawyers-2026-macbook-air', item: 'MacBook Air 13 M4',
  description: 'Главный приз отраслевого исследования о применении ИИ юристами и юридическими командами.',
  condition: 'Ответить на все 12 вопросов исследования и подтвердить email. Тестовые и исключённые записи не участвуют.',
  endTime: 'Итоги · 25 сентября 2026', featured: true,
};

export default function Giveaways() {
  const [giveaway, setGiveaway] = useState<Giveaway>(CANONICAL);

  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout(resolveApiUrl('/giveaways')).then((r) => r.ok ? r.json() : []).then((items) => {
      if (cancelled) return;
      const current = Array.isArray(items) && items.find((item) => item.id === CANONICAL.id);
      if (current) setGiveaway({ ...CANONICAL, ...current });
    }).catch(() => { /* canonical card remains visible offline */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-full px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-3 flex items-center gap-3 bg-background/95 border-b border-border"><BackButton /><h1 className="font-display text-[27px] font-bold text-foreground">Розыгрыш</h1></header>
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-card">
        <div className="relative min-h-52 p-6 bg-[radial-gradient(circle_at_80%_10%,rgba(255,51,153,.26),transparent_45%),radial-gradient(circle_at_15%_85%,rgba(0,255,255,.16),transparent_45%)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary"><Trophy className="w-3.5 h-3.5" /> Главный приз</span>
          <Laptop className="absolute right-6 top-8 w-24 h-24 text-accent/20" strokeWidth={1} />
          <h2 className="relative mt-16 font-display text-[27px] font-bold leading-tight">{giveaway.item}</h2><p className="relative mt-2 text-[12px] text-foreground/50">{giveaway.endTime}</p>
        </div>
        <div className="p-6"><p className="text-[13px] leading-relaxed text-foreground/65">{giveaway.description}</p>
          <div className="mt-5 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4"><div className="flex gap-3"><MailCheck className="w-5 h-5 text-accent shrink-0" /><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent">Как участвовать</p><p className="mt-2 text-[12px] leading-relaxed text-foreground/70">{giveaway.condition}</p></div></div></div>
          <div className="mt-4 space-y-2 text-[11px] text-foreground/50"><p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" />Один подтверждённый email — одна запись в пуле.</p><p className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" />Победителя объявим 25 сентября и уведомим по email и в Telegram.</p></div>
          <div className="mt-5 rounded-2xl border border-border bg-background/45 p-4 text-[10px] leading-relaxed text-foreground/50">
            <p className="font-bold uppercase tracking-[0.12em] text-foreground/70">Официальные правила</p>
            <p className="mt-2">Организатор розыгрыша — ООО «ВОРМ». Участие бесплатное и не связано с покупкой внутри приложения. Один победитель определяется среди валидных анкет исследования; порядок, сроки, ограничения и обработка персональных данных опубликованы на странице исследования.</p>
            <p className="mt-2">Apple Inc. не является спонсором, организатором или участником этого розыгрыша и не несёт за него ответственности.</p>
          </div>
          <a href="https://tech-pravo.ru/ai-dlya-yuristov" target="_blank" rel="noreferrer" className="mt-6 w-full rounded-2xl bg-primary py-4 text-[13px] font-bold text-white inline-flex items-center justify-center gap-2"><Gift className="w-4 h-4" />Пройти исследование и участвовать</a>
          <a href="https://tech-pravo.ru/ai-dlya-yuristov" target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-accent">Условия на сайте <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </motion.section>
      <a href="https://t.me/TechPravoAI" target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><Send className="w-5 h-5 text-primary" /><div><p className="text-[12px] font-bold">Следить за итогами</p><p className="text-[10px] text-foreground/40">Telegram-канал TechPravoAI</p></div></a>
    </div>
  );
}
