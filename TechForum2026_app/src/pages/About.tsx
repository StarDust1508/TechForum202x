import { Info, Shield, Smartphone, Calendar, MapPin, Mail, Globe2 } from 'lucide-react';
import PageShell from '@/src/components/ui/PageShell';
import { EVENT_META } from '../data';
import { EVENT_DATE } from '@/src/lib/event';

export default function About() {
  const facts = [
    { icon: Calendar, label: 'Даты', value: `${EVENT_DATE.toLowerCase()} 2026` },
    { icon: MapPin, label: 'Локация', value: `${EVENT_META.location}, ${EVENT_META.city}` },
    { icon: Smartphone, label: 'Платформа', value: 'React 19 + Capacitor 8 (Android)' },
    { icon: Shield, label: 'Безопасность', value: 'scrypt-хеши, HMAC QR-билет, 152-ФЗ' },
  ];

  return (
    <PageShell kicker="Информация" title="О TechForum">
      <section className="rounded-3xl border border-[#4ec9c0]/22 bg-[#0a2f38]/40 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl border border-[#4ec9c0]/28 bg-[#03161c]/40 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-[#4ec9c0]" strokeWidth={1.6} />
          </div>
          <p className="text-[#d8f0ee]/85 text-[15px] leading-relaxed">
            Мобильный центр конференции: расписание, спикеры, карта площадки,
            новости и переписка с участниками — в одном интерфейсе.
            Большинство разделов работает офлайн и синхронизируется с сервером в фоне.
          </p>
        </div>
      </section>

      <div className="mt-5 space-y-2.5">
        {facts.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-[14px] border border-[#4ec9c0]/22 bg-[#03161c]/40 p-4 flex items-center gap-3"
          >
            <Icon className="w-4 h-4 text-[#4ec9c0] shrink-0" strokeWidth={1.6} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#7aa8a4] font-semibold">{label}</p>
              <p className="text-[14px] text-[#d8f0ee] mt-0.5 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <a
          href={`mailto:${EVENT_META.organizerEmail}`}
          className="rounded-[14px] border border-[#4ec9c0]/30 bg-[#0a2f38]/55 p-4 flex items-center gap-3 hover:border-[#4ec9c0]/60 active:scale-[0.98] transition-all"
        >
          <Mail className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />
          <span className="text-[13px] text-[#d8f0ee] truncate">Связаться</span>
        </a>
        <a
          href={EVENT_META.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-[14px] border border-[#4ec9c0]/30 bg-[#0a2f38]/55 p-4 flex items-center gap-3 hover:border-[#4ec9c0]/60 active:scale-[0.98] transition-all"
        >
          <Globe2 className="w-4 h-4 text-[#4ec9c0]" strokeWidth={1.6} />
          <span className="text-[13px] text-[#d8f0ee] truncate">Сайт форума</span>
        </a>
      </div>

      <p className="mt-6 text-center text-[10px] font-mono uppercase tracking-[0.22em] text-[#7aa8a4]/60">
        © {EVENT_META.organizer} · {new Date().getFullYear()}
      </p>
    </PageShell>
  );
}
