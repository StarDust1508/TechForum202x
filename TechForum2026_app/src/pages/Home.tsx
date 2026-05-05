import {
  User,
  Newspaper,
  MessageCircle,
  Calendar,
  Map,
  Handshake,
  ShieldCheck,
  Mic,
  FileText,
  Info,
  Sparkles,
  HelpCircle,
  Users as UsersIcon,
  ContactRound,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import IconTile from '@/src/components/ui/IconTile';
import BrandTitle from '@/src/components/ui/BrandTitle';
import EventBadge from '@/src/components/ui/EventBadge';

// Round 6: 15 плиток (3×5) — добавлены Гид, Участники, Моя визитка по
// эталону Eventicious. Диагностика убрана из главного меню (служебная).
const menuItems = [
  { label: 'Профиль', icon: User, to: '/profile' },
  { label: 'Программа', icon: Calendar, to: '/schedule' },
  { label: 'Спикеры', icon: Mic, to: '/speakers' },
  { label: 'Чат', icon: MessageCircle, to: '/chat' },
  { label: 'Участники', icon: UsersIcon, to: '/attendees' },
  { label: 'Моя визитка', icon: ContactRound, to: '/my-card' },
  { label: 'Билет', icon: ShieldCheck, to: '/ticket' },
  { label: 'Записи', icon: FileText, to: '/my-records' },
  { label: 'Розыгрыши', icon: Sparkles, to: '/giveaways' },
  { label: 'Партнёры', icon: Handshake, to: '/partners' },
  { label: 'Новости', icon: Newspaper, to: '/feed' },
  { label: 'Схема', icon: Map, to: '/map' },
  { label: 'Гид', icon: HelpCircle, to: '/faq' },
  { label: 'О форуме', icon: Info, to: '/about' },
] as const;

export default function Home() {
  return (
    <div
      className="relative px-5 pb-6"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
    >
      {/* Cog в правом-верхнем — как у эталона Eventicious. На Home это
          единственная навигационная кнопка (back-button скрыт, потому что
          это сам Home). Tap → /settings. */}
      <Link
        to="/settings"
        aria-label="Настройки"
        className="absolute right-5 z-10 h-10 w-10 rounded-xl border border-[#4ec9c0]/35 bg-[#0a2f38]/45 backdrop-blur-md flex items-center justify-center text-[#4ec9c0] hover:border-[#4ec9c0]/65 hover:text-[#d8f0ee] active:scale-90 transition-all"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
      >
        <SettingsIcon className="w-4 h-4" strokeWidth={1.6} />
      </Link>

      {/* Компактный размер: 12 плиток должны вмещаться без скролла на
          стандартных Android (≤6.7"), а если экран совсем маленький —
          скролл-родитель (App.tsx) корректно прокручивает. */}
      <BrandTitle animateYear={false} compact />
      <div className="mt-3 flex justify-center">
        <EventBadge to="/about" />
      </div>

      <section className="mt-4 grid grid-cols-3 place-items-center gap-x-2 gap-y-3">
        {menuItems.map(({ label, icon, to }) => (
          <IconTile key={label} label={label} icon={icon} to={to} />
        ))}
      </section>
    </div>
  );
}
