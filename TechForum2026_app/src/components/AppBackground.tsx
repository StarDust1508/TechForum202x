// FILE: src/components/AppBackground.tsx
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Единый brand-фон blueprint TechForum 2026 для всех разделов
//          (включая Auth). Размытое blueprint-изображение + градиентные слои.
// SCOPE: Только UI-обёртка, без логики.
// INPUT: children — JSX контента раздела.
// OUTPUT: JSX с фоном на весь viewport (minHeight: 100dvh) и контентом сверху.
// KEYWORDS: DOMAIN(6): UIChrome; CONCEPT(7): SharedBackground; TECH(5): React, Tailwind
// LINKS: USED_BY(10): все pages — Home, Feed, Schedule и т.д.
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 — Раньше use-кейс «фон Auth» и «фон разделов» были
//                       разными картинками (conference-bg.jpg vs
//                       home-menu-reference.jpg). По требованию заказчика
//                       фон един во всём приложении: blueprint conference-bg.jpg.
//                       На разделах он показан под более плотным dark-overlay
//                       и с большим масштабом, чтобы карточки разделов были
//                       читаемыми, но рисунок чертежа узнавался.]
// PREV_CHANGE_SUMMARY: [v1.0.0 — Унификация фона по всем разделам.]
// END_CHANGE_SUMMARY

import type { ReactNode, CSSProperties } from 'react';

interface AppBackgroundProps {
  children: ReactNode;
  /** Доп. классы для root (например, padding-overrides). */
  className?: string;
  /** inline style override (например padding-top для шапки). */
  style?: CSSProperties;
}

export default function AppBackground({ children, className = '', style }: AppBackgroundProps) {
  // BUG_FIX_CONTEXT: Раньше overflow:hidden на root ломал sticky-headers
  // в дочерних страницах (Home / Chat) — sticky CSS требует, чтобы ни один
  // ancestor не имел overflow:hidden/auto/scroll. Заменили на overflow-x-hidden
  // (только горизонтальный clip фоновых картинок), чтобы sticky работал.
  return (
    <div
      className={`relative overflow-x-hidden bg-[#04020f] ${className}`}
      style={{ minHeight: '100dvh', ...style }}
    >
      {/* BUG_FIX_CONTEXT: Раньше background был absolute и крутился вместе со
          скроллом — юзер видел "движение фона" + чёрную полосу при overscroll.
          Теперь все 3 слоя position: fixed inset-0 — фон ВСЕГДА покрывает
          весь viewport, не зависит от scroll. Контент прокручивается СВЕРХУ
          через z-10. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      >
        {/* Слой 1: blueprint TechForum 2026 — единый brand-фон.
            Масштаб 1.6 + смещение objectPosition → на разделах юзер видит
            чертёжные шестерёнки и сетку, а не текст из Auth. */}
        <img
          src="/conference-bg.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: 'scale(1.6)',
            transformOrigin: '60% 75%',
            objectPosition: '60% 75%',
            opacity: 0.22,
            filter: 'blur(6px) saturate(0.9)',
          }}
        />
        {/* Слой 2: вертикальный тёмный градиент для контраста */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,2,15,0.92)_0%,rgba(8,5,23,0.86)_30%,rgba(10,7,31,0.88)_60%,rgba(8,5,21,0.96)_100%)]" />
        {/* Слой 3: бирюзовое свечение сверху — фирменный акцент */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(20,184,166,0.22),transparent_45%)]" />
      </div>

      {/* Контент */}
      <div className="relative z-10 flex flex-col" style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  );
}
