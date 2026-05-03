import type { ReactNode, CSSProperties } from 'react';

interface AppBackgroundProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function AppBackground({ children, className = '', style }: AppBackgroundProps) {
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
      <div className="relative z-10 flex flex-col" style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  );
}
