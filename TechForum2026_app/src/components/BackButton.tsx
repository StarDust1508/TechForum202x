import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  label?: string;
}

export default function BackButton({ to, label = 'Назад' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="shrink-0 h-11 w-11 flex items-center justify-center rounded-2xl border border-border bg-card backdrop-blur-md text-foreground/85 hover:text-foreground hover:bg-foreground/[0.12] active:scale-90 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
