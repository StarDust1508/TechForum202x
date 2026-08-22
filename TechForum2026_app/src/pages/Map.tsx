import { Building2, CircleHelp, ExternalLink, MapPin, Navigation, Send } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { useAppContent } from '@/src/lib/useAppContent';

const venueZones = [
  { name: 'Зал A', purpose: 'Основная деловая программа', accent: '#00ffff' },
  { name: 'Фойе', purpose: 'Регистрация и встречи', accent: '#ff3399' },
  { name: 'Ресторан', purpose: 'События, отмеченные в программе', accent: '#a855f7' },
];

export default function Map() {
  const content = useAppContent();
  return (
    <div className="px-5 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="sticky top-0 z-20 -mx-5 px-5 pt-1 pb-3 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <h1 className="font-display text-[21px] leading-tight font-bold text-foreground">Как добраться</h1>
            <p className="mt-1 text-[11px] text-foreground/45">{content.city} · {content.venueName}</p>
          </div>
        </div>
      </header>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-accent/25 bg-card p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent via-primary to-accent" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl border border-accent/25 bg-accent/[0.08] flex items-center justify-center shrink-0"><MapPin className="w-6 h-6 text-accent" /></div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-foreground">{content.venueName}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground/60">{content.address}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a href={content.yandexMapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-[12px] font-bold text-primary-foreground active:scale-[0.98] transition-transform"><Navigation className="w-4 h-4" /> Маршрут</a>
          <a href={content.twoGisUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-accent/25 bg-accent/[0.07] px-3 py-3 text-[12px] font-bold text-accent active:scale-[0.98] transition-transform">2ГИС <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </motion.section>

      <section className="space-y-3">
        <div>
          <h2 className="text-[14px] font-bold text-foreground">Ориентиры внутри</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground/45">Открывайте карточку события: в ней указан актуальный зал.</p>
        </div>
        <div className="space-y-2">
          {venueZones.map((zone, index) => (
            <motion.article key={zone.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.05 }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${zone.accent}12`, border: `1px solid ${zone.accent}35` }}><Building2 className="w-5 h-5" style={{ color: zone.accent }} /></div>
              <div><p className="text-[13px] font-bold text-foreground">{zone.name}</p><p className="mt-0.5 text-[11px] text-foreground/45">{zone.purpose}</p></div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5">
        <div className="flex items-start gap-3">
          <CircleHelp className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[13px] font-bold">Нужна помощь на месте?</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-foreground/50">{content.venueHelp}</p>
            <a href={`https://t.me/${content.organizerTelegram}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[12px] font-bold text-primary"><Send className="w-4 h-4" /> Написать организатору</a>
          </div>
        </div>
      </section>
    </div>
  );
}
