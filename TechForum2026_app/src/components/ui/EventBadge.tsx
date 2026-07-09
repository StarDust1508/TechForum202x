import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EVENT_DATE, EVENT_CITY } from '@/src/lib/event';

interface EventBadgeProps {
  to?: string;
  date?: string;
  city?: string;
}

export default function EventBadge({
  to,
  date = EVENT_DATE,
  city = EVENT_CITY,
}: EventBadgeProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-primary/35 bg-card px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/90 backdrop-blur-sm">
      <CalendarDays className="h-4 w-4 text-primary" strokeWidth={1.6} />
      <span>{date}</span>
      <span className="h-1 w-1 rounded-full bg-primary/70" />
      <MapPin className="h-4 w-4 text-primary" strokeWidth={1.6} />
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
