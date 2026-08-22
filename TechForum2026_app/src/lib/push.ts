// FILE: src/lib/push.ts
// Единая обёртка над Firebase Messaging с silent fallback на web.
// На Android и iOS получает именно FCM token и шлёт
// его на бэк (POST /me/push-token).
//
// Реальная регистрация включается только когда в нативных проектах есть
// Firebase-конфиги. Это предотвращает native crash неполной сборки.

import { resolveApiUrl, authFetch } from './runtimeEndpoint';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const TOKEN_LS_KEY = 'techforum_push_token';

const FCM_CONFIGURED = String(import.meta.env.VITE_PUSH_CONFIGURED || '').toLowerCase() === 'true';

function isNative(): boolean {
  return Capacitor.isNativePlatform();
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
    let perm;
    try {
      perm = await FirebaseMessaging.checkPermissions();
    } catch {
      // Plugin installed but FCM not configured (no google-services.json)
      console.warn('[Push] checkPermissions failed — FCM likely not configured');
      return false;
    }

    let granted = perm.receive === 'granted';
    if (!granted) {
      try {
        const req = await FirebaseMessaging.requestPermissions();
        granted = req.receive === 'granted';
      } catch {
        console.warn('[Push] requestPermissions failed');
        return false;
      }
    }
    if (!granted) return false;

    // FCM не настроен — НЕ зовём native getToken() и не изображаем
    // успешную подписку: UI честно сообщает, что сервис пока недоступен.
    if (!FCM_CONFIGURED) {
      console.info('[Push] permission granted; native FCM register skipped (FCM not configured)');
      return false;
    }

    const token = (await FirebaseMessaging.getToken()).token;
    if (!token) return false;
    const platform = Capacitor.getPlatform();
    const r = await authFetch(resolveApiUrl('/me/push-token'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: platform === 'ios' ? 'ios' : 'android',
        deviceLabel: deviceLabel ?? null,
      }),
    });
    if (!r.ok) return false;
    try { localStorage.setItem(TOKEN_LS_KEY, token); } catch { /* noop */ }
    return true;
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
  if (isNative() && FCM_CONFIGURED) {
    try { await FirebaseMessaging.deleteToken(); } catch { /* already revoked */ }
  }
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
    if (onForegroundMessage) {
      void FirebaseMessaging.addListener('notificationReceived', ({ notification: n }) => {
        onForegroundMessage({
          title: n.title,
          body: n.body,
          data: (n.data ?? {}) as Record<string, unknown>,
        });
      });
    }
    if (onActionPerformed) {
      void FirebaseMessaging.addListener('notificationActionPerformed', (a) => {
        onActionPerformed((a.notification.data ?? {}) as Record<string, unknown>);
      });
    }
  } catch { /* plugin not installed or FCM not configured */ }
}
