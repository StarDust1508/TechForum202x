import { Building2, ExternalLink, Globe2 } from 'lucide-react';
import BackButton from '@/src/components/BackButton';
import { PARTNERS } from '../data';

// Раньше тут лежал inline-массив с fake-партнёрами (Quantum Cloud /
// quantumcloud.example и т.п.). Источник истины — PARTNERS в src/data.ts,
// тот же что использует server.ts для AI-context. Tier-сортировка по
// иерархии спонсорства.
const TIER_ORDER: Record<string, number> = {
  'Генеральный': 0,
  'Платиновый': 1,
  'Золотой': 2,
  'Серебряный': 3,
  'Бронзовый': 4,
};

export default function Partners() {
  const sorted = [...PARTNERS].sort((a, b) => {
    const ai = TIER_ORDER[a.tier] ?? 99;
    const bi = TIER_ORDER[b.tier] ?? 99;
    return ai - bi;
  });

  const cleanHost = (raw: string): string => {
    try { return new URL(raw).host.replace(/^www\./, ''); }
    catch { return raw.replace(/^https?:\/\//, '').replace(/\/$/, ''); }
  };

  return (
    <div
      className="px-6 space-y-6"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      <BackButton />
      <header className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#4ec9c0]/85 font-semibold">TechForum</p>
        <h1 className="font-display-cyrl text-4xl leading-none text-[#d8f0ee]">Партнёры</h1>
        <p className="text-[12px] text-[#7aa8a4] mt-1">{sorted.length} компаний поддерживают форум в этом году</p>
      </header>

      <div className="space-y-3">
        {sorted.map((partner) => (
          <a
            key={partner.id}
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5 hover:border-[#4ec9c0]/55 active:scale-[0.99] transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-2xl border border-[#4ec9c0]/28 bg-[#03161c]/40 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-[#4ec9c0]" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h2 className="text-[16px] font-semibold text-[#d8f0ee]">{partner.name}</h2>
                  <p className="text-[11px] text-[#4ec9c0] uppercase tracking-widest">{partner.tier} партнёр</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-[#7aa8a4] mt-1 shrink-0" />
            </div>

            <p className="mt-3 text-[13px] text-[#d8f0ee]/75 leading-relaxed">{partner.description}</p>

            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#4ec9c0]/15 px-3 py-1.5 text-[11px] text-[#7aa8a4]">
              <Globe2 className="w-3.5 h-3.5" />
              {cleanHost(partner.url)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
