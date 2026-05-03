import type { CSSProperties } from 'react';

interface BrandTitleProps {
  className?: string;
  style?: CSSProperties;
}

export default function BrandTitle({ className = '', style }: BrandTitleProps) {
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
      <span className="block mt-1">2026</span>
    </h1>
  );
}
