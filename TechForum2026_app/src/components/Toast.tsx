// FILE: src/components/Toast.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Лёгкий toast-уведомление в фирменной бирюзовой стилистике, появляется
//          снизу экрана и исчезает через timeout (или по клику).
// SCOPE: Один компонент + хук useToast() для глобального вызова.
// INPUT: message: string, durationMs?: number (default 1800).
// OUTPUT: Floating UI элемент над всем контентом (z-[300]).
// KEYWORDS: DOMAIN(5): UIFeedback; CONCEPT(7): Notification; TECH(6): React, Motion
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему не react-hot-toast / sonner?
// A: +30KB зависимость для одного use-case (double-tap to exit). Тут 50 строк.
// END_RATIONALE

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface ToastState {
  id: number;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const show = useCallback((message: string, durationMs = 1800) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, durationMs }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed left-0 right-0 z-[300] flex flex-col items-center gap-2 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 32, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.94 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              onClick={() => dismiss(t.id)}
              onAnimationComplete={() => {
                setTimeout(() => dismiss(t.id), t.durationMs);
              }}
              className="pointer-events-auto rounded-2xl bg-[#13161f]/95 backdrop-blur-md border border-[#5eead4]/30 px-5 py-3 shadow-[0_8px_28px_rgba(94,234,212,0.18)] text-[13px] font-semibold text-white/95 max-w-[90vw]"
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Безопасный fallback — если провайдер не установлен (например, при изолированном
    // тесте компонента), просто не падаем.
    return { show: () => {} };
  }
  return ctx;
}
