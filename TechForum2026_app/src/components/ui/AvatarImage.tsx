import { useState } from 'react';

interface AvatarImageProps {
  src?: string | null;
  /** Имя для алт + первой буквы плейсхолдера. */
  name?: string | null;
  className?: string;
  /** Размер шрифта инициала (auto от className-h, override при необходимости). */
  letterClassName?: string;
}

/**
 * Аватар с устойчивым fallback. Старый код делал `e.currentTarget.style.display = 'none'`
 * (audit #20) — это оставляло пустую ячейку без буквы-плейсхолдера. Теперь:
 *  - Если src нет ИЛИ загрузка упала → рендерим только инициал.
 *  - Если src есть и загрузился → рендерим <img>, инициал скрыт.
 */
export default function AvatarImage({
  src,
  name,
  className = '',
  letterClassName = 'text-3xl',
}: AvatarImageProps) {
  const [errored, setErrored] = useState(false);
  const showImg = !!src && !errored;
  const letter = String(name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={`relative ${className}`}>
      {showImg && (
        <img
          src={src!}
          alt={name || 'avatar'}
          referrerPolicy="no-referrer"
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {!showImg && (
        <span className={`flex h-full w-full items-center justify-center font-display-cyrl font-semibold text-[#4ec9c0] select-none ${letterClassName}`}>
          {letter}
        </span>
      )}
    </div>
  );
}
