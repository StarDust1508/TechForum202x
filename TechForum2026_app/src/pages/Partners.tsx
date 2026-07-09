import { ExternalLink, Globe2, Crown, Award, Star, Cpu, Handshake } from 'lucide-react';
import { motion } from 'motion/react';
import { PARTNERS } from '../data';
import BackButton from '@/src/components/BackButton';

const tierConfig: Record<string, { icon: typeof Crown; color: string; glow: string; border: string; bg: string }> = {
  'Генеральный':     { icon: Crown,  color: 'text-[#ff3399]', glow: 'shadow-[0_0_20px_rgba(255,51,153,0.2)]', border: 'border-[#ff3399]/30', bg: 'bg-[#ff3399]/[0.06]' },
  'Платиновый':      { icon: Award,  color: 'text-primary', glow: 'shadow-[0_0_20px_rgba(255,51,153,0.15)]', border: 'border-primary/25', bg: 'bg-primary/[0.04]' },
  'Золотой':         { icon: Star,   color: 'text-[#fbbf24]', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.15)]', border: 'border-[#fbbf24]/20', bg: 'bg-[#fbbf24]/[0.04]' },
  'Серебряный':      { icon: Star,   color: 'text-foreground/60', glow: '', border: 'border-border', bg: 'bg-white/[0.03]' },
  'Технологический': { icon: Cpu,    color: 'text-[#a855f7]', glow: '', border: 'border-[#a855f7]/20', bg: 'bg-[#a855f7]/[0.04]' },
};

export default function Partners() {
  return (
    <div className="flex-1 min-h-full px-5 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
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
        >Партнёры</h1>
        </div>
        <p className="text-[13px] text-foreground/40 leading-relaxed ml-[52px]">
          {PARTNERS.length} компаний поддерживают форум
        </p>
      </header>

      <div className="space-y-3">
        {PARTNERS.map((partner, idx) => {
          const cfg = tierConfig[partner.tier] ?? tierConfig['Серебряный'];
          const TierIcon = cfg.icon;

          return (
            <motion.a
              key={partner.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4), ease: [0.32, 0.72, 0, 1] }}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-2xl ${cfg.border} ${cfg.bg} ${cfg.glow} p-5 active:scale-[0.98] transition-all`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className={`h-11 w-11 rounded-xl ${cfg.border} bg-card flex items-center justify-center shrink-0`}>
                    <TierIcon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-[16px] font-bold text-foreground/95 truncate">{partner.name}</h2>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.15em] ${cfg.color}`}>
                      {partner.tier}
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-foreground/30 shrink-0 mt-1" />
              </div>

              <p className="mt-3 text-[12px] text-foreground/50 leading-relaxed line-clamp-2">
                {partner.description}
              </p>

              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-foreground/35">
                <Globe2 className="w-3 h-3" />
                {partner.url.replace('https://', '')}
              </div>
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
