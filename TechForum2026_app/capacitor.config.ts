import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.psy_lololo.conferenceapp',
  appName: 'TechForum 2026',
  webDir: 'dist',
  server: {
    // BUG_FIX_CONTEXT: APK ходит по сети к http://72.56.9.90:3100 (cleartext —
    // у нас пока нет домена для Let's Encrypt). По умолчанию Android 9+ блокирует
    // cleartext. Включаем allowMixedContent + cleartext для конкретных IP/домена.
    // После получения domain + HTTPS — это можно убрать.
    androidScheme: 'https',
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
