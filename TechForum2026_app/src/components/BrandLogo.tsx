interface BrandLogoProps {
  className?: string;
  compact?: boolean;
  markOnly?: boolean;
}

/** Единый знак бренда «палочки» + адаптивный wordmark. */
export default function BrandLogo({ className = '', compact = false, markOnly = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${markOnly ? 'brand-logo--mark-only' : ''} ${className}`.trim()} aria-label="ТехнологИИ Права">
      <svg className="brand-logo__mark" viewBox="0 0 512 512" role="img" aria-hidden="true">
        <g fill="#49eaf2">
          <rect x="58" y="95" width="330" height="34" rx="17" />
          <rect x="58" y="171" width="330" height="34" rx="17" />
          <rect x="58" y="247" width="330" height="34" rx="17" />
          <circle cx="86" cy="326" r="23" />
          <circle cx="86" cy="402" r="23" />
          <circle cx="86" cy="478" r="23" />
        </g>
        <g fill="#f42aa8">
          <circle cx="426" cy="112" r="23" />
          <circle cx="426" cy="188" r="23" />
          <circle cx="426" cy="264" r="23" />
          <rect x="124" y="309" width="330" height="34" rx="17" />
          <rect x="124" y="385" width="330" height="34" rx="17" />
          <rect x="124" y="461" width="330" height="34" rx="17" />
        </g>
      </svg>
      {!markOnly && (
        <span className="brand-logo__wordmark" aria-hidden="true">
          <span className="brand-logo__technology">ТЕХНОЛОГ</span>
          <span className="brand-logo__ai">ИИ</span>
          <span className="brand-logo__law">ПРАВА</span>
        </span>
      )}
    </span>
  );
}
