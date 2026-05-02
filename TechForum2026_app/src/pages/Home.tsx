import {
  User,
  Newspaper,
  MessageCircle,
  Calendar,
  Map,
  Handshake,
  ShieldCheck,
  MonitorCog,
  Mic,
  FileText,
  Info,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const menuItems = [
  { label: 'Профиль', icon: User, to: '/profile' },
  { label: 'Новости', icon: Newspaper, to: '/feed' },
  { label: 'Чат', icon: MessageCircle, to: '/chat' },
  { label: 'Программа', icon: Calendar, to: '/schedule' },
  { label: 'Схема\nмероприятия', icon: Map, to: '/map' },
  { label: 'Партнеры', icon: Handshake, to: '/partners' },
  { label: 'Безопасность', icon: ShieldCheck, to: '/ticket' },
  { label: 'Диагностика', icon: MonitorCog, to: '/diagnostics' },
  { label: 'Спикеры', icon: Mic, to: '/speakers' },
  { label: 'Мои записи', icon: FileText, to: '/my-records' },
  { label: 'О TechForum', icon: Info, to: '/about' },
  { label: 'Розыгрыши', icon: Sparkles, to: '/giveaways' },
];

export default function Home() {
  return (
    <div className="relative flex-1 min-h-full overflow-hidden bg-[#040317]">
      <div className="absolute inset-0">
        <img
          src="/home-menu-reference.jpg"
          alt="Menu reference"
          className="h-full w-full object-cover scale-[1.03] opacity-20 blur-[5px] saturate-50"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,5,23,0.96)_0%,rgba(10,7,31,0.96)_44%,rgba(8,5,21,0.98)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(121,83,181,0.25),transparent_45%)]" />

      <div className="relative z-10 px-5 pb-8 pt-4">
        <header className="pt-4 pb-8 text-center">
          <h1 className="font-elite text-[62px] leading-[0.92] font-bold tracking-[0.04em] text-[#d7c4ff] drop-shadow-[0_10px_34px_rgba(83,57,135,0.55)]">
            TechForum
            <span className="block mt-1">2026</span>
          </h1>
        </header>

        <section>
          <div className="grid grid-cols-3 gap-x-2 gap-y-7">
            {menuItems.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                className="flex flex-col items-center text-center gap-2.5 rounded-2xl px-1 py-1 active:scale-95 transition-transform"
              >
                <div className="h-11 w-11 rounded-2xl border border-white/12 bg-white/[0.02] flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.42)]">
                  <Icon className="h-6 w-6 text-white/88" />
                </div>
                <span className="font-elite text-[15px] leading-[1.08] text-white/90 whitespace-pre-line tracking-[0.01em]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
