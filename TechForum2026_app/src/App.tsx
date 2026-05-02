import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
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
import Partners from './pages/Partners';
import Diagnostics from './pages/Diagnostics';
import About from './pages/About';
import MyRecords from './pages/MyRecords';
import { getCurrentLocalUser, isLocalAuthFallbackEnabled } from './lib/localAuth';
import { resolveApiUrl } from './lib/runtimeEndpoint';


// Wire Android hardware back to React Router history.
// - Capacitor APK: uses window.Capacitor.Plugins.App.backButton event.
//   navigate back if there's history, else exitApp.
// - PWA / browser: native popstate already handles back; nothing to do.
function useHardwareBack() {
  useEffect(() => {
    const Capacitor: any = (window as any).Capacitor;
    const App = Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if (!App || typeof App.addListener !== 'function') return;

    let unsubscribe: (() => void) | undefined;
    const listenerPromise = App.addListener('backButton', () => {
      if (window.location.pathname !== '/' && window.history.length > 1) {
        window.history.back();
      } else if (typeof App.exitApp === 'function') {
        App.exitApp();
      }
    });
    Promise.resolve(listenerPromise)
      .then((handle: any) => {
        unsubscribe = () => {
          try { handle?.remove?.(); } catch {}
        };
      })
      .catch(() => {});
    return () => unsubscribe?.();
  }, []);
}

function AppContent() {
  const location = useLocation();
  useHardwareBack();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-[#04020f] flex flex-col items-center justify-center p-0 sm:p-4 overflow-hidden relative">
      <main className="w-full max-w-[420px] bg-[#04020f] h-[100dvh] sm:h-[840px] shadow-[0_0_90px_rgba(13,148,136,0.32)] relative overflow-hidden flex flex-col z-10 sm:rounded-[40px] sm:border-[8px] border-[#130b21]">
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="min-h-full">
            {!user ? (
              <Auth onSuccess={setUser} />
            ) : (
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
      <AppContent />
    </Router>
  );
}
