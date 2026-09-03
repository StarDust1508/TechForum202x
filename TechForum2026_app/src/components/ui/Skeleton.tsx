import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** Высота, если не задана через className. */
  height?: number | string;
  /** Ширина, если не задана через className. */
  width?: number | string;
}

// Простая shimmer-плашка в палитре blueprint. Линейный градиент анимирован
// через background-position. Без motion, чтобы не плодить инстансы для длинных
// списков (Schedule может рендерить 30+ скелетонов одновременно).
export default function Skeleton({ className = '', style, height, width }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[10px] bg-[#0a2f38]/55 ${className}`}
      style={{
        height,
        width,
        backgroundImage:
          'linear-gradient(90deg, rgba(78,201,192,0) 0%, rgba(78,201,192,0.10) 50%, rgba(78,201,192,0) 100%)',
        backgroundSize: '200% 100%',
        animation: 'tfSkeleton 1.4s ease-in-out infinite',
        ...style,
      }}
    >
      <style>{`@keyframes tfSkeleton { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}

export function SkeletonText({ lines = 1, widths }: { lines?: number; widths?: string[] }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={widths?.[i] ?? '100%'} />
      ))}
    </div>
  );
}
