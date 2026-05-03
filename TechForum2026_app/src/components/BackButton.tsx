import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** If true, position absolutely in the top-left of its parent (above safe-area). */
  floating?: boolean;
  /** Override target — defaults to navigate(-1). */
  to?: string;
  /** Optional aria-label override. */
  label?: string;
}

/**
 * Reusable back arrow.
 * - Tap → navigate(-1) (or to a specific route).
 * - On Android, the system "back" button also triggers history.back() (handled
 *   automatically by React Router via popstate). The BackButton is the visual
 *   in-app counterpart so the user always has both options.
 * - Sits ABOVE the safe-area-inset-top so it never overlaps the status bar.
 */
export default function BackButton({ floating = true, to, label = 'Назад' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    // Prefer history.back() so the system "back" gesture and this button behave identically.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Floating BackButton — `fixed` относительно viewport, чтобы координаты
  // были одинаковые на ВСЕХ страницах независимо от parent-`position`.
  // Раньше `absolute` давал «летающую» позицию (зависел от того, есть ли
  // у внешнего div страницы position: relative).
  const positionClass = floating
    ? 'fixed left-4 z-40'
    : 'relative';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`${positionClass} h-10 w-10 flex items-center justify-center rounded-[12px] border border-[#4ec9c0]/35 bg-[#03161c]/60 backdrop-blur-md text-[#4ec9c0] hover:text-[#d8f0ee] hover:border-[#4ec9c0]/60 hover:bg-[#0a2f38]/70 active:scale-90 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]`}
      style={floating ? { top: 'calc(env(safe-area-inset-top, 0px) + 12px)' } : undefined}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
