import { Info, Shield, Cpu, Smartphone } from 'lucide-react';
import BackButton from '@/src/components/BackButton';

export default function About() {
  const items = [
    { icon: Smartphone, title: 'Платформа', value: 'React + Capacitor Android' },
    { icon: Cpu, title: 'AI-помощник', value: 'Backend endpoint /api/v1/ai/chat' },
    { icon: Shield, title: 'Авторизация', value: 'Session cookie + безопасные хеши паролей' },
  ];

  return (
    <div className="flex-1 min-h-full px-6 pt-8 pb-10 space-y-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}>
      <BackButton />
      <header className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent/85 font-semibold">Информация</p>
        <h1 className="font-display-cyrl text-4xl leading-none text-white">О TechForum</h1>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
            <Info className="w-5 h-5 text-white/85" />
          </div>
          <p className="text-white/80 text-[15px] leading-relaxed">
            TechForum 2026 — мобильный центр конференции: расписание, спикеры, карта площадки, новости и сетевые возможности в одном интерфейсе.
          </p>
        </div>
      </section>

      <div className="space-y-3.5">
        {items.map(({ icon: Icon, title, value }) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-white/90">
              <Icon className="w-4 h-4" />
              <span className="font-semibold">{title}</span>
            </div>
            <p className="mt-2 text-white/65">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
