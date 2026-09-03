import { CalendarDays, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContent } from '@/src/lib/useAppContent';

interface EventBadgeProps {
  to?: string;
  date?: string;
  city?: string;
}

export default function EventBadge({
  to,
  date,
  city,
}: EventBadgeProps) {
  const event = useAppContent();
  const content = (
    <span className="inline-flex max-w-full flex-wrap justify-center items-center gap-2.5 rounded-2xl border border-primary/35 bg-card px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground/90 backdrop-blur-sm">
      <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" /><span className="break-words">{date ?? event.dateLabel}</span></span>
      <span className="flex min-w-0 items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.6} aria-hidden="true" /><span className="break-words">{city ?? event.city}</span></span>
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
