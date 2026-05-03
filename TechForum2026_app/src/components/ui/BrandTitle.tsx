import type { CSSProperties } from 'react';
import { motion } from 'motion/react';

interface BrandTitleProps {
  className?: string;
  style?: CSSProperties;
  /** При true — год набирается посимвольно (Splash, Auth). На Home лучше false. */
  animateYear?: boolean;
}

// Год вынесен в константу: ровно одно место для апдейта при ребрендинге раз в полгода.
const EVENT_YEAR = '2026';

export default function BrandTitle({ className = '', style, animateYear = true }: BrandTitleProps) {
  return (
    <h1
      className={`font-display text-center text-[#d8f0ee] drop-shadow-[0_8px_28px_rgba(78,201,192,0.4)] ${className}`}
      style={{
        fontSize: 'clamp(40px, 12.5vw, 60px)',
        lineHeight: 0.95,
        fontWeight: 600,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      TechForum
      <span aria-label={EVENT_YEAR} className="block mt-1">
        {animateYear
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
          : EVENT_YEAR}
      </span>
    </h1>
  );
}
