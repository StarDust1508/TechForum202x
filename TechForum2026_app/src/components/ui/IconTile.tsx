import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import HudFrame from './HudFrame';

interface IconTileProps {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

export default function IconTile({ to, label, icon: Icon }: IconTileProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
    >
      <HudFrame size={{ w: 112, h: 88 }}>
        <Icon className="h-9 w-9 text-[#4ec9c0]" strokeWidth={1.4} />
      </HudFrame>
      <span
        className="font-display-cyrl text-[#d8f0ee] tracking-[0.02em] whitespace-nowrap"
        style={{ fontSize: 'clamp(13px, 3.6vw, 15px)', lineHeight: 1.1 }}
      >
        {label}
      </span>
    </Link>
  );
}
