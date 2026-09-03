import type { ReactNode } from 'react';
import BackButton from '@/src/components/BackButton';

interface PageShellProps {
  /** Большой H1 страницы. Если не задан, заголовок не рендерится. */
  title?: string;
  /** Маленький eyebrow над H1 (uppercase, accent). */
  kicker?: string;
  /** Подзаголовок под H1. */
  subtitle?: string;
  /** Скрыть BackButton (например, для главной). */
  hideBack?: boolean;
  /** Полностью скрыть header (для страниц где BackButton + сразу контент). */
  hideHeader?: boolean;
  /** Дополнительный JSX справа от заголовка (напр. кнопка-действие). */
  headerAction?: ReactNode;
  children: ReactNode;
  /** Классы внешнего <div>. */
  className?: string;
}

// Единый layout-каркас для всех внутренних страниц.
// Цели:
//  1. BackButton всегда на одной высоте: top = safe-area + 12px, left = 16px.
//  2. Заголовок страницы стоит на одинаковой вертикали: примерно safe-area + 60px.
//  3. Стандартный горизонтальный padding 24px.
//  4. Кикер (eyebrow) и subtitle одинаковые везде.
// Без него каждая страница изобретала свой top-padding, и кнопка «назад»
// прыгала на 8-30px от страницы к странице.
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
      className={`relative px-6 ${className}`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
        // SCROLL FIX (повторяющиеся жалобы): minHeight: 100lvh ушёл.
        // Раньше страница была жёстко >= 100lvh; в связке с flex-chain
        // в App.tsx длинный контент не мог «вылезти» за viewport, и
        // родительский scroll-container ничего не скроллил.
        // paddingBottom: 96px вместо 24px — гарантирует что хвост
        // последнего элемента не уезжает за Android nav-bar.
      }}
    >
      {!hideBack && <BackButton />}

      {showHeader && (
        <header className="mb-6 flex items-end justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {kicker && (
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#4ec9c0]/85 font-semibold">
                {kicker}
              </p>
            )}
            <h1 className="font-display-cyrl text-[34px] leading-[1.05] font-semibold text-[#d8f0ee] tracking-wide">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[12px] text-[#7aa8a4] leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0 mb-1">{headerAction}</div>}
        </header>
      )}

      {children}
    </div>
  );
}
