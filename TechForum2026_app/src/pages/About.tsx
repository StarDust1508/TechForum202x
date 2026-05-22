import { Info, CalendarDays, MapPin, Users, Mic, Globe2, Shield, Zap, ExternalLink } from 'lucide-react';
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
    <div className="flex-1 min-h-full px-5 pt-8 pb-10 space-y-7" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />

      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold">Информация</p>
        <h1 className="font-elite text-3xl leading-none text-white">О форуме</h1>
      </header>

      {/* Hero card */}
      <section className="relative rounded-2xl border border-[#00ffff]/15 bg-[#00ffff]/[0.04] p-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(0,255,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,51,153,0.05),transparent_50%)]" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00ffff]/10 border border-[#00ffff]/20 flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-[#00ffff]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-[17px] font-bold text-white/95 leading-tight">TechForum 2026</h2>
              <p className="text-[13px] text-white/55 leading-relaxed">
                Ежегодная технологическая конференция для разработчиков, инженеров, исследователей AI и IT-лидеров.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              <CalendarDays className="w-3.5 h-3.5 text-[#00ffff]" />
              <span className="text-[12px] font-semibold text-white/75">20–21 мая 2026</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              <MapPin className="w-3.5 h-3.5 text-[#ff3399]" />
              <span className="text-[12px] font-semibold text-white/75">{EVENT_META.location}, {EVENT_META.city}</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              <Users className="w-3.5 h-3.5 text-[#a855f7]" />
              <span className="text-[12px] font-semibold text-white/75">600+ участников</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.accent}10`, border: `1px solid ${s.accent}25` }}>
              <s.icon className="w-5 h-5" style={{ color: s.accent }} />
            </div>
            <div>
              <p className="text-[22px] font-bold text-white/90 font-mono">{s.value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] font-bold">{s.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Tracks */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold">Направления</h3>
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

      {/* Tech stack */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold">Приложение</h3>
        <div className="space-y-2.5">
          {[
            { icon: Zap, label: 'Платформа', value: 'React 19 + Capacitor Android', accent: '#00ffff' },
            { icon: Shield, label: 'Авторизация', value: 'Session cookie + bcrypt', accent: '#ff3399' },
            { icon: Globe2, label: 'Бэкенд', value: 'Express + PostgreSQL + Drizzle ORM', accent: '#a855f7' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.accent}10`, border: `1px solid ${item.accent}20` }}>
                <item.icon className="w-4 h-4" style={{ color: item.accent }} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white/85 truncate">{item.label}</p>
                <p className="text-[11px] text-white/40 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-[#ff3399]/[0.04] border border-[#ff3399]/15 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-[#ff3399]/10 border border-[#ff3399]/20 rounded-xl flex items-center justify-center shrink-0">
          <ExternalLink className="w-5 h-5 text-[#ff3399]" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-white/90 text-[13px]">Контакты</h4>
          <p className="text-[11px] text-white/50 leading-relaxed">
            ООО «Bubble Group» · info@techforum.ru
          </p>
        </div>
      </section>
    </div>
  );
}
