import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
  variant?: 'primary' | 'ghost';
}

export default function Button({
  loading = false,
  variant = 'primary',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base = 'w-full rounded-[14px] py-4 text-[16px] font-semibold tracking-[0.04em] uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 font-sans';
  const variants = {
    primary:
      'border border-primary/55 bg-background/60 backdrop-blur-sm text-foreground/90 shadow-[0_8px_24px_rgba(0,255,255,0.18)] hover:border-primary/80 hover:bg-card',
    ghost:
      'border border-primary/25 bg-transparent text-foreground/40 hover:text-foreground/90 hover:border-primary/50',
  } as const;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}
