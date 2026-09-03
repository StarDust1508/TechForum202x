import { Building2, ExternalLink, Globe2, Crown, Award, Star, Cpu } from 'lucide-react';
import { PARTNERS } from '../data';
import BackButton from '@/src/components/BackButton';

const tierConfig: Record<string, { icon: typeof Crown; color: string; glow: string; border: string; bg: string }> = {
  'Генеральный':     { icon: Crown,  color: 'text-[#ff3399]', glow: 'shadow-[0_0_20px_rgba(255,51,153,0.2)]', border: 'border-[#ff3399]/30', bg: 'bg-[#ff3399]/[0.06]' },
  'Платиновый':      { icon: Award,  color: 'text-[#00ffff]', glow: 'shadow-[0_0_20px_rgba(0,255,255,0.15)]', border: 'border-[#00ffff]/25', bg: 'bg-[#00ffff]/[0.04]' },
  'Золотой':         { icon: Star,   color: 'text-[#fbbf24]', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.15)]', border: 'border-[#fbbf24]/20', bg: 'bg-[#fbbf24]/[0.04]' },
  'Серебряный':      { icon: Star,   color: 'text-white/60', glow: '', border: 'border-white/10', bg: 'bg-white/[0.03]' },
  'Технологический': { icon: Cpu,    color: 'text-[#a855f7]', glow: '', border: 'border-[#a855f7]/20', bg: 'bg-[#a855f7]/[0.04]' },
};

export default function Partners() {
  return (
    <div className="flex-1 min-h-full px-5 pt-8 pb-10 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />

      <header className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#ff3399]/60 font-bold">TechForum 2026</p>
        <h1 className="font-elite text-3xl leading-none text-white">Партнёры</h1>
        <p className="text-[13px] text-white/40 leading-relaxed">
          {PARTNERS.length} компаний поддерживают форум
        </p>
      </header>

      <div className="space-y-3">
        {PARTNERS.map((partner) => {
          const cfg = tierConfig[partner.tier] ?? tierConfig['Серебряный'];
          const TierIcon = cfg.icon;

          return (
            <a
              key={partner.id}
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-2xl ${cfg.border} ${cfg.bg} ${cfg.glow} p-5 active:scale-[0.98] transition-all`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  <div className={`h-11 w-11 rounded-xl ${cfg.border} bg-white/[0.04] flex items-center justify-center shrink-0`}>
                    <TierIcon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-[16px] font-bold text-white/95 truncate">{partner.name}</h2>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.15em] ${cfg.color}`}>
                      {partner.tier}
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-white/30 shrink-0 mt-1" />
              </div>

              <p className="mt-3 text-[12px] text-white/50 leading-relaxed line-clamp-2">
                {partner.description}
              </p>

              <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/35">
                <Globe2 className="w-3 h-3" />
                {partner.url.replace('https://', '')}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
