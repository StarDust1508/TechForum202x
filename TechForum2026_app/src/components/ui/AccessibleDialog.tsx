import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const APP_BACK_REQUEST_EVENT = 'techforum:back-request';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function nextDialogFocusIndex(currentIndex: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (currentIndex < 0) return backwards ? count - 1 : 0;
  return (currentIndex + (backwards ? -1 : 1) + count) % count;
}

interface AccessibleDialogProps {
  open: boolean;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
  align?: 'bottom' | 'center';
}

export default function AccessibleDialog({
  open,
  titleId,
  descriptionId,
  onClose,
  children,
  panelClassName = '',
  align = 'center',
}: AccessibleDialogProps) {
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = document.getElementById('app-content');
    const previousInert = background?.inert ?? false;
    if (background) background.inert = true;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const focusables = () => [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return !element.hidden
          && !element.closest('[hidden], [aria-hidden="true"]')
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && element.getClientRects().length > 0;
      });
    window.requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>('[autofocus]');
      (preferred || focusables()[0] || panelRef.current)?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = nextDialogFocusIndex(currentIndex, items.length, event.shiftKey);
      const wouldLeave = currentIndex < 0
        || (!event.shiftKey && currentIndex === items.length - 1)
        || (event.shiftKey && currentIndex === 0);
      if (wouldLeave) {
        event.preventDefault();
        items[nextIndex]?.focus();
      }
    };
    const onBackRequest = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener(APP_BACK_REQUEST_EVENT, onBackRequest);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener(APP_BACK_REQUEST_EVENT, onBackRequest);
      if (background) background.inert = previousInert;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      window.requestAnimationFrame(() => previousFocus?.focus({ preventScroll: true }));
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[120] flex justify-center bg-black/65 p-3 backdrop-blur-sm ${align === 'bottom' ? 'items-end min-[480px]:items-center' : 'items-center'}`}
      role="presentation"
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={panelClassName}
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)', overscrollBehavior: 'contain' }}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
