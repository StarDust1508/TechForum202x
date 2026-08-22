import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Android обязан сохранить исторический package id для обновлений RuStore.
  // Для первого iOS-релиза используем валидный bundle id через CAP_APP_ID.
  appId: process.env.CAP_APP_ID || 'com.psy_lololo.conferenceapp',
  appName: 'ТехнологИИ Права',
  webDir: 'dist',
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/messaging': { symlink: true },
        },
      },
    },
  },
  server: {
    // Бэкенд переведён на HTTPS: https://pravotech.pro/tfapi/v1 (nginx + Let's Encrypt).
    // WebView-контент отдаётся по https://localhost → mixed-content к HTTPS-API нет.
    androidScheme: 'https',
    allowNavigation: [
      'tech-pravo.ru',
      '*.tech-pravo.ru',
      'pravotech.pro',
      '*.pravotech.pro',
    ],
  },
  android: {},
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
    // Нативный splash покрывает чёрный экран Android boot между запуском
    // Activity и mount React (~300ms). launchAutoHide: false — скрываем
    // вручную из App.tsx после первого useful frame, чтобы переход был
    // бесшовный, без двойного флика.
    SplashScreen: {
      // Round 8: native splash 1.5с max (safety — если React почему-то не
      // вызовет SplashScreen.hide(), splash сам уйдёт). Реально hide вызывается
      // из App.tsx через rAF×2 после первого useful frame (~150мс на нормальном
      // устройстве). launchAutoHide:false — управляем вручную.
      launchShowDuration: 1500,
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: '#0f1118',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      // На iPhone body-resize сохраняет активное поле и кнопку над клавиатурой,
      // не меняя единицы viewport у полноэкранных страниц.
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
      autoBackdropColor: 'dom',
    },
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;
