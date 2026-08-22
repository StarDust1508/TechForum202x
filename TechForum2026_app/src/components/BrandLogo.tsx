interface BrandLogoProps {
  className?: string;
  compact?: boolean;
  markOnly?: boolean;
}

/** Единый знак бренда «Т–ИИ архитектура» + адаптивный wordmark. */
export default function BrandLogo({ className = '', compact = false, markOnly = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${compact ? 'brand-logo--compact' : ''} ${markOnly ? 'brand-logo--mark-only' : ''} ${className}`.trim()} aria-label="ТехнологИИ Права">
      <svg className="brand-logo__mark" viewBox="0 0 512 512" role="img" aria-hidden="true">
        <g fill="#49eaf2">
          <path d="M76 84h360v64H288v228l-32 16-32-16V148H76z" />
          <path d="M76 166h72v164l78 42-48 52-102-50z" />
          <path d="M436 166h-72v164l-78 42 48 52 102-50z" />
        </g>
        <g fill="#f42aa8">
          <path d="M166 230l54-46v172l-54 20z" />
          <path d="M346 230l-54-46v172l54 20z" />
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
