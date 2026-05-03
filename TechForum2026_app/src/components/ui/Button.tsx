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
  const base = 'w-full rounded-[14px] py-4 text-[16px] font-semibold tracking-[0.04em] uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 font-display';
  const variants = {
    primary:
      'border border-[#4ec9c0]/55 bg-[#0a2f38]/70 text-[#d8f0ee] shadow-[0_8px_24px_rgba(78,201,192,0.18)] hover:border-[#4ec9c0]/80 hover:bg-[#0e3a44]/80',
    ghost:
      'border border-[#4ec9c0]/25 bg-transparent text-[#7aa8a4] hover:text-[#d8f0ee] hover:border-[#4ec9c0]/50',
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
