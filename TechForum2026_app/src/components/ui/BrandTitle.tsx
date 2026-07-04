import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import { EVENT_BRAND, EVENT_YEAR } from '@/src/lib/event';

interface BrandTitleProps {
  className?: string;
  style?: CSSProperties;
  /** Год набирается посимвольно (Splash, Auth). На Home обычно false. */
  animateYear?: boolean;
  /** Компактный размер для Home, чтобы все 12 плиток влезли в экран. */
  compact?: boolean;
  /** Один ряд (BRAND YEAR через пробел) вместо двух — для узких слотов. */
  inline?: boolean;
}

export default function BrandTitle({ className = '', style, animateYear = true, compact = false, inline = false }: BrandTitleProps) {
  const sizeClamp = compact ? 'clamp(20px, 6vw, 28px)' : 'clamp(28px, 8.5vw, 44px)';
  const renderYear = animateYear
    ? EVENT_YEAR.split('').map((d, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.35 + i * 0.16, duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
          className="inline-block"
        >
          {d}
        </motion.span>
      ))
    : EVENT_YEAR;
  return (
    <h1
      className={`font-display text-center text-primary drop-shadow-[0_8px_28px_rgba(0,255,255,0.4)] ${className}`}
      style={{
        fontSize: sizeClamp,
        lineHeight: 0.95,
        fontWeight: 600,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {EVENT_BRAND}
      {inline ? (
        <> <span aria-label={EVENT_YEAR}>{renderYear}</span></>
      ) : (
        <span aria-label={EVENT_YEAR} className="block mt-1">{renderYear}</span>
      )}
    </h1>
  );
}
