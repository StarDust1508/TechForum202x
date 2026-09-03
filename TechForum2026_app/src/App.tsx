import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
// BUG_FIX_CONTEXT: Откатил lazy/Suspense — каждый chunk подгружался с
// задержкой через Suspense fallback, юзер видел ре-рендер шрифта и
// «медленно грузит» при каждом переходе. APK assets всё равно локальные,
// экономия на code-split минимальна. Eager-импорты дают мгновенную
// навигацию между разделами.
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Feed from './pages/Feed';
import Schedule from './pages/Schedule';
import Speakers from './pages/Speakers';
import Map from './pages/Map';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';
import Attendees from './pages/Attendees';
import UserProfile from './pages/UserProfile';
import SpeakerDetail from './pages/SpeakerDetail';
import Faq from './pages/Faq';
import MyCard from './pages/MyCard';
import Ticket from './pages/Ticket';
import Giveaways from './pages/Giveaways';
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
        StatusBar.setBackgroundColor({ color: '#0a0e17' }).catch(() => {});
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      } catch {
        /* noop — плагин недоступен или web-окружение */
      }
    })();
  }, []);

  useEffect(() => {
    let isMounted = true;
    // BUG_FIX_CONTEXT: По требованию заказчика — при холодном старте APK юзер
    // должен встретить blueprint TechForum2026 на ~1 секунду, а не лого/белизну.
    // Делаем это через минимальный 1000ms блок Loader-экрана, который рендерит
    // тот же conference-bg.jpg что и Auth-панель. Параллельно идёт сетевой
    // /auth/me — если ответ пришёл раньше 1с, всё равно держим экран до 1с.
    const startAt = Date.now();
    const MIN_SPLASH_MS = 1000;

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

  if (loading) {
    // BUG_FIX_CONTEXT: Backdrop ушёл в body::before — loading screen теперь
    // просто прозрачный контейнер для минимального 1с ожидания. body::before
    // (CSS) красится мгновенно при загрузке стилей, никакого FOUC.
    return (
      <div className="relative" style={{ minHeight: '100dvh' }} />
    );
  }

  return (
    // BUG_FIX_CONTEXT: На мобильных (Samsung S25 / OnePlus 9R и т.п.) под main
    // оставалась чёрная полоса — main был h-[100dvh] (минус navbar) внутри
    // outer min-h-screen (100vh с navbar). На mobile теперь main растягивается
    // на 100% высоты родителя без явного h-[100dvh], а outer задаёт фиксированный
    // 100dvh с min-height 100vh fallback. На desktop (sm:) — старый поведение
    // с центрированной "телефонной" рамкой 420×840.
    <div className="flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 relative" style={{ minHeight: '100dvh', paddingTop: 'env(safe-area-inset-top, 0)' }}>
      <OfflineBanner />
      <main className="w-full sm:max-w-[420px] sm:h-[840px] shadow-[0_0_90px_rgba(0,255,255,0.2)] relative overflow-hidden flex flex-col z-10 sm:rounded-[40px] sm:border-[8px] border-[#0d1117]" style={{ flex: '1 1 auto', minHeight: '100dvh' }}>
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="min-h-full">
            {!user ? (
              // Auth имеет свой постер-фон, не оборачиваем в AppBackground.
              <Auth onSuccess={setUser} />
            ) : !user.interestsCount ? (
              // BUG_FIX_CONTEXT: показываем Onboarding если interestsCount === 0
              // ИЛИ undefined (legacy юзеры из старых билдов без поля). Onboarding
              // вызывает onDone(count) ТОЛЬКО после успешного PUT /me/interests
              // (источник истины — БД), мы получаем реальное число выбранных
              // интересов и используем его — на cold-start /auth/me вернёт то же.
              <Onboarding onDone={(count: number) => setUser({ ...user, interestsCount: count })} />
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
                      <Route path="/news/:id" element={<NewsDetail />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/speakers" element={<Speakers />} />
                      <Route path="/speakers/:id" element={<SpeakerDetail />} />
                      <Route path="/map" element={<Map />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/chat/:userId" element={<Chat />} />
                      <Route path="/attendees" element={<Attendees />} />
                      <Route path="/users/:id" element={<UserProfile />} />
                      <Route path="/profile" element={<Profile user={user} />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/faq" element={<Faq />} />
                      <Route path="/my-card" element={<MyCard />} />
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
  // The web PWA is served from /app, while native/dev builds still run at
  // the origin root. Pick the basename from the actual runtime path so both
  // deployments keep the same route definitions.
  const routerBasename = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
    ? '/app'
    : '/';
  return (
    <Router basename={routerBasename}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </Router>
  );
}
