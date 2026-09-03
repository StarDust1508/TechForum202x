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
  // BUG_FIX_CONTEXT: blueprint-фон вынесен на body::before/::after в index.css
  // (fixed inset-0, z-index: -1) — он покрывает viewport ВСЕГДА: на любой
  // странице, при overscroll, при keyboard show. AppBackground оставлен как
  // прозрачная обёртка-маркер для совместимости импортов страниц.
  return (
    <div
      className={`relative ${className}`}
      style={{ minHeight: '100dvh', ...style }}
    >
      <div className="relative z-10 flex flex-col" style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  );
}
