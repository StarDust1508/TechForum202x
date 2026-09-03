import type { ReactNode, CSSProperties } from 'react';

interface HudFrameProps {
  children?: ReactNode;
  /** width × height in px, also used as svg viewBox. */
  size?: { w: number; h: number };
  className?: string;
  style?: CSSProperties;
  /** Цвет рамки и свечения. По умолчанию accent. */
  tone?: string;
  /** Полупрозрачная заливка фона рамки. */
  fillOpacity?: number;
  /** Сила drop-shadow glow вокруг (px blur). 0 — без glow. */
  glow?: number;
}

// HUD-folder-frame: октагональная рамка со срезанными углами + внутренний
// параллельный контур + точки-маркеры + folder-tab разрывы. Один SVG, glow
// через CSS drop-shadow. Используется в IconTile (плитки Home), Profile-аватар,
// и любых местах где нужна brand-рамка.
export default function HudFrame({
  children,
  size = { w: 112, h: 88 },
  className = '',
  style,
  tone = '#4ec9c0',
  fillOpacity = 0.55,
  glow = 10,
}: HudFrameProps) {
  const { w, h } = size;
  // Параметры рамки масштабируются от размера, чтобы пропорции «угла» сохранялись.
  const cut = Math.round(Math.min(w, h) * 0.18);
  return (
    <span className={`relative inline-block ${className}`} style={{ width: w, height: h, ...style }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={glow > 0 ? { filter: `drop-shadow(0 0 ${glow}px ${tone}66)` } : undefined}
      >
        <path
          d={`M${cut} 4 H${w - cut} L${w - 4} ${cut} V${h - cut} L${w - cut + 4} ${h - 4} H${cut * 1.6} L4 ${h - cut} V${cut * 1.2} Z`}
          fill={`rgba(3,22,28,${fillOpacity})`}
          stroke={tone}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d={`M${cut + 5} 9 H${w - cut - 3} L${w - 10} ${cut + 3} V${h - cut - 2} L${w - cut - 3} ${h - 9} H${cut * 1.6 + 3} L9 ${h - cut - 3} V${cut * 1.2 + 3} Z`}
          fill="none"
          stroke={tone}
          strokeOpacity="0.35"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <circle cx="2" cy={h * 0.55} r="1.6" fill={tone} />
        <circle cx={w - 2} cy={h * 0.45} r="1.6" fill={tone} />
        <line x1={w * 0.4} y1="4" x2={w * 0.55} y2="4" stroke="#03161c" strokeWidth="2.5" />
        <line x1={w * 0.45} y1={h - 4} x2={w * 0.6} y2={h - 4} stroke="#03161c" strokeWidth="2.5" />
        <line x1={w * 0.4} y1="4" x2={w * 0.55} y2="4" stroke={tone} strokeOpacity="0.65" strokeWidth="1.2" />
        <line x1={w * 0.45} y1={h - 4} x2={w * 0.6} y2={h - 4} stroke={tone} strokeOpacity="0.65" strokeWidth="1.2" />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center">
          {children}
        </span>
      )}
    </span>
  );
}
