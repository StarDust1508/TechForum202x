import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

interface IconTileProps {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

// HUD-folder-frame: октагональная рамка со срезанными углами и слабым внутренним
// контуром, бирюзовое свечение вокруг. Один SVG на плитку, glow через CSS
// drop-shadow (svg-filter дороже на Android WebView).
export default function IconTile({ to, label, icon: Icon }: IconTileProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
    >
      <span className="relative block h-[88px] w-[112px]">
        <svg
          viewBox="0 0 112 88"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ filter: 'drop-shadow(0 0 10px rgba(78,201,192,0.45))' }}
        >
          {/* Внешняя октагональная рамка (срезаны 4 угла, асимметричный «folder»-силуэт). */}
          <path
            d="M14 4 H88 L108 18 V62 L96 84 H22 L4 70 V22 Z"
            fill="rgba(3,22,28,0.55)"
            stroke="#4ec9c0"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Внутренний параллельный контур — двойная обводка как на эталоне. */}
          <path
            d="M19 9 H85 L102 21 V60 L93 79 H25 L9 67 V25 Z"
            fill="none"
            stroke="#4ec9c0"
            strokeOpacity="0.35"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
          {/* HUD-маркеры — точки на левом и правом боку. */}
          <circle cx="2" cy="46" r="1.6" fill="#4ec9c0" />
          <circle cx="110" cy="40" r="1.6" fill="#4ec9c0" />
          {/* Folder-tab-намёк — короткие разрывы в верхнем/нижнем рёбре. */}
          <line x1="44" y1="4" x2="60" y2="4" stroke="#03161c" strokeWidth="2.5" />
          <line x1="50" y1="84" x2="68" y2="84" stroke="#03161c" strokeWidth="2.5" />
          <line x1="44" y1="4" x2="60" y2="4" stroke="#4ec9c0" strokeOpacity="0.65" strokeWidth="1.2" />
          <line x1="50" y1="84" x2="68" y2="84" stroke="#4ec9c0" strokeOpacity="0.65" strokeWidth="1.2" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-9 w-9 text-[#4ec9c0]" strokeWidth={1.4} />
        </span>
      </span>
      <span
        className="font-display-cyrl text-[#d8f0ee] tracking-[0.02em] whitespace-nowrap"
        style={{ fontSize: 'clamp(13px, 3.6vw, 15px)', lineHeight: 1.1 }}
      >
        {label}
      </span>
    </Link>
  );
}
