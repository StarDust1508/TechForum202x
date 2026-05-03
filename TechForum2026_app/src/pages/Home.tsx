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
import IconTile from '@/src/components/ui/IconTile';
import BrandTitle from '@/src/components/ui/BrandTitle';
import EventBadge from '@/src/components/ui/EventBadge';

const menuItems = [
  { label: 'Профиль', icon: User, to: '/profile' },
  { label: 'Новости', icon: Newspaper, to: '/feed' },
  { label: 'Чат', icon: MessageCircle, to: '/chat' },
  { label: 'Программа', icon: Calendar, to: '/schedule' },
  { label: 'Схема', icon: Map, to: '/map' },
  { label: 'Партнёры', icon: Handshake, to: '/partners' },
  { label: 'Билет', icon: ShieldCheck, to: '/ticket' },
  { label: 'Диагностика', icon: MonitorCog, to: '/diagnostics' },
  { label: 'Спикеры', icon: Mic, to: '/speakers' },
  { label: 'Записи', icon: FileText, to: '/my-records' },
  { label: 'О форуме', icon: Info, to: '/about' },
  { label: 'Розыгрыши', icon: Sparkles, to: '/giveaways' },
] as const;

export default function Home() {
  return (
    <div
      className="px-6 pb-10"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      <BrandTitle animateYear={false} />
      <div className="mt-5 flex justify-center">
        <EventBadge to="/about" />
      </div>

      <section className="mt-9 grid grid-cols-3 gap-x-3 gap-y-7">
        {menuItems.map(({ label, icon, to }) => (
          <IconTile key={label} label={label} icon={icon} to={to} />
        ))}
      </section>
    </div>
  );
}
