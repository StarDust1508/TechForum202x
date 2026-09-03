import { useSyncExternalStore } from 'react';
import { fetchWithTimeout, resolveApiUrl } from './runtimeEndpoint';
import { APP_CONTENT_CACHE_KEY, createAppContentStore } from './appContentStore';

export { DEFAULT_APP_CONTENT, type AppContent } from './appContentStore';

const store = createAppContentStore({
  load: async () => {
    const response = await fetchWithTimeout(resolveApiUrl('/app-content'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`App content: ${response.status}`);
    return response.json();
  },
  readCache: () => localStorage.getItem(APP_CONTENT_CACHE_KEY),
  writeCache: (value) => localStorage.setItem(APP_CONTENT_CACHE_KEY, value),
});

let subscribers = 0;
let stopRefresh = () => {};

function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  if (++subscribers === 1 && typeof window !== 'undefined') {
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'hidden') void store.refresh();
    };
    // Returning from another app, network changes, and an already-open screen.
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    refreshWhenVisible();
    stopRefresh = () => {
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(timer);
    };
  }
  return () => {
    unsubscribe();
    if (--subscribers === 0) stopRefresh();
  };
}

export function useAppContent() {
  return useSyncExternalStore(subscribe, store.getSnapshot, store.getSnapshot);
}
