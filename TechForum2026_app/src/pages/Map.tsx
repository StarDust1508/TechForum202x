import { MapPin, Building, Coffee, Wifi, Phone, Info, Navigation } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import { EVENT_META } from '../data';

// Реальные координаты Технополиса «Инновация» в Саратове.
const VENUE_LAT = 51.5333;
const VENUE_LON = 46.0333;

const formatCoord = (v: number, dir: 'lat' | 'lon'): string => {
  const ns = dir === 'lat' ? (v >= 0 ? 'С' : 'Ю') : (v >= 0 ? 'В' : 'З');
  return `${Math.abs(v).toFixed(4)}° ${ns}`;
};

const osmUrl = `https://www.openstreetmap.org/?mlat=${VENUE_LAT}&mlon=${VENUE_LON}#map=16/${VENUE_LAT}/${VENUE_LON}`;

const INFRASTRUCTURE = [
  { label: 'Выставка', icon: Building, desc: 'Холл 1, этаж 1' },
  { label: 'Кофе-брейк', icon: Coffee, desc: 'Правое крыло' },
  { label: 'Wi-Fi', icon: Wifi, desc: 'TF-Guests' },
  { label: 'Поддержка', icon: Phone, desc: 'Стойка 0' },
];

export default function Map() {
  return (
    <PageShell
      kicker="Площадка"
      title="Карта"
      subtitle={`${EVENT_META.location}, ${EVENT_META.city}`}
    >
      <a
        href={osmUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-[4/3] bg-[#0a2f38]/45 border border-[#4ec9c0]/28 rounded-3xl relative overflow-hidden flex items-center justify-center hover:border-[#4ec9c0]/55 active:scale-[0.99] transition-all"
      >
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#4ec9c0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="absolute w-24 h-24 bg-[#4ec9c0]/10 rounded-full border border-[#4ec9c0]/30" />
        <div className="relative z-10 text-center space-y-3">
          <MapPin className="w-14 h-14 text-[#4ec9c0] mx-auto drop-shadow-[0_0_18px_rgba(78,201,192,0.6)]" />
          <div>
            <p className="text-[11px] text-[#d8f0ee] uppercase tracking-widest font-semibold">{EVENT_META.location}</p>
            <p className="text-[10px] text-[#7aa8a4] mt-1 font-mono">
              {formatCoord(VENUE_LAT, 'lat')}, {formatCoord(VENUE_LON, 'lon')}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] text-[#4ec9c0] uppercase tracking-widest">
            <Navigation className="w-3 h-3" /> Открыть в картах
          </span>
        </div>
      </a>

      <section className="mt-6 space-y-3">
        <h3 className="font-display-cyrl text-[16px] uppercase tracking-[0.18em] text-[#7aa8a4]">Инфраструктура</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {INFRASTRUCTURE.map((item, i) => (
            <div key={i} className="rounded-[14px] border border-[#4ec9c0]/22 bg-[#03161c]/40 p-4 flex items-center gap-3 hover:border-[#4ec9c0]/45 transition-colors">
              <div className="w-10 h-10 bg-[#4ec9c0]/10 rounded-[10px] border border-[#4ec9c0]/28 flex items-center justify-center text-[#4ec9c0]">
                <item.icon className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#d8f0ee] truncate">{item.label}</div>
                <div className="text-[11px] text-[#7aa8a4] truncate">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 bg-[#4ec9c0]/8 border border-[#4ec9c0]/30 p-5 rounded-2xl flex items-start gap-4">
        <div className="w-11 h-11 bg-[#4ec9c0] rounded-[10px] flex items-center justify-center text-[#03161c] shrink-0">
          <Info className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-[#d8f0ee] text-[14px]">Центральная регистрация</h4>
          <p className="text-[12px] text-[#7aa8a4] leading-relaxed">
            Расположена у главного входа. Получите бейдж и стартовый пакет до 10:00,
            чтобы попасть на церемонию открытия.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
