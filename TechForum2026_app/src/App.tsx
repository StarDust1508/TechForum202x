import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Home from './pages/Home';
import Feed from './pages/Feed';
import Schedule from './pages/Schedule';
import Speakers from './pages/Speakers';
import SpeakerDetail from './pages/SpeakerDetail';
import Map from './pages/Map';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
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
    // Splash минимально 1.4с при холодном старте; warm-restart (юзер свернул
    // и открыл в течение 30 минут) — без задержки, чтобы не было ощущения
    // тормоза. Метку времени держим в sessionStorage (живёт пока tab-контекст
    // не пересоздан, что для Capacitor WebView ≈ life of activity).
    const startAt = Date.now();
    let lastBootAt = 0;
    try { lastBootAt = parseInt(sessionStorage.getItem('techforum_last_boot') || '0', 10) || 0; } catch { /* noop */ }
    const isWarmRestart = lastBootAt > 0 && (Date.now() - lastBootAt) < 30 * 60 * 1000;
    try { sessionStorage.setItem('techforum_last_boot', String(Date.now())); } catch { /* noop */ }
    const MIN_SPLASH_MS = isWarmRestart ? 0 : 1400;

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
        } else if (res.status === 400) {
          // Бэк отверг данные (unknown_interest_ids, либо min(3) после
          // изменения схемы): pending содержит мусор, не зацикливаем
          // повторные cold-start попытки. Удаляем буфер.
          try { localStorage.removeItem('techforum_pending_interests'); } catch { /* noop */ }
        }
        // 401/5xx — оставляем pending до следующего cold-start.
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
    // SCROLL FIX 5/5 — РАДИКАЛЬНЫЙ.
    //
    // Раньше было: outer overflow-hidden flex-col → main overflow-hidden flex-col
    //              → scroll-div flex-1 overflow-y-auto → contents.
    // Этот flex-chain в WebView Android вёл себя нестабильно: иногда touch уходил
    // в nested context, иногда flex-shrink резал содержимое до viewport-height,
    // иногда implicit overflow на одном из wrappers создавал nested scroll.
    //
    // Теперь scroll НА BODY. Это самый стандартный и надёжный паттерн для
    // мобильного web/Capacitor:
    //   - body имеет естественный scroll (overflow:auto в html/body из CSS)
    //   - выше body нет flex-chain — туда не лезет shrink-поведение
    //   - touch-action управляется на body через index.css
    //
    // Outer-div теперь просто wrapper без всяких overflow / flex-col.
    // Padding безопасный area inset top/bottom — на самом контенте, не на wrapper.
    <div className="bg-[#03161c] relative">
      <OfflineBanner />
      <main
        className="w-full bg-[#03161c] relative z-10"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)',
        }}
      >
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
            <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
              <AppBackground>
                <Routes location={location}>
                  <Route path="/" element={<Home />} />
                  <Route path="/feed" element={<Feed />} />
                  <Route path="/news/:id" element={<NewsDetail />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/speakers" element={<Speakers />} />
                  <Route path="/speakers/:id" element={<SpeakerDetail />} />
                  <Route path="/map" element={<Map />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/chat/:userId" element={<Chat />} />
                  <Route path="/users/:userId" element={<UserProfile />} />
                  <Route path="/profile" element={<Profile user={user} />} />
                  <Route path="/ticket" element={<Ticket />} />
                  <Route path="/giveaways" element={<Giveaways />} />
                  <Route path="/partners" element={<Partners />} />
                  <Route path="/diagnostics" element={<Diagnostics />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/my-records" element={<MyRecords />} />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </AppBackground>
            </motion.div>
          )}
        </AnimatePresence>
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
