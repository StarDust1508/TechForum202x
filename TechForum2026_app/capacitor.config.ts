import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psy_lololo.conferenceapp',
  appName: 'TechForum 2026',
  webDir: 'dist',
  server: {
    // androidScheme: 'http' пока бэкенд по cleartext IP. См. ARCHITECTURE.md §8.
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: [
      '72.56.9.90',
      '*.72.56.9.90',
    ],
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    // CRITICAL: CapacitorHttp перехватывает fetch/XHR в WebView и пускает их
    // через нативный OkHttp-стек. Это:
    //   - обходит блок WebView'ом cleartext-fetch к raw IP (Failed to fetch)
    //   - обходит CORS (нативный запрос, не cross-origin)
    //   - обходит mixed-content блок Android 9+
    //   - обходит ServiceWorker и любые WebView-cache мисхэппы
    // БЕЗ него регистрация падала с "Нет соединения с сервером" на всех
    // мобильных устройствах, хотя бэк жив и curl с ноутбука работает.
    // Когда переедем на HTTPS-домен, можно отключить и вернуться на стандартный
    // WebView-fetch, но и так оставить безопасно.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
