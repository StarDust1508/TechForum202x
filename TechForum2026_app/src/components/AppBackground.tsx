import type { ReactNode, CSSProperties } from 'react';

interface AppBackgroundProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function AppBackground({ children, className = '', style }: AppBackgroundProps) {
  // CRITICAL SCROLL FIX: убрал внутренний flex flex-col + minHeight:100dvh
  // wrapper. Из-за него каждая страница (PageShell c minHeight:100lvh)
  // была flex-item внутри AppBackground, и flex-shrink резал её обратно
  // до viewport-height — длинный контент Feed/Schedule/Speakers/Partners
  // не мог "вылезти" наружу для родительского scroll-container в App.tsx.
  // Теперь просто relative wrapper, контент растёт по нужде, App.tsx
  // overflow-y-auto скроллит как ожидается.
  return (
    <div
      className={`relative overflow-x-hidden bg-[#03161c] ${className}`}
      style={{ minHeight: '100dvh', ...style }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <img
          src="/blueprint-bg.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(78,201,192,0.10),transparent_55%)]" />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
