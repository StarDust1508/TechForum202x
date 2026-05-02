// FILE: src/components/AppBackground.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Единый фон для всех разделов приложения, идентичный главному экрану
//          (Home). Размытое фоновое изображение + два градиентных слоя поверх.
// SCOPE: Только UI-обёртка, без логики.
// INPUT: children — JSX контента раздела.
// OUTPUT: JSX с фоном на весь viewport (minHeight: 100dvh) и контентом сверху.
// KEYWORDS: DOMAIN(6): UIChrome; CONCEPT(7): SharedBackground; TECH(5): React, Tailwind
// LINKS: USED_BY(10): все pages кроме Auth (тот имеет свой conference-bg.jpg)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему отдельный компонент, а не CSS-класс?
// A: Нужны три DOM-слоя (img + gradient + radial), которые не выражаются одним
//    background CSS. Компонент даёт идентичный фон одной строкой импорта.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 - Унификация фона по всем разделам по требованию заказчика.]
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
  return (
    <div
      className={`relative overflow-hidden bg-[#04020f] ${className}`}
      style={{ minHeight: '100dvh', ...style }}
    >
      {/* Слой 1: размытое тех-фото в качестве текстуры */}
      <div className="absolute inset-0">
        <img
          src="/home-menu-reference.jpg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover scale-[1.03] opacity-20 blur-[5px] saturate-50"
        />
      </div>

      {/* Слой 2: вертикальный темный градиент для контраста */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,2,15,1)_0%,rgba(8,5,23,0.98)_30%,rgba(10,7,31,0.98)_60%,rgba(8,5,21,1)_100%)]" />

      {/* Слой 3: бирюзовое свечение сверху — фирменный акцент */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(20,184,166,0.28),transparent_45%)]" />

      {/* Контент */}
      <div className="relative z-10 flex flex-col" style={{ minHeight: '100dvh' }}>
        {children}
      </div>
    </div>
  );
}
