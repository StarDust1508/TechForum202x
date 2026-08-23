import { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
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
import Ticket from './pages/Ticket';
import Giveaways from './pages/Giveaways';
import Partners from './pages/Partners';
import Diagnostics from './pages/Diagnostics';
import About from './pages/About';
import MyRecords from './pages/MyRecords';
import NewsDetail from './pages/NewsDetail';
import Faq from './pages/Faq';
import Settings from './pages/Settings';
import SpeakerDetail from './pages/SpeakerDetail';
import UserProfile from './pages/UserProfile';
import MyCard from './pages/MyCard';
import Attendees from './pages/Attendees';
import { getCurrentLocalUser, isLocalAuthFallbackEnabled } from './lib/localAuth';
import { resolveApiUrl, authFetch } from './lib/runtimeEndpoint';
import { tryBiometricAutoLogin } from './lib/biometric';
import { prefetchPublicData } from './lib/prefetch';
import { attachPushListeners } from './lib/push';
import { ToastProvider, useToast } from './components/Toast';
import AppBackground from './components/AppBackground';
import OfflineBanner from './components/OfflineBanner';
import BrandLogo from './components/BrandLogo';
import BackButton from './components/BackButton';

const GUEST_KEY = 'techforum_guest_mode';

function GuestGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-full px-5" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <header className="flex items-center gap-3"><BackButton /><h1 className="font-display text-[24px] font-bold">Нужен вход</h1></header>
      <section className="mt-10 rounded-3xl border border-primary/30 bg-card p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10"><LockKeyhole className="h-7 w-7 text-primary" /></div>
        <h2 className="mt-5 font-display text-[19px] font-bold">Это личный раздел</h2>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/55">Войдите с email, на который куплен билет. Публичная программа и карточки спикеров доступны без регистрации.</p>
        <button type="button" onClick={onLogin} className="mt-6 w-full rounded-2xl bg-primary py-4 text-[15px] font-bold text-white active:scale-[0.98]">Войти</button>
      </section>
    </div>
  );
}


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
  const navigate = useNavigate();
  const toast = useToast();
  const showToast = toast.show;
  useHardwareBack();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isChatRoute = location.pathname === '/chat';

  useEffect(() => {
    let active = true;
    let detach = () => {};
    const openPushTarget = (data: Record<string, unknown>) => {
      if (!active) return;
      const type = String(data.type || '');
      if (type === 'news' && data.newsId) navigate(`/news/${encodeURIComponent(String(data.newsId))}`);
      else if (type === 'session' && data.sessionId) navigate(`/schedule?session=${encodeURIComponent(String(data.sessionId))}`);
      else if (type === 'dm') {
        const from = String(data.from || '').trim();
        navigate(from ? `/chat?dm=${encodeURIComponent(from)}` : '/chat');
      }
    };
    void attachPushListeners(
      (notification) => {
        if (!active) return;
        const text = [notification.title, notification.body].filter(Boolean).join(' · ');
        if (text) showToast(text, 4500);
      },
      openPushTarget,
    ).then((cleanup) => {
      if (active) detach = cleanup;
      else cleanup();
    });
    return () => { active = false; detach(); };
  }, [navigate, showToast]);

  // 100dvh и resize:body расходятся на iOS/Android при открытии клавиатуры.
  // visualViewport — фактическая видимая область над клавиатурой; единая CSS
  // переменная не даёт странице прыгать и исключает невидимый composer.
  useEffect(() => {
    let largestViewport = window.innerHeight;
    const syncViewport = () => {
      const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight);
      if (!document.activeElement?.matches('input, textarea, [contenteditable="true"]')) {
        largestViewport = Math.max(largestViewport, viewportHeight);
      }
      document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
      document.documentElement.classList.toggle('keyboard-open', largestViewport - viewportHeight > 120);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      document.documentElement.classList.remove('keyboard-open');
    };
  }, []);

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
        StatusBar.setBackgroundColor({ color: '#0f1118' }).catch(() => {});
        // WebView must start below the native status bar. Overlay mode was the
        // root cause of headers colliding with the clock/notch on both iOS and
        // edge-to-edge Android devices.
        StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      } catch {
        /* noop — плагин недоступен или web-окружение */
      }
    })();
  }, []);

  const enterGuestMode = () => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch { /* storage unavailable */ }
    setUser({ id: 'guest', name: 'Гость', interestsCount: 1, isGuest: true });
  };

  const leaveGuestMode = () => {
    try { localStorage.removeItem(GUEST_KEY); } catch { /* storage unavailable */ }
    setUser(null);
  };

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
        const res = await authFetch(resolveApiUrl('/me/interests'), {
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
        const res = await authFetch(meUrl);
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
        if (isMounted) {
          try {
            if (localStorage.getItem(GUEST_KEY) === '1') setUser({ id: 'guest', name: 'Гость', interestsCount: 1, isGuest: true });
          } catch { /* storage unavailable */ }
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
        if (isMounted) {
          try {
            if (localStorage.getItem(GUEST_KEY) === '1') setUser({ id: 'guest', name: 'Гость', interestsCount: 1, isGuest: true });
          } catch { /* storage unavailable */ }
        }
      } finally {
        const elapsed = Date.now() - startAt;
        const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => {
          if (isMounted) setLoading(false);
          const Cap: any = (window as any).Capacitor;
          if (Cap?.isNativePlatform?.()) {
            import('@capacitor/splash-screen').then(({ SplashScreen }) => {
              SplashScreen.hide().catch(() => {});
            }).catch(() => {});
          }
        }, wait);
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
      <div className="relative flex items-center justify-center overflow-hidden" style={{ height: 'var(--app-height, 100dvh)', backgroundColor: '#0f1118' }}>
        <div
          className="absolute bg-cover bg-no-repeat"
          style={{
            inset: '-50px',
            backgroundImage: 'url(/brand/auth-hero-2026-v2.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
          }}
        />
        <div className="absolute bg-gradient-to-t from-[#080b16] via-[#0b1020]/68 to-[#071323]/22" style={{ inset: '-50px' }} />
        <div className="relative z-10 flex flex-col items-center gap-4 animate-pulse px-8 text-center">
          <h1 className="w-full text-[clamp(18px,7vw,28px)]"><BrandLogo /></h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-accent/75">25–26 сентября · Москва</p>
        </div>
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
    <div className="flex min-w-0 flex-col overflow-hidden sm:items-center sm:justify-center p-0 sm:p-4 relative" style={{ height: 'var(--app-height, 100dvh)' }}>
      <OfflineBanner />
      <main className="w-full min-w-0 h-full min-h-0 sm:max-w-[420px] sm:h-[840px] relative overflow-hidden flex flex-col z-10 sm:rounded-[40px] sm:border-[8px] border-[#0d1117]">
        <div data-app-scroll-container className={`flex-1 min-h-0 min-w-0 scrollbar-hide relative ${isChatRoute ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          <div className={isChatRoute ? 'h-full min-h-0 min-w-0' : 'min-h-full min-w-0'}>
            {!user ? (
              // Auth имеет свой постер-фон, не оборачиваем в AppBackground.
              <Auth
                onSuccess={(nextUser) => { try { localStorage.removeItem(GUEST_KEY); } catch { /* noop */ } setUser(nextUser); }}
                onGuest={enterGuestMode}
              />
            ) : !user.isGuest && !user.interestsCount ? (
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
                    initial={{ opacity: 0, y: location.pathname === '/' ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                    className={isChatRoute ? 'h-full min-h-0 min-w-0 overflow-hidden' : 'min-h-full min-w-0 overflow-x-hidden'}
                  >
                    <Routes location={location}>
                      <Route path="/" element={<Home />} />
                      <Route path="/feed" element={<Feed />} />
                      <Route path="/news/:id" element={<NewsDetail />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/speakers" element={<Speakers />} />
                      <Route path="/map" element={<Map />} />
                      <Route path="/chat" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <Chat />} />
                      <Route path="/profile" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <Profile user={user} onUpdate={setUser} />} />
                      <Route path="/ticket" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <Ticket />} />
                      <Route path="/giveaways" element={<Giveaways />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/diagnostics" element={<Diagnostics />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/my-records" element={<MyRecords />} />
                      <Route path="/faq" element={<Faq />} />
                      <Route path="/settings" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <Settings />} />
                      <Route path="/speakers/:id" element={<SpeakerDetail />} />
                      <Route path="/users/:id" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <UserProfile />} />
                      <Route path="/my-card" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <MyCard />} />
                      <Route path="/attendees" element={user.isGuest ? <GuestGate onLogin={leaveGuestMode} /> : <Attendees />} />
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
  // basename берём из base сборки: web-PWA собирается с --base=/app/ (nginx-alias),
  // поэтому react-router должен знать префикс, иначе <Routes> не матчат пути и
  // залогиненный экран рендерится пустым. APK собирается с base=/ → basename
  // undefined (корень), поведение не меняется.
  const routerBase = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;
  return (
    <Router basename={routerBase}>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </Router>
  );
}
