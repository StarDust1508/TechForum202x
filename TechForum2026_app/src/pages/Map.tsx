import { MapPin, Building, Coffee, Wifi, Phone, Info, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import BackButton from '@/src/components/BackButton';
import { EVENT_META } from '../data';

export default function Map() {
  return (
    <div className="px-5 space-y-7" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1
            className="font-display text-[28px] leading-none font-bold"
            style={{
              background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >Карта площадки</h1>
        </div>
        <p className="text-[13px] text-foreground/40 ml-[52px]">{EVENT_META.location}, {EVENT_META.city}</p>
      </header>

      {/* Stylized venue map */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="aspect-[4/5] rounded-2xl border border-primary/15 bg-background relative overflow-hidden"
      >
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(0,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow accents */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,255,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,51,153,0.05),transparent_50%)]" />

        {/* Floor plan schematic */}
        <div className="absolute inset-6 flex flex-col gap-3">
          {/* Main Hall */}
          <div className="flex-[3] rounded-xl border border-primary/20 bg-primary/[0.03] flex items-center justify-center relative">
            <div className="absolute top-2 left-3 text-[8px] uppercase tracking-[0.2em] text-primary/40 font-bold">Главный зал</div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <p className="text-[10px] text-foreground/50 font-semibold">600 мест</p>
            </div>
          </div>

          <div className="flex gap-3 flex-[2]">
            {/* Hall Alpha */}
            <div className="flex-1 rounded-xl border border-[#ff3399]/15 bg-[#ff3399]/[0.03] flex items-center justify-center">
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-[0.15em] text-[#ff3399]/50 font-bold">Альфа</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">220 мест</p>
              </div>
            </div>
            {/* Hall Beta */}
            <div className="flex-1 rounded-xl border border-[#a855f7]/15 bg-[#a855f7]/[0.03] flex items-center justify-center">
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-[0.15em] text-[#a855f7]/50 font-bold">Бета</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">180 мест</p>
              </div>
            </div>
          </div>

          {/* Foyer */}
          <div className="flex-[1] rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5 text-[9px] text-foreground/30 uppercase tracking-wider">
              <Coffee className="w-3 h-3" /> Фойе
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-foreground/30 uppercase tracking-wider">
              <Building className="w-3 h-3" /> Выставка
            </div>
          </div>
        </div>

        {/* GPS badge */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.06]">
          <Navigation className="w-3 h-3 text-primary/50" />
          <span className="text-[8px] text-foreground/30 font-mono tracking-wide">51.5339°N 46.0014°E</span>
        </div>
      </motion.div>

      {/* Infrastructure grid */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-foreground/40 font-bold">Инфраструктура</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Выставка', icon: Building, desc: 'Фойе, этаж 1', accent: '#00ffff' },
            { label: 'Кофе-брейк', icon: Coffee, desc: 'Правое крыло', accent: '#ff3399' },
            { label: 'Wi-Fi', icon: Wifi, desc: 'TF_Guests', accent: '#00ffff' },
            { label: 'Поддержка', icon: Phone, desc: 'Стойка регистрации', accent: '#ff3399' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white/[0.03] border border-white/[0.06] p-4 rounded-2xl flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.accent}10`, borderColor: `${item.accent}20` }}>
                <item.icon className="w-5 h-5" style={{ color: item.accent }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-foreground/90 truncate">{item.label}</div>
                <div className="text-[10px] text-foreground/40 truncate">{item.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Info card */}
      <section className="bg-primary/[0.05] border border-primary/15 p-5 rounded-2xl flex items-start gap-4">
        <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shrink-0">
          <Info className="w-5 h-5 text-[#0f1118]" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-foreground/90 text-[13px]">Регистрация</h4>
          <p className="text-[11px] text-foreground/50 leading-relaxed">Стойка у главного входа. Получите бейдж и стартовый пакет до 10:00 первого дня.</p>
        </div>
      </section>
    </div>
  );
}
