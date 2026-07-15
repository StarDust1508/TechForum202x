import { Info, CalendarDays, MapPin, Users, Mic, Globe2, Zap, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { EVENT_META, SPEAKERS, PARTNERS, SESSIONS, TRACKS } from '../data';

export default function About() {
  const stats = [
    { label: 'Спикеров', value: SPEAKERS.length, icon: Mic, accent: '#00ffff' },
    { label: 'Сессий', value: SESSIONS.length, icon: CalendarDays, accent: '#ff3399' },
    { label: 'Треков', value: TRACKS.length, icon: Zap, accent: '#a855f7' },
    { label: 'Партнёров', value: PARTNERS.length, icon: Globe2, accent: '#fbbf24' },
  ];

  return (
    <div className="flex-1 min-h-full px-5 space-y-7" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-3 flex items-center gap-3 bg-background/90 backdrop-blur-md border-b border-border">
        <BackButton />
        <h1
          className="font-display text-[28px] leading-none font-bold"
          style={{
            background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >О форуме</h1>
      </header>

      {/* Hero card */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="relative rounded-2xl border border-primary/15 bg-primary/[0.04] p-6 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(0,255,255,0.035),transparent_60%)]" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-[17px] font-bold text-foreground/95 leading-tight">ТехнологИИ Права 2026</h2>
              <p className="text-[13px] text-foreground/55 leading-relaxed">
                Конференция о цифровых технологиях и искусственном интеллекте в юридической практике — для юристов, руководителей практик и legaltech-команд.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              <span className="text-[12px] font-semibold text-foreground/75">25–26 сентября 2026</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#ff3399]" />
              <span className="text-[12px] font-semibold text-foreground/75">{EVENT_META.location}, {EVENT_META.city}</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
              <Users className="w-3.5 h-3.5 text-[#a855f7]" />
              <span className="text-[12px] font-semibold text-foreground/75">600+ участников</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3">
        {stats.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + idx * 0.06, ease: [0.32, 0.72, 0, 1] }}
            className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4 space-y-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.accent}10`, border: `1px solid ${s.accent}25` }}>
              <s.icon className="w-5 h-5" style={{ color: s.accent }} />
            </div>
            <div>
              <p className="text-[22px] font-bold text-foreground/90 font-mono">{s.value}</p>
              <p className="text-[10px] text-foreground/40 uppercase tracking-[0.15em] font-bold">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Tracks */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-foreground/40 font-bold">Направления</h3>
        <div className="flex flex-wrap gap-2">
          {TRACKS.map((t) => (
            <span
              key={t.id}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border"
              style={{ color: t.color, borderColor: `${t.color}30`, backgroundColor: `${t.color}08` }}
            >
              {t.name}
            </span>
          ))}
        </div>
      </section>

      {/* Contact */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-[#ff3399]/15 border border-[#ff3399]/25 rounded-xl flex items-center justify-center shrink-0">
            <ExternalLink className="w-5 h-5 text-[#ff3399]" />
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-foreground/95 text-[14px]">Контакты</h4>
            <div className="space-y-1.5">
              <a href="mailto:pravotechhub@mail.ru" className="text-[13px] text-[#ff3399] font-semibold hover:underline block">
                pravotechhub@mail.ru
              </a>
              <p className="text-[12px] text-foreground/50 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-foreground/40" />
                Москва, Россия
              </p>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
