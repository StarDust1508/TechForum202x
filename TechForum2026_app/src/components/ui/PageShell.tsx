import type { ReactNode } from 'react';
import BackButton from '@/src/components/BackButton';

interface PageShellProps {
  title?: string;
  kicker?: string;
  subtitle?: string;
  hideBack?: boolean;
  hideHeader?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function PageShell({
  title,
  subtitle,
  hideBack = false,
  hideHeader = false,
  headerAction,
  children,
  className = '',
}: PageShellProps) {
  const showHeader = !hideHeader && !!title;
  return (
    <div
      className={`relative px-6 ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {showHeader ? (
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!hideBack && <BackButton />}
            <div className="min-w-0">
              <h1
                className="font-display text-[28px] leading-none font-bold"
                style={{
                  background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-[12px] text-foreground/40 leading-relaxed mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      ) : (
        !hideBack && <div className="mb-4"><BackButton /></div>
      )}

      {children}
    </div>
  );
}
