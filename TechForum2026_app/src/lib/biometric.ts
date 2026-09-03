// FILE: src/lib/biometric.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Биометрический re-login для повторного захода в APK без ввода
//          пароля. Учётные данные шифруются Keystore (Android) / Keychain
//          (iOS) и расшифровываются ТОЛЬКО после прохождения BiometricPrompt
//          (отпечаток / Face ID).
// SCOPE: Тонкий wrapper над @capgo/capacitor-native-biometric с защитой от
//        false-positive (false-positive здесь не от биометрии — её точность
//        управляет ОС, а от UX-проколов: пропуск проверки наличия сенсора,
//        запись credentials до успешной аутентификации, etc).
// INPUT: Email и пароль юзера (после успешного login/register).
// OUTPUT: { isAvailable, enable, disable, isEnabled, tryAutoLogin } API.
// KEYWORDS: DOMAIN(8): Auth; CONCEPT(8): BiometricRelogin; TECH(7): Capacitor, Keychain, Keystore
// LINKS: USED_BY(9): src/pages/Auth.tsx (предложение включить),
//        USED_BY(9): src/App.tsx (auto-login на cold-start);
//        USES_API(8): @capgo/capacitor-native-biometric;
//        USES_API(7): src/lib/runtimeEndpoint.ts (resolveApiUrl)
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему храним пароль локально, а не "biometric token" с сервера?
// A: Серверный biometric-token потребовал бы новой эндпоинтной поверхности
//    + revocation flow + token-renewal. Для конференционного APK (короткий
//    жизненный цикл, single-tenant БД) — over-engineering. NativeBiometric
//    шифрует credentials через Android Keystore/iOS Keychain — расшифровка
//    возможна только после успешного BiometricPrompt. Если телефон украден,
//    биометрия чужая → credentials не вытащить даже root'ом.
//
// Q: Почему не fallback на PIN/паттерн устройства, если биометрия не настроена?
// A: NativeBiometric поддерживает device-credential fallback через
//    `useFallback: true`. Включаем — если пользователь снял отпечаток,
//    он введёт PIN телефона и всё ещё попадёт в App без пароля от
//    TechForum. Этим избегаем "у меня удалили отпечаток — теперь надо
//    помнить пароль", что было бы фрустрацией на конференции.
//
// Q: Что делать если плагин недоступен (web, старый Android без сенсора)?
// A: Все методы возвращают безопасный no-op (isAvailable=false). Тогда
//    Auth.tsx просто не показывает предложение, App.tsx идёт обычным
//    путём через cookie-сессию.
// END_RATIONALE
//
// START_INVARIANTS:
// - Credentials записываются ТОЛЬКО после успешного BiometricPrompt.verifyIdentity.
// - При disable() credentials УДАЛЯЮТСЯ ИЗ Keychain/Keystore (deleteCredentials)
//   И из localStorage-флага. Иначе зомби-credentials останутся.
// - LS_ENABLED_KEY и реальное наличие credentials в Keychain — синхронны.
//   На cold-start если LS_ENABLED=true но getCredentials упал — сбрасываем
//   LS_ENABLED, чтобы не показывать "включено" при повреждённом стораджем.
// END_INVARIANTS
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 — Первичная реализация: enable/disable/tryAutoLogin
//                       + защита от false-positive (verify ДО setCredentials,
//                       try/catch на каждый плагин-вызов, sync LS со стораджем).]
// END_CHANGE_SUMMARY
//
// START_MODULE_MAP:
// FUNC 7[Проверка платформы и наличия сенсора] => isBiometricAvailable
// FUNC 9[Включение биометрии: verify → setCredentials → LS-флаг] => enableBiometric
// FUNC 8[Выключение биометрии: deleteCredentials + clear LS] => disableBiometric
// FUNC 6[Чтение LS-флага "биометрия включена для юзера"] => isBiometricEnabled
// FUNC 10[Auto-login на cold-start: verify → getCredentials → POST /auth/login] => tryBiometricAutoLogin
// END_MODULE_MAP

import { resolveApiUrl } from './runtimeEndpoint';

const LS_ENABLED_KEY = 'techforum_biometric_enabled';
const SERVER_KEY = 'techforum-techforum2026';

interface BiometricApi {
  isAvailable: () => Promise<{ isAvailable: boolean; biometryType?: number }>;
  verifyIdentity: (opts?: { reason?: string; title?: string; subtitle?: string; description?: string; useFallback?: boolean; negativeButtonText?: string }) => Promise<void>;
  setCredentials: (opts: { username: string; password: string; server: string }) => Promise<void>;
  getCredentials: (opts: { server: string }) => Promise<{ username: string; password: string }>;
  deleteCredentials: (opts: { server: string }) => Promise<void>;
}

async function getPlugin(): Promise<BiometricApi | null> {
  // На web (vite dev в браузере) Capacitor.isNativePlatform()=false — плагин не имеет смысла.
  const Capacitor: any = (typeof window !== 'undefined' ? (window as any).Capacitor : null);
  if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    const mod = await import('@capgo/capacitor-native-biometric');
    return (mod as any).NativeBiometric as BiometricApi;
  } catch {
    return null;
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    const res = await plugin.isAvailable();
    return Boolean(res?.isAvailable);
  } catch {
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(LS_ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Включает биометрию для текущего юзера. Сначала ВЕРИФИЦИРУЕТ identity
 * (отпечаток / Face ID), и только после успеха — сохраняет credentials
 * в Keychain/Keystore. Это защищает от сценария "юзер дал телефон другу
 * чтобы тот посмотрел расписание" — друг не может включить биометрию без
 * пальца владельца.
 *
 * Throws если плагин недоступен / verify failed / setCredentials failed.
 */
export async function enableBiometric(email: string, password: string): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) throw new Error('biometric_unavailable');

  await plugin.verifyIdentity({
    title: 'TechForum 2026',
    subtitle: 'Включить вход по биометрии',
    description: 'Подтвердите личность, чтобы привязать TechForum к биометрии',
    useFallback: true,
    negativeButtonText: 'Отмена',
  });

  await plugin.setCredentials({
    username: email,
    password,
    server: SERVER_KEY,
  });

  try {
    localStorage.setItem(LS_ENABLED_KEY, '1');
  } catch { /* private mode — ОС-сторадж основной, флаг — только UX-кэш */ }
}

export async function disableBiometric(): Promise<void> {
  const plugin = await getPlugin();
  try { localStorage.removeItem(LS_ENABLED_KEY); } catch { /* noop */ }
  if (!plugin) return;
  try {
    await plugin.deleteCredentials({ server: SERVER_KEY });
  } catch { /* credentials уже удалены или Keychain недоступен — игнор */ }
}

/**
 * Попытка тихого auto-login на cold-start. Если сессия cookie уже жива
 * (через connect-pg-simple), эта функция не нужна — /auth/me вернёт 200.
 * Используется как fallback ТОЛЬКО когда /auth/me=401 И юзер ранее
 * включал биометрию.
 *
 * Возвращает PublicUser при успехе или null при любой ошибке (плагин
 * недоступен, verify cancel, getCredentials fail, /auth/login 401).
 *
 * BUG_FIX_CONTEXT (антифрод):
 * - НЕ кэшируем результат verifyIdentity — каждый cold-start требует
 *   повторного отпечатка. Иначе если у юзера украдут разблокированный
 *   телефон, злоумышленник зайдёт в App без биометрии.
 * - Если getCredentials падает (сменили пароль на сервере, пользователь
 *   разлогинился-сменил-залогинился в другом юзере) — сбрасываем
 *   LS_ENABLED, чтобы UX не подвисал на "Подтвердите отпечаток" в каждом
 *   старте.
 */
export async function tryBiometricAutoLogin(): Promise<unknown | null> {
  if (!isBiometricEnabled()) return null;
  const plugin = await getPlugin();
  if (!plugin) return null;

  try {
    await plugin.verifyIdentity({
      title: 'TechForum 2026',
      subtitle: 'Войти по биометрии',
      description: 'Приложите палец или посмотрите в камеру',
      useFallback: true,
      negativeButtonText: 'Использовать пароль',
    });
  } catch {
    // Юзер отменил / 5+ неуспешных попыток подряд — отдаём в обычный Auth.
    return null;
  }

  let creds: { username: string; password: string };
  try {
    creds = await plugin.getCredentials({ server: SERVER_KEY });
  } catch {
    // Credentials повреждены / удалены OS — лечим зомби-флаг.
    try { localStorage.removeItem(LS_ENABLED_KEY); } catch { /* noop */ }
    return null;
  }

  if (!creds?.username || !creds?.password) {
    try { localStorage.removeItem(LS_ENABLED_KEY); } catch { /* noop */ }
    return null;
  }

  try {
    const res = await fetch(resolveApiUrl('/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.username, password: creds.password }),
    });
    if (!res.ok) {
      // Пароль на сервере изменился с момента enable — credentials
      // больше не валидны. Очищаем биометрию, чтобы не показывать
      // BiometricPrompt при каждом старте.
      if (res.status === 401) {
        await disableBiometric();
      }
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}
