import type { ReactNode, CSSProperties } from 'react';

interface AppBackgroundProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function AppBackground({ children, className = '', style }: AppBackgroundProps) {
  // SCROLL FIX (4-я итерация — наконец нашёл):
  //
  // Раньше outer-div имел `overflow-x-hidden` + `minHeight: 100dvh`.
  // По спеке CSS, когда у элемента указан `overflow-x: hidden` без явного
  // `overflow-y`, браузер ВЫЧИСЛЯЕТ `overflow-y: auto` (одной axis нельзя
  // быть hidden если другая visible — implicit auto). Это значит:
  // AppBackground становился ВТОРЫМ scroll-контейнером внутри App.tsx
  // scroll-контейнера. Touch-events ловил вложенный AppBackground (он
  // 100dvh по minHeight, контент в него умещался → нечего скроллить),
  // App.tsx scroll-container никогда не получал свайп.
  //
  // Решение: убрать `overflow-x-hidden` и `minHeight: 100dvh`. Фон
  // покрывается через `position: fixed` дочерним div'ом — он живёт в
  // viewport независимо от высоты outer-обёртки.
  return (
    <div
      className={`relative bg-[#03161c] ${className}`}
      style={style}
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
