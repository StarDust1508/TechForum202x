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
import NewsDetail from './pages/NewsDetail';
import { getCurrentLocalUser, isLocalAuthFallbackEnabled } from './lib/localAuth';
import { resolveApiUrl } from './lib/runtimeEndpoint';
import { tryBiometricAutoLogin } from './lib/biometric';
import { prefetchPublicData } from './lib/prefetch';
import { ToastProvider, useToast } from './components/Toast';
import AppBackground from './components/AppBackground';
import OfflineBanner from './components/OfflineBanner';
import Splash from './components/Splash';


// BUG_FIX_CONTEXT: ROOT-CAUSE hardware back exits — пакет @capacitor/app не
// был установлен через npm, поэтому Capacitor.Plugins.App был undefined,
// listener не подписывался, и Activity получала back-event на нативном уровне
// → exit. Теперь импортируем App напрямую (модуль гарантированно подключён),
// и используем navigate(-1) с fallback на navigate('/') если стека нет.
function useHardwareBack() {
  const navigate = useNavigate();
  const toast = useToast();
  const lastBackPress = useRef<number>(0);

  useEffect(() => {
    const Capacitor: any = (window as any).Capacitor;
    if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
      return;
    }
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const handle = await CapApp.addListener('backButton', () => {
          if (window.location.pathname !== '/') {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/');
            }
            return;
          }
          // На главном экране — double-tap to exit
          const now = Date.now();
          if (now - lastBackPress.current < 2000) {
            CapApp.exitApp().catch(() => {});
          } else {
            lastBackPress.current = now;
            toast.show('Нажмите ещё раз для выхода', 1800);
          }
        });
        unsubscribe = () => { handle.remove().catch(() => {}); };
      } catch (err) {
        console.warn('[hardwareBack] failed to subscribe', err);
      }
    })();
    return () => unsubscribe?.();
  }, [navigate, toast]);
}

function AppContent() {
  const location = useLocation();
  useHardwareBack();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Native StatusBar — тёмный blueprint-фон, светлые иконки.
  useEffect(() => {
    const Capacitor: any = (window as any).Capacitor;
    if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
      return;
    }
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: '#03161c' }).catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      } catch { /* web env */ }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;
    // Минимальное время Splash-экрана при холодном старте — 1.4с,
    // чтобы юзер успел увидеть brand-полотно + анимацию свечения.
    const startAt = Date.now();
    const MIN_SPLASH_MS = 1400;

    // BUG_FIX_CONTEXT: П6 — рандомный сброс на онбординг. Onboarding раньше
    // делал PUT /me/interests fire-and-forget, и если запрос падал, выбор
    // оставался ТОЛЬКО в localStorage. /auth/me возвращал interestsCount=0,
    // юзер видел онбординг снова. Теперь Onboarding пишет pending-копию в
    // localStorage и только при 200 OK от сервера её удаляет. Здесь, на
    // boot после успешного /auth/me, дочищаем хвост: если pending есть и
    // сервер сейчас доступен — повторяем PUT.
    const retryPendingInterests = async (): Promise<void> => {
      let pendingRaw: string | null = null;
      try { pendingRaw = localStorage.getItem('techforum_pending_interests'); }
      catch { return; }
      if (!pendingRaw) return;
      let interestIds: string[] = [];
      try { interestIds = JSON.parse(pendingRaw); }
      catch { try { localStorage.removeItem('techforum_pending_interests'); } catch { /* noop */ } return; }
      if (!Array.isArray(interestIds) || interestIds.length === 0) {
        try { localStorage.removeItem('techforum_pending_interests'); } catch { /* noop */ }
        return;
      }
      try {
        const res = await fetch(resolveApiUrl('/me/interests'), {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interestIds }),
        });
        if (res.ok) {
          try { localStorage.removeItem('techforum_pending_interests'); } catch { /* noop */ }
          if (isMounted) {
            setUser((prev: any) => prev ? { ...prev, interestsCount: interestIds.length } : prev);
          }
        }
      } catch { /* offline — попробуем на следующем cold-start */ }
    };

    const checkAuth = async () => {
      try {
        // Пока крутится splash — параллельно прогреваем HTTP-кэш для
        // публичных данных программы. К моменту входа в Home /sessions,
        // /speakers и т.д. уже в WebView-кэше → мгновенный рендер.
        prefetchPublicData();

        const meUrl = resolveApiUrl('/auth/me');
        const res = await fetch(meUrl, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUser(data);
          // Если БД говорит 0 интересов, но в localStorage висит pending —
          // это та самая забуксовавшая запись из Onboarding. Дошлём.
          if (data && (!data.interestsCount || data.interestsCount === 0)) {
            void retryPendingInterests();
          }
          return;
        }

        // /auth/me=401 → сессия в БД истекла или её никогда не было.
        // Если юзер ранее включил биометрию — пробуем тихий auto-login.
        // BUG_FIX_CONTEXT: Делаем это ДО local-auth fallback и ПОСЛЕ
        // проверки cookie-сессии — чтобы кейс "сессия жива" не требовал
        // лишнего BiometricPrompt при каждом старте.
        const bioUser = await tryBiometricAutoLogin();
        if (bioUser && isMounted) {
          setUser(bioUser);
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
        const elapsed = Date.now() - startAt;
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => { if (isMounted) setLoading(false); }, wait);
      }
    };

    void checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-[#03161c] flex flex-col p-0 overflow-hidden relative" style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0)' }}>
      <OfflineBanner />
      <main className="w-full bg-[#03161c] relative overflow-hidden flex flex-col z-10" style={{ flex: '1 1 auto', minHeight: '100dvh' }}>
        {/* min-h-0 на flex-child обязательно — без него overflow-y-auto не
            активируется в flex-контексте (flex по умолчанию даёт
            min-height: auto, и контейнер растёт по контенту вместо скролла).
            paddingBottom учитывает Android navigation bar / iOS home indicator,
            чтобы хвост Schedule/Feed/Partners/Map/Chat не обрезался. */}
        <div
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide relative"
          style={{
            overscrollBehavior: 'none',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }}
        >
          <div className="min-h-full">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div key="splash" exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
                  <Splash />
                </motion.div>
              ) : !user ? (
                <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <Auth onSuccess={setUser} />
                </motion.div>
              ) : !user.interestsCount ? (
                <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <Onboarding onDone={(count: number) => setUser({ ...user, interestsCount: count })} />
                </motion.div>
              ) : (
                <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
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
                          <Route path="/news/:id" element={<NewsDetail />} />
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
                </motion.div>
              )}
            </AnimatePresence>
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
