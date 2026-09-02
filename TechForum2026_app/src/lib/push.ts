// FILE: src/lib/push.ts
// Единая обёртка над Firebase Messaging с silent fallback на web.
// Только на Android получает FCM token и шлёт его на бэк
// (POST /me/push-token). iOS закрыт кодом до подтверждённых APNs capability,
// provisioning profile и Distribution signing.
//
// Реальная регистрация включается только когда в нативных проектах есть
// Firebase-конфиги. Это предотвращает native crash неполной сборки.

import { resolveApiUrl, authFetch } from './runtimeEndpoint';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { FirebaseMessaging, Importance } from '@capacitor-firebase/messaging';

const TOKEN_LS_KEY = 'techforum_push_token';

export const PUSH_SERVICE_CONFIGURED = String(import.meta.env?.VITE_PUSH_CONFIGURED || '').toLowerCase() === 'true';

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isPushRuntimeSupported(platform: string, native: boolean, configured: boolean): boolean {
  return native && platform === 'android' && configured;
}

function canUseFirebaseMessaging(): boolean {
  return isPushRuntimeSupported(Capacitor.getPlatform(), isNative(), PUSH_SERVICE_CONFIGURED);
}

export type PushNotificationState = {
  available: boolean;
  enabled: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
  reason?: 'web_unsupported' | 'platform_not_supported' | 'service_not_configured' | 'permission_denied' | 'registration_missing' | 'check_failed';
};

export function getStoredPushToken(): string {
  try { return localStorage.getItem(TOKEN_LS_KEY) || ''; } catch { return ''; }
}

export async function clearPushRegistrationLocally(): Promise<void> {
  try { localStorage.removeItem(TOKEN_LS_KEY); } catch { /* noop */ }
  if (canUseFirebaseMessaging()) {
    try { await FirebaseMessaging.deleteToken(); } catch { /* already revoked */ }
  }
}

/** Сверяет UI не с localStorage, а с разрешением ОС и регистрацией в БД. */
export async function getPushNotificationState(): Promise<PushNotificationState> {
  if (!isNative()) return { available: false, enabled: false, permission: 'unavailable', reason: 'web_unsupported' };
  if (Capacitor.getPlatform() !== 'android') return { available: false, enabled: false, permission: 'unavailable', reason: 'platform_not_supported' };
  if (!PUSH_SERVICE_CONFIGURED) return { available: false, enabled: false, permission: 'unavailable', reason: 'service_not_configured' };
  try {
    const permission = await FirebaseMessaging.checkPermissions();
    const receive = permission.receive === 'granted' ? 'granted' : permission.receive === 'denied' ? 'denied' : 'prompt';
    if (receive !== 'granted') {
      return { available: true, enabled: false, permission: receive, reason: receive === 'denied' ? 'permission_denied' : 'registration_missing' };
    }
    const localToken = getStoredPushToken();
    if (!localToken) {
      return { available: true, enabled: false, permission: 'granted', reason: 'registration_missing' };
    }
    const response = await authFetch(resolveApiUrl('/me/push-token/status'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: localToken }),
    });
    if (!response.ok) throw new Error(`push_status_${response.status}`);
    const result = await response.json().catch(() => null);
    const enabled = result?.enabled === true;
    return { available: true, enabled, permission: 'granted', reason: enabled ? undefined : 'registration_missing' };
  } catch {
    return { available: true, enabled: false, permission: 'unavailable', reason: 'check_failed' };
  }
}

/**
 * Запрашивает permission, регистрирует в FCM, ловит token, шлёт на бэк.
 * Возвращает true если token зарегистрирован, false иначе.
 * Безопасно вызывать многократно — если token не изменился, бэк делает
 * upsert по token UNIQUE (только last_seen_at обновляется).
 */
export async function registerPushNotifications(deviceLabel?: string): Promise<boolean> {
  if (!canUseFirebaseMessaging()) {
    // Web/iOS push включаются только отдельным доказанным контуром. До этого
    // любой случайный build flag остаётся fail-closed.
    return false;
  }
  try {
    await FirebaseMessaging.createChannel({
      id: 'techpravo_updates',
      name: 'ТехнологИИ Права',
      description: 'Программа форума, сообщения и важные объявления',
      importance: Importance.High,
      lights: true,
      lightColor: '#00FFFF',
      vibration: true,
    });
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

    const token = (await FirebaseMessaging.getToken()).token;
    if (!token) return false;
    const platform = Capacitor.getPlatform();
    const normalizedDeviceLabel = deviceLabel?.trim();
    const r = await authFetch(resolveApiUrl('/me/push-token'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: 'android',
        ...(normalizedDeviceLabel ? { deviceLabel: normalizedDeviceLabel } : {}),
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
export async function unregisterPushNotifications(): Promise<boolean> {
  const token = getStoredPushToken();
  if (!token) return true;
  try {
    const response = await authFetch(resolveApiUrl(`/me/push-token?token=${encodeURIComponent(token)}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) return false;
  } catch { return false; }
  await clearPushRegistrationLocally();
  return true;
}

/**
 * Подписка на push-events на устройстве (когда юзер тапает по push):
 * onPushAction вызывается с payload (data из notification).
 * Используется для deep-link: тап по DM-уведомлению → /chat/<userId>.
 */
export async function attachPushListeners(
  onForegroundMessage?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void,
  onActionPerformed?: (data: Record<string, unknown>) => void,
): Promise<() => void> {
  if (!canUseFirebaseMessaging()) return () => {};
  const handles: PluginListenerHandle[] = [];
  try {
    if (onForegroundMessage) {
      handles.push(await FirebaseMessaging.addListener('notificationReceived', ({ notification: n }) => {
        onForegroundMessage({
          title: n.title,
          body: n.body,
          data: (n.data ?? {}) as Record<string, unknown>,
        });
      }));
    }
    if (onActionPerformed) {
      handles.push(await FirebaseMessaging.addListener('notificationActionPerformed', (a) => {
        onActionPerformed((a.notification.data ?? {}) as Record<string, unknown>);
      }));
    }
  } catch { /* plugin not installed or FCM not configured */ }
  return () => {
    handles.forEach((handle) => { void handle.remove(); });
  };
}
