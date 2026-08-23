// FILE: src/components/OfflineBanner.tsx
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Глобальный баннер «Нет интернета» сверху экрана. Появляется
//          плавно при потере связи, исчезает при восстановлении. Заменяет
//          per-form ошибки "Failed to fetch" — юзер сразу видит источник
//          проблемы, не проваливается в технические сообщения.
// SCOPE: UI + системный hint online/offline + проверка доступности API.
// INPUT: Нет.
// OUTPUT: JSX (fixed top), либо null если онлайн.
// KEYWORDS: DOMAIN(6): UIChrome; CONCEPT(7): NetworkStatus; TECH(5): React
// LINKS: USED_BY(9): src/App.tsx (mount on AppContent root)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему одного navigator.onLine недостаточно?
// A: Android WebView кратковременно сообщает offline при смене VPN-маршрута,
//    хотя HTTPS API уже доступен. Поэтому системное событие — только сигнал
//    перепроверить сеть. Баннер показывается после двух неуспешных API-проб.
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { fetchWithTimeout, resolveApiUrl } from '@/src/lib/runtimeEndpoint';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const failuresRef = useRef(0);
  const probeIdRef = useRef(0);

  const verifyConnection = useCallback(async () => {
    const probeId = ++probeIdRef.current;
    try {
      const response = await fetchWithTimeout(resolveApiUrl('/health'), {
        method: 'GET',
        cache: 'no-store',
        headers: { 'x-connectivity-probe': '1' },
      }, 3_500);
      if (probeId !== probeIdRef.current) return;
      if (!response.ok) throw new Error(`health_${response.status}`);
      failuresRef.current = 0;
      setOffline(false);
    } catch {
      if (probeId !== probeIdRef.current) return;
      failuresRef.current += 1;
      // Не показываем ложную тревогу во время краткой перестройки VPN/DNS.
      if (failuresRef.current >= 2) setOffline(true);
    }
  }, []);

  useEffect(() => {
    let retryTimer: number | undefined;
    let offlinePoll: number | undefined;
    const clearRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const probeWithConfirmation = () => {
      clearRetry();
      void verifyConnection();
      retryTimer = window.setTimeout(() => { void verifyConnection(); }, 1_200);
    };
    const onOnline = () => {
      // Успешный системный сигнал сразу убирает устаревший баннер; API-проба
      // подтверждает состояние без визуальной задержки.
      failuresRef.current = 0;
      setOffline(false);
      probeWithConfirmation();
    };
    const onOffline = () => probeWithConfirmation();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // На старте и при уже показанном баннере проверяем именно рабочий API.
    void verifyConnection();
    offlinePoll = window.setInterval(() => {
      if (offline || !navigator.onLine) void verifyConnection();
    }, 8_000);
    return () => {
      clearRetry();
      if (offlinePoll !== undefined) window.clearInterval(offlinePoll);
      probeIdRef.current += 1;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [offline, verifyConnection]);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="pointer-events-none fixed left-3 right-3 z-[100] rounded-2xl border border-amber-300/30 bg-[#191711]/95 text-amber-50 shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold leading-snug">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Связь с сервером прервана. Показываем сохранённые данные.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
