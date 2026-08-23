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
  kicker,
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
      className={`relative mx-auto w-full max-w-[44rem] px-4 min-[360px]:px-5 ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}
    >
      {showHeader ? (
        <header
          className="sticky top-0 z-20 -mx-4 mb-6 flex items-start justify-between gap-3 border-b border-border/60 bg-background/92 px-4 pb-3 pt-1 backdrop-blur-xl min-[360px]:-mx-5 min-[360px]:px-5"
        >
          <div className="flex items-center gap-3 min-w-0">
            {!hideBack && <BackButton />}
            <div className="min-w-0 pt-0.5">
              {kicker && (
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
                  {kicker}
                </p>
              )}
              <h1
                className="font-display text-[clamp(24px,7vw,30px)] font-bold leading-[1.08] [overflow-wrap:anywhere]"
                style={{
                  background: 'linear-gradient(135deg, #ff3399 0%, #ff66b2 50%, #00ffff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-[14px] leading-snug text-foreground/60">
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
