import { X as XIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** Override target — defaults to navigate(-1). */
  to?: string;
  /** Optional aria-label override. */
  label?: string;
}

/**
 * «Закрыть» кнопка в правом-верхнем углу — статичная, не скроллится.
 *
 * Был: ArrowLeft слева, position: fixed top-left. Жалоба юзера:
 *   1) на длинных страницах при scroll вниз кнопка иногда исчезала
 *      (на самом деле причина была в parent-overflow контейнерах,
 *      не в самом BackButton; но симптом наблюдался)
 *   2) логичнее в правом-верхнем (как у Eventicious-эталона) — там же
 *      рядом cog настроек на Home → визуально правый-верхний угол =
 *      «выход / меню».
 *
 * Round 8: переехала на right-4 + крестик X, position fixed относительно
 * viewport (z-50 чтобы перекрывала всё включая bottom-sheet'ы).
 *
 * Tap → navigate(-1). На Android система back-button делает то же
 * через popstate (в App.tsx hook'нуто).
 */
export default function BackButton({ to, label = 'Назад' }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="fixed right-4 z-50 h-10 w-10 flex items-center justify-center rounded-full border border-[#4ec9c0]/35 bg-[#03161c]/75 backdrop-blur-md text-[#4ec9c0] hover:text-[#d8f0ee] hover:border-[#4ec9c0]/60 hover:bg-[#0a2f38]/85 active:scale-90 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <XIcon className="h-4 w-4" strokeWidth={2.2} />
    </button>
  );
}
