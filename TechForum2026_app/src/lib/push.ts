// FILE: src/lib/push.ts
// Round 5: Тонкая обёртка над @capacitor/push-notifications с silent fallback
// на web. Регистрирует устройство в FCM (Android), получает token, шлёт
// его на бэк (POST /me/push-token).
//
// Реальная отправка push'ей с бэка ещё не настроена (нужен FCM project +
// service-account JSON в env). Сейчас работает infrastructure: токен
// сохраняется в push_tokens. После настройки FCM credentials worker
// сможет рассылать без правок клиента.

import { resolveApiUrl, authFetch } from './runtimeEndpoint';

const TOKEN_LS_KEY = 'techforum_push_token';

// FCM ещё НЕ настроен (нет google-services.json). Нативный
// PushNotifications.register() без Firebase-конфига падает НАТИВНО — JS
// try/catch это не ловит, приложение вылетает. Пока флаг false: не зовём
// register(), тумблер работает как локальный preference (запрос permission
// без краша). Когда добавите Firebase service-account + google-services.json —
// поставьте true, и пойдёт реальная FCM-регистрация без правок клиента.
const FCM_CONFIGURED = false;

function isNative(): boolean {
  const Capacitor: any = (window as any).Capacitor;
  return !!(Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform());
}

/**
 * Запрашивает permission, регистрирует в FCM, ловит token, шлёт на бэк.
 * Возвращает true если token зарегистрирован, false иначе.
 * Безопасно вызывать многократно — если token не изменился, бэк делает
 * upsert по token UNIQUE (только last_seen_at обновляется).
 */
export async function registerPushNotifications(deviceLabel?: string): Promise<boolean> {
  if (!isNative()) {
    // Web push API можно сделать в будущем (Notifications API + Service Worker
    // VAPID), но сейчас пропускаем.
    return false;
  }
  try {
    // Dynamic import — will throw if plugin not installed
    const mod = await import('@capacitor/push-notifications').catch(() => null);
    if (!mod?.PushNotifications) return false;
    const { PushNotifications } = mod;

    let perm;
    try {
      perm = await PushNotifications.checkPermissions();
    } catch {
      // Plugin installed but FCM not configured (no google-services.json)
      console.warn('[Push] checkPermissions failed — FCM likely not configured');
      return false;
    }

    let granted = perm.receive === 'granted';
    if (!granted) {
      try {
        const req = await PushNotifications.requestPermissions();
        granted = req.receive === 'granted';
      } catch {
        console.warn('[Push] requestPermissions failed');
        return false;
      }
    }
    if (!granted) return false;

    // FCM не настроен — НЕ зовём native register() (падает). Сохраняем как
    // локальный preference: разрешение получено, токен отправим когда включат FCM.
    if (!FCM_CONFIGURED) {
      console.info('[Push] permission granted; native FCM register skipped (FCM not configured)');
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      // Установка listener'ов до register() — Capacitor docs.
      const listenerHandles: Array<Promise<{ remove: () => Promise<void> }>> = [];
      let registered = false;
      let timeout: number;

      listenerHandles.push(
        PushNotifications.addListener('registration', async (token) => {
          if (registered) return;
          registered = true;
          window.clearTimeout(timeout);
          try {
            const r = await authFetch(resolveApiUrl('/me/push-token'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: 'fcm',
                deviceLabel: deviceLabel ?? null,
              }),
            });
            if (r.ok) {
              try { localStorage.setItem(TOKEN_LS_KEY, token.value); } catch { /* noop */ }
              resolve(true);
            } else {
              resolve(false);
            }
          } catch {
            resolve(false);
          }
        }),
      );
      listenerHandles.push(
        PushNotifications.addListener('registrationError', (err) => {
          if (registered) return;
          registered = true;
          window.clearTimeout(timeout);
          console.warn('[Push] registrationError:', err);
          resolve(false);
        }),
      );
      // Safety timeout 10c.
      timeout = window.setTimeout(() => {
        if (!registered) { registered = true; resolve(false); }
      }, 10_000);

      PushNotifications.register().catch(() => {
        if (!registered) { registered = true; resolve(false); }
      });
    });
  } catch (e) {
    console.warn('[Push] registerPushNotifications error:', e);
    return false;
  }
}

/**
 * При logout удаляем подписку этого устройства (чтобы новый юзер не получал
 * push'и предыдущего). В FCM сам токен переживает logout — удаляем только
 * сервер-side связку user→token.
 */
export async function unregisterPushNotifications(): Promise<void> {
  let token: string | null = null;
  try { token = localStorage.getItem(TOKEN_LS_KEY); } catch { /* noop */ }
  if (!token) return;
  try {
    await authFetch(resolveApiUrl(`/me/push-token?token=${encodeURIComponent(token)}`), {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch { /* offline — token истечёт server-side через GC */ }
  try { localStorage.removeItem(TOKEN_LS_KEY); } catch { /* noop */ }
}

/**
 * Подписка на push-events на устройстве (когда юзер тапает по push):
 * onPushAction вызывается с payload (data из notification).
 * Используется для deep-link: тап по DM-уведомлению → /chat/<userId>.
 */
export async function attachPushListeners(
  onForegroundMessage?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void,
  onActionPerformed?: (data: Record<string, unknown>) => void,
): Promise<void> {
  if (!isNative()) return;
  try {
    const mod = await import('@capacitor/push-notifications').catch(() => null);
    if (!mod?.PushNotifications) return;
    const { PushNotifications } = mod;
    if (onForegroundMessage) {
      void PushNotifications.addListener('pushNotificationReceived', (n) => {
        onForegroundMessage({
          title: n.title,
          body: n.body,
          data: (n.data ?? {}) as Record<string, unknown>,
        });
      });
    }
    if (onActionPerformed) {
      void PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
        onActionPerformed((a.notification?.data ?? {}) as Record<string, unknown>);
      });
    }
  } catch { /* plugin not installed or FCM not configured */ }
}
