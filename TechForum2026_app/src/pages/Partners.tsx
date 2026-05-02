import { Building2, ExternalLink, Globe2 } from 'lucide-react';

const PARTNERS = [
  { name: 'Quantum Cloud', type: 'Генеральный партнер', site: 'quantumcloud.example' },
  { name: 'CyberForge', type: 'Партнер по безопасности', site: 'cyberforge.example' },
  { name: 'NeuroStack', type: 'AI-технологический партнер', site: 'neurostack.example' },
  { name: 'Future Devices', type: 'Аппаратный партнер', site: 'futuredevices.example' },
];

export default function Partners() {
  return (
    <div className="flex-1 min-h-full px-6 pt-8 pb-10 space-y-6">
      <header className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent/85 font-semibold">TechForum</p>
        <h1 className="font-elite text-4xl leading-none text-white">Партнеры</h1>
      </header>

      <div className="space-y-3.5">
        {PARTNERS.map((partner) => (
          <article key={partner.name} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-white/95">{partner.name}</h2>
                  <p className="text-sm text-white/70">{partner.type}</p>
                </div>
              </div>
              <ExternalLink className="w-4.5 h-4.5 text-white/45" />
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-[12px] text-white/75">
              <Globe2 className="w-3.5 h-3.5" />
              {partner.site}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
