import { ArrowRight, Download, ExternalLink, Scale, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { useAppContent } from '@/src/lib/useAppContent';

export default function Giveaways() {
  const content = useAppContent();
  const researchPaths = [
    {
      id: 'lawyer',
      eyebrow: 'Для юристов и юридических команд',
      title: content.researchLawyerTitle,
      description: content.researchLawyerDescription,
      material: content.researchLawyerMaterial,
      href: content.researchLawyerUrl,
    },
    {
      id: 'arbitration',
      eyebrow: 'Для арбитражных управляющих',
      title: content.researchManagerTitle,
      description: content.researchManagerDescription,
      material: content.researchManagerMaterial,
      href: content.researchManagerUrl,
    },
  ];
  return (
    <div className="min-h-full px-4 min-[360px]:px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 pb-3 pt-1 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5"><BackButton /><div><h1 className="font-display text-[27px] font-bold leading-tight">Исследования</h1><p className="mt-1 text-[13px] text-foreground/50">Выберите свою профессиональную роль</p></div></header>

      <section className="mt-5 rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Scale className="h-5 w-5" /></div><div><h2 className="font-display text-[19px] font-bold">Отраслевое ИИ-исследование 2026</h2><p className="mt-2 text-[14px] leading-relaxed text-foreground/65">{content.researchIntro}</p></div></div>
      </section>

      <div className="mt-4 space-y-3">
        {researchPaths.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22, delay: index * .06 }} className="rounded-3xl border border-border bg-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-primary">{item.eyebrow}</p>
          <h2 className="mt-2 font-display text-[21px] font-bold leading-tight">{item.title}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/65">{item.description}</p>
          <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-background/40 p-4"><Download className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><div><p className="text-[12px] font-bold text-foreground/85">Материал участника</p><p className="mt-1 text-[12px] leading-relaxed text-foreground/50">{item.material}</p></div></div>
          <a href={item.href} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">Открыть исследование <ArrowRight className="h-4 w-4" /></a>
          <a href={item.href} target="_blank" rel="noreferrer" className="mt-2 flex min-h-10 items-center justify-center gap-1.5 text-[12px] font-semibold text-accent">Получить материал <ExternalLink className="h-3.5 w-3.5" /></a>
        </motion.article>)}
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-background/35 p-4">
        <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-foreground/55" /><div><h2 className="text-[13px] font-bold">Условия без скрытых обещаний</h2><p className="mt-1 text-[12px] leading-relaxed text-foreground/50">{content.researchConditions}</p></div></div>
      </section>
    </div>
  );
}
