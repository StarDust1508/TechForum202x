import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psy_lololo.conferenceapp',
  appName: 'TechForum 2026',
  webDir: 'dist',
  server: {
    // CRITICAL: androidScheme ОБЯЗАН быть 'http' пока бэкенд по cleartext
    // http://72.56.9.90:3100 (нет домена + Let's Encrypt). При 'https' WebView
    // origin = https://localhost, fetch к http://... блокируется как mixed content
    // (allowMixedContent на Android 9+ для XHR/fetch не помогает). Симптом —
    // "Нет соединения с сервером" на регистрации/логине. См. ARCHITECTURE.md §8.
    // НЕ менять обратно на 'https' до полной миграции на HTTPS-домен.
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
};

export default config;
