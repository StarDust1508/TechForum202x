import {
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  Gift,
  ListChecks,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import BackButton from '@/src/components/BackButton';
import { useAppContent } from '@/src/lib/useAppContent';
import { RESEARCH_CONTENT_EVIDENCE } from '@/src/lib/researchEvidence';

export default function Giveaways() {
  const content = useAppContent();
  const researchPaths = [
    {
      id: 'lawyer',
      icon: Scale,
      role: 'Юрист или юридическая команда',
      title: content.researchLawyerTitle,
      description: content.researchLawyerDescription,
      material: content.researchLawyerMaterial,
      href: content.researchLawyerUrl,
      action: 'Пройти опрос для юристов',
    },
    {
      id: 'arbitration',
      icon: BriefcaseBusiness,
      role: 'Арбитражный управляющий',
      title: content.researchManagerTitle,
      description: content.researchManagerDescription,
      material: content.researchManagerMaterial,
      href: content.researchManagerUrl,
      action: 'Пройти опрос для управляющих',
    },
  ];

  return (
    <div
      className="min-h-full px-4 min-[360px]:px-5"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      <header className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 pb-4 pt-1 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(24px,7vw,29px)] font-bold leading-[1.1] text-balance">Исследования</h1>
            <p className="mt-1 text-[13px] font-medium text-foreground/60">{RESEARCH_CONTENT_EVIDENCE.questionCount} вопросов · {RESEARCH_CONTENT_EVIDENCE.estimatedMinutes} минут</p>
          </div>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-3xl border border-primary/30 bg-card p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-5 max-w-[18ch] font-display text-[23px] font-bold leading-[1.15] text-balance">
          Как ИИ меняет юридическую работу
        </h2>
        <p className="mt-3 max-w-[38rem] text-[15px] leading-[1.55] text-foreground/72 text-pretty">
          {content.researchIntro}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-background/45 p-3.5">
            <Clock3 className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-foreground/85">Быстро</p>
            <p className="mt-1 text-[12px] leading-[1.45] text-foreground/55">{RESEARCH_CONTENT_EVIDENCE.estimatedMinutes} минут</p>
          </div>
          <div className="rounded-2xl bg-background/45 p-3.5">
            <FileCheck2 className="h-4 w-4 text-accent" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-foreground/85">Полезно</p>
            <p className="mt-1 text-[12px] leading-[1.45] text-foreground/55">Материал после регистрации</p>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="research-role-heading">
        <h2 id="research-role-heading" className="px-1 font-display text-[17px] font-bold text-foreground">
          Выберите направление
        </h2>
        <div className="mt-3 space-y-4">
          {researchPaths.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.08] text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/90">
                      {String(index + 1).padStart(2, '0')} · {item.role}
                    </p>
                    <h3 className="mt-2 font-display text-[20px] font-bold leading-[1.2] text-balance">{item.title}</h3>
                  </div>
                </div>

                <p className="mt-4 text-[14px] leading-[1.55] text-foreground/68 text-pretty">{item.description}</p>

                <div className="mt-5 rounded-2xl bg-background/45 p-4">
                  <div className="flex gap-3">
                    <Gift className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" aria-hidden="true" />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground/88">Что получите</p>
                      <p className="mt-1.5 text-[13px] leading-[1.5] text-foreground/60 text-pretty">{item.material}</p>
                    </div>
                  </div>
                </div>

                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-center text-[14px] font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {item.action}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5 rounded-2xl bg-foreground/[0.04] p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h2 className="text-[13px] font-semibold text-foreground/88">Конфиденциальность ответов</h2>
            <p className="mt-1.5 text-[12px] leading-[1.55] text-foreground/58 text-pretty">{content.researchConditions}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
