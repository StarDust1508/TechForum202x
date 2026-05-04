// FILE: src/components/OfflineBanner.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Глобальный баннер «Нет интернета» сверху экрана. Появляется
//          плавно при потере связи, исчезает при восстановлении. Заменяет
//          per-form ошибки "Failed to fetch" — юзер сразу видит источник
//          проблемы, не проваливается в технические сообщения.
// SCOPE: Только UI + подписка на window online/offline events.
// INPUT: Нет.
// OUTPUT: JSX (fixed top), либо null если онлайн.
// KEYWORDS: DOMAIN(6): UIChrome; CONCEPT(7): NetworkStatus; TECH(5): React
// LINKS: USED_BY(9): src/App.tsx (mount on AppContent root)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему navigator.onLine, а не периодический ping /health?
// A: navigator.onLine надёжен на мобильных (Android/iOS) — событие
//    срабатывает мгновенно при выключении WiFi/мобильных данных. Ping-based
//    подход порождает false-positive при медленной сети + тратит трафик.
//    На WebView Android navigator.onLine синхронен с системой.
//
// Q: Почему position fixed top, а не toast?
// A: Toast исчезает по таймауту — юзер может пропустить. Persistent banner
//    держится до восстановления. На конференции с непостоянным WiFi это
//    важная подсказка.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 — Первичная реализация: online/offline events +
//                       AnimatePresence + safe-area-inset-top для notch.]
// END_CHANGE_SUMMARY

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Sync на mount — навигация / hot-reload могли пропустить event.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed left-0 right-0 z-[100] bg-rose-500/95 backdrop-blur-md text-[#d8f0ee] shadow-[0_8px_28px_rgba(244,63,94,0.35)]"
          style={{
            top: 0,
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            paddingBottom: 10,
          }}
          role="alert"
        >
          <div className="flex items-center justify-center gap-2 px-4 text-[14px] font-semibold tracking-[0.01em]">
            <WifiOff className="w-[18px] h-[18px]" />
            <span>Нет интернета — не все данные могут загрузиться</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
