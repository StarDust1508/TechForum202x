import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EventBadgeProps {
  to?: string;
  date?: string;
  city?: string;
}

export default function EventBadge({
  to,
  date = '20–21 МАЯ',
  city = 'САРАТОВ',
}: EventBadgeProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-[#4ec9c0]/35 bg-[#0a2f38]/55 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#d8f0ee] backdrop-blur-sm">
      <CalendarDays className="h-4 w-4 text-[#4ec9c0]" strokeWidth={1.6} />
      <span>{date}</span>
      <span className="h-1 w-1 rounded-full bg-[#4ec9c0]/70" />
      <MapPin className="h-4 w-4 text-[#4ec9c0]" strokeWidth={1.6} />
      <span>{city}</span>
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="active:scale-[0.97] transition-transform">
        {content}
      </Link>
    );
  }
  return content;
}
