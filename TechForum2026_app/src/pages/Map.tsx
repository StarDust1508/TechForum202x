import { MapPin, Building, Coffee, Wifi, Phone, Info } from 'lucide-react';
import BackButton from '@/src/components/BackButton';

export default function Map() {
  return (
    <div className="pb-24 pt-6 px-5 space-y-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#d8f0ee]">Карта площадки</h1>
        <p className="text-xs text-[#7aa8a4] font-medium">Технопарк "Инновация", Холл 1-2</p>
      </header>

      <div className="space-y-6">
        {/* Map Visual Component */}
        <div className="aspect-[4/5] bg-card border border-[#4ec9c0]/28 rounded-[3rem] relative overflow-hidden flex items-center justify-center group">
          <img 
            src="https://picsum.photos/seed/techmap/800/1000?blur=10" 
            alt="Venue Map" 
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale brightness-50 transition-all group-hover:scale-105"
          />
          {/* Static circle instead of ping */}
          <div className="absolute w-24 h-24 bg-accent/10 rounded-full border border-accent/20" />
          
          <div className="relative z-10 text-center space-y-4">
            <div className="relative inline-block">
              <MapPin className="w-16 h-16 text-accent" />
              <div className="absolute -bottom-2 left-1/2 -translate-y-1/2 w-4 h-1 bg-accent/30 rounded-full blur-[2px]" />
            </div>
            <div>
              {/* ГПС координаты */}
              <p className="text-[8px] text-[#7aa8a4] uppercase mt-1 tracking-widest">ГПС: 55.7558° С, 37.6173° В</p>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="text-lg font-bold tracking-tight">Инфраструктура</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Выставка', icon: Building, desc: 'Этаж 1' },
              { label: 'Кофе-брейк', icon: Coffee, desc: 'Правое крыло' },
              { label: 'Wi-Fi', icon: Wifi, desc: 'TF Guests' },
              { label: 'Поддержка', icon: Phone, desc: 'Стойка 0' },
            ].map((item, i) => (
              <div key={i} className="bg-card border border-[#4ec9c0]/28 p-4 rounded-[2rem] flex items-center gap-3 hover:border-accent/40 transition-colors">
                <div className="w-10 h-10 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#d8f0ee] truncate">{item.label}</div>
                  <div className="text-[10px] text-[#7aa8a4] truncate">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-accent/10 border border-accent/20 p-5 rounded-[2.5rem] flex items-start gap-4">
          <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-[#03161c] shrink-0">
            <Info className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-[#d8f0ee] text-sm">Центральная регистрация</h4>
            <p className="text-xs text-[#7aa8a4] leading-relaxed font-medium">Расположена у главного входа. Не забудьте получить бейджи и стартовый пакет участника до 10:00.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
