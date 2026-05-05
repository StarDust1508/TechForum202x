// FILE: src/lib/push.ts
// Round 5: Тонкая обёртка над @capacitor/push-notifications с silent fallback
// на web. Регистрирует устройство в FCM (Android), получает token, шлёт
// его на бэк (POST /me/push-token).
//
// Реальная отправка push'ей с бэка ещё не настроена (нужен FCM project +
// service-account JSON в env). Сейчас работает infrastructure: токен
// сохраняется в push_tokens. После настройки FCM credentials worker
// сможет рассылать без правок клиента.

import { resolveApiUrl } from './runtimeEndpoint';

const TOKEN_LS_KEY = 'techforum_push_token';

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
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === 'granted';
    if (!granted) {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === 'granted';
    }
    if (!granted) return false;

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
            const r = await fetch(resolveApiUrl('/me/push-token'), {
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
        PushNotifications.addListener('registrationError', () => {
          if (registered) return;
          registered = true;
          window.clearTimeout(timeout);
          resolve(false);
        }),
      );
      // Safety timeout 10c.
      timeout = window.setTimeout(() => {
        if (!registered) { registered = true; resolve(false); }
      }, 10_000);

      void PushNotifications.register();
    });
  } catch {
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
    await fetch(resolveApiUrl(`/me/push-token?token=${encodeURIComponent(token)}`), {
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
    const { PushNotifications } = await import('@capacitor/push-notifications');
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
  } catch { /* plugin not installed yet */ }
}
