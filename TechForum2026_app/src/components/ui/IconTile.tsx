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
        className="font-ui font-bold text-[#d8f0ee] whitespace-nowrap drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
        style={{ fontSize: 'clamp(13px, 3.8vw, 16px)', lineHeight: 1.1, letterSpacing: '-0.005em' }}
      >
        {label}
      </span>
    </Link>
  );
}
