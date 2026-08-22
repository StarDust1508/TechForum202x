import { CalendarDays, ExternalLink, Mail, MapPin, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import BrandLogo from '@/src/components/BrandLogo';
import { useAppContent } from '@/src/lib/useAppContent';

export default function About() {
  const content = useAppContent();
  const contacts = [
    { label: content.email, href: `mailto:${content.email}`, icon: Mail, note: 'Билеты, партнёрство и организационные вопросы' },
    { label: `@${content.organizerTelegram}`, href: `https://t.me/${content.organizerTelegram}`, icon: Send, note: 'Связаться лично с организатором' },
    { label: content.telegramChannel, href: `https://t.me/${content.telegramChannel}`, icon: Send, note: 'Новости и обновления конференции' },
  ];
  return (
    <div className="flex-1 min-h-full px-5 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-3 flex items-center gap-3 bg-background/95 backdrop-blur-md border-b border-border">
        <BackButton /><h1 className="font-display text-[26px] font-bold text-foreground">О конференции</h1>
      </header>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-accent/25 bg-card p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-primary to-accent" />
        <BrandLogo className="text-[19px]" />
        <p className="mt-5 text-[18px] font-display font-bold leading-snug text-foreground">{content.tagline}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/60">{content.description}</p>
        <div className="mt-5 grid gap-2">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3"><CalendarDays className="w-5 h-5 text-primary" /><div><p className="text-[13px] font-bold">{content.dateLabel}</p><p className="text-[11px] text-foreground/45">{content.dateDetail}</p></div></div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3"><MapPin className="w-5 h-5 text-accent" /><div><p className="text-[13px] font-bold">{content.venueName}</p><p className="text-[11px] text-foreground/45">{content.address}</p></div></div>
        </div>
      </motion.section>

      <section className="grid grid-cols-2 gap-3">
        {[
          { icon: Sparkles, title: content.dayOneTitle, text: content.dayOneDescription, color: '#ff3399' },
          { icon: ShieldCheck, title: content.dayTwoTitle, text: content.dayTwoDescription, color: '#00ffff' },
        ].map(({ icon: Icon, title, text, color }) => <article key={title} className="rounded-2xl border border-border bg-card p-4"><Icon className="w-5 h-5" style={{ color }} /><h2 className="mt-3 text-[13px] font-bold">{title}</h2><p className="mt-2 text-[11px] leading-relaxed text-foreground/45">{text}</p></article>)}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5">
        <div className="flex gap-3"><Users className="w-5 h-5 text-primary shrink-0" /><div><h2 className="text-[14px] font-bold">Скачать может каждый</h2><p className="mt-1 text-[12px] leading-relaxed text-foreground/55">После бесплатной регистрации доступны программа и спикеры. QR-билет появится только при входе по email, на который была оформлена покупка.</p></div></div>
      </section>

      <section><h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/40">Связаться с нами</h2><div className="space-y-2">
        {contacts.map(({ label, href, icon: Icon, note }) => <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 active:scale-[0.99] transition-transform"><div className="w-10 h-10 rounded-xl border border-accent/25 bg-accent/[0.08] flex items-center justify-center"><Icon className="w-5 h-5 text-accent" /></div><div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-foreground">{label}</p><p className="mt-0.5 text-[10px] text-foreground/40">{note}</p></div><ExternalLink className="w-4 h-4 text-foreground/25" /></a>)}
      </div></section>
    </div>
  );
}
