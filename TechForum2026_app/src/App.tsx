import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Home from './pages/Home';
import Feed from './pages/Feed';
import Schedule from './pages/Schedule';
import Speakers from './pages/Speakers';
import Map from './pages/Map';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Ticket from './pages/Ticket';
import Giveaways from './pages/Giveaways';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Partners from './pages/Partners';
import Diagnostics from './pages/Diagnostics';
import About from './pages/About';
import MyRecords from './pages/MyRecords';
import { getCurrentLocalUser, isLocalAuthFallbackEnabled } from './lib/localAuth';
import { resolveApiUrl } from './lib/runtimeEndpoint';
import { ToastProvider, useToast } from './components/Toast';
import AppBackground from './components/AppBackground';


// BUG_FIX_CONTEXT: v1 проверял `window.history.length > 1` чтобы решить:
// идти назад или выйти. Но Capacitor WebView иногда не увеличивает
// history.length после navigate, и фактически back ВСЕГДА выходил из приложения
// (что юзер и видел). Сейчас решение по pathname: на любом разделе кроме `/`
// делаем navigate(-1) (React Router сам корректно идёт назад). На `/` — double-tap
// to exit с фирменным toast: "Нажмите ещё раз для выхода".
function useHardwareBack() {
  const navigate = useNavigate();
  const toast = useToast();
  const lastBackPress = useRef<number>(0);

  useEffect(() => {
    const Capacitor: any = (window as any).Capacitor;
    const CapApp = Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (!CapApp || typeof CapApp.addListener !== 'function') return;

    let unsubscribe: (() => void) | undefined;
    const listenerPromise = CapApp.addListener('backButton', () => {
      if (window.location.pathname !== '/') {
        navigate(-1);
        return;
      }
      // На главном экране — double-tap to exit
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        if (typeof CapApp.exitApp === 'function') CapApp.exitApp();
      } else {
        lastBackPress.current = now;
        toast.show('Нажмите ещё раз для выхода', 1800);
      }
    });
    Promise.resolve(listenerPromise)
      .then((handle: any) => {
        unsubscribe = () => {
          try { handle?.remove?.(); } catch { /* noop */ }
        };
      })
      .catch(() => {});
    return () => unsubscribe?.();
  }, [navigate, toast]);
}

function AppContent() {
  const location = useLocation();
  useHardwareBack();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // BUG_FIX_CONTEXT: Samsung S25 / OnePlus 9R показывали системный status-bar
  // с дефолтным светлым иконками поверх тёмного фона приложения — иконки
  // были невидимы. Также при overlay-режиме возникала наложка контента под
  // строкой состояния. Конфигурируем native StatusBar через Capacitor:
  // непрозрачный, цвет #04020f (как фон app), стиль Dark (светлые иконки).
  // Feature-detect через window.Capacitor — на web (vite dev) импорт плагина
  // не должен падать, поэтому загружаем динамически и тихо игнорируем ошибки.
  useEffect(() => {
    const Capacitor: any = (window as any).Capacitor;
    if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
      return;
    }
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#04020f' }).catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      } catch {
        /* noop — плагин недоступен или web-окружение */
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const meUrl = resolveApiUrl('/auth/me');
        const res = await fetch(meUrl, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUser(data);
          return;
        }

        if (isLocalAuthFallbackEnabled()) {
          try {
            const localUser = getCurrentLocalUser();
            if (localUser && isMounted) setUser(localUser);
          } catch (fallbackError) {
            console.error('Local auth check failed', fallbackError);
          }
        }
      } catch (error) {
        console.error('Auth check failed', error);
        if (isLocalAuthFallbackEnabled()) {
          try {
            const localUser = getCurrentLocalUser();
            if (localUser && isMounted) setUser(localUser);
          } catch (fallbackError) {
            console.error('Local auth check failed', fallbackError);
          }
        }
      } finally {
        // BUG_FIX_CONTEXT: v1 искусственно держал splash минимум 1500ms.
        // По требованию заказчика splash убран полностью — переходим в Auth/Home
        // мгновенно после ответа /auth/me. Минимальный спиннер на брендовом
        // фоне сохраняется на время сетевого вызова, чтобы не было FOUC.
        if (isMounted) setLoading(false);
      }
    };

    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04020f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#5eead4]/40 border-t-[#5eead4] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    // BUG_FIX_CONTEXT: На мобильных (Samsung S25 / OnePlus 9R и т.п.) под main
    // оставалась чёрная полоса — main был h-[100dvh] (минус navbar) внутри
    // outer min-h-screen (100vh с navbar). На mobile теперь main растягивается
    // на 100% высоты родителя без явного h-[100dvh], а outer задаёт фиксированный
    // 100dvh с min-height 100vh fallback. На desktop (sm:) — старый поведение
    // с центрированной "телефонной" рамкой 420×840.
    <div className="bg-[#04020f] flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden relative" style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0)' }}>
      <main className="w-full sm:max-w-[420px] bg-[#04020f] sm:h-[840px] shadow-[0_0_90px_rgba(13,148,136,0.32)] relative overflow-hidden flex flex-col z-10 sm:rounded-[40px] sm:border-[8px] border-[#130b21]" style={{ flex: '1 1 auto', minHeight: '100dvh' }}>
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="min-h-full">
            {!user ? (
              // Auth имеет свой постер-фон, не оборачиваем в AppBackground.
              <Auth onSuccess={setUser} />
            ) : user.interestsCount === 0 ? (
              // BUG_FIX_CONTEXT: первый вход — показываем onboarding ПОВЕРХ
              // routes, чтобы пользователь не мог промахнуться. После onDone
              // обновляем interestsCount локально (без повторного /auth/me).
              <Onboarding onDone={() => setUser({ ...user, interestsCount: (user.interestsCount ?? 0) + 1 })} />
            ) : (
              // Все остальные разделы — единый фон Home (требование заказчика).
              <AppBackground>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, x: location.pathname === '/' ? 0 : 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: location.pathname === '/' ? 0 : -16 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className="min-h-full"
                  >
                    <Routes location={location}>
                      <Route path="/" element={<Home />} />
                      <Route path="/feed" element={<Feed />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/speakers" element={<Speakers />} />
                      <Route path="/map" element={<Map />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/profile" element={<Profile user={user} />} />
                      <Route path="/ticket" element={<Ticket />} />
                      <Route path="/giveaways" element={<Giveaways />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/diagnostics" element={<Diagnostics />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/my-records" element={<MyRecords />} />
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                  </motion.div>
                </AnimatePresence>
              </AppBackground>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </Router>
  );
}
