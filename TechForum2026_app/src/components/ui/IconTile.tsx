import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';

interface IconTileProps {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

export default function IconTile({ to, label, icon: Icon }: IconTileProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center text-center gap-2.5 active:scale-95 transition-transform"
    >
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-[20px] border border-[#4ec9c0]/35 bg-[#0a2f38]/45 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(78,201,192,0.08),0_8px_22px_rgba(0,0,0,0.35)]">
        <Icon className="h-8 w-8 text-[#4ec9c0]" strokeWidth={1.5} />
      </span>
      <span
        className="font-display text-[#d8f0ee] tracking-[0.02em] whitespace-nowrap"
        style={{ fontSize: 'clamp(13px, 3.6vw, 15px)', lineHeight: 1.1 }}
      >
        {label}
      </span>
    </Link>
  );
}
