// FILE: src/lib/pushSender.ts
// Round 7: серверный отправитель push-уведомлений через Firebase Admin SDK.
// Lazy init из process.env.FCM_SERVICE_ACCOUNT_PATH. Если пути нет/файл не
// читается — disabled=true, send-функции no-op (логируется один раз).
// Это позволяет деплоить инфру до настройки FCM проекта (DevOps task).
//
// Public API:
//  - initFcm(): Promise<boolean> — вызывается на startup сервера. Возвращает true
//    если credentials валидные. Безопасно вызывать несколько раз.
//  - sendPushToUser(userId, payload): шлёт всем токенам юзера. Параллельно
//    GC мёртвых токенов (invalid-registration → DELETE FROM push_tokens).
//  - sendPushBatch(userIds, payload): broadcast — admin-рассылка.
//
// FCM token expiry handling: firebase-admin при отправке возвращает
// 'messaging/registration-token-not-registered' / 'invalid-registration-token'
// для устаревших — auto-cleanup из БД, чтобы не копилось мусора.

import fs from 'node:fs';
import { eq, inArray } from 'drizzle-orm';
import { log } from './log.js';

interface PushPayload {
  title: string;
  body: string;
  /** Произвольные key-value для deep-link на клиенте (e.g. {type:'dm', from:'<userId>'}). */
  data?: Record<string, string>;
  /** 'high' для DM (мгновенный wake-up), 'normal' для reminders. По умолчанию 'high'. */
  priority?: 'high' | 'normal';
}

// Внутреннее состояние модуля — singleton.
let messaging: import('firebase-admin/messaging').Messaging | null = null;
let initialized = false;
let disabled = false;

export async function initFcm(): Promise<boolean> {
  if (initialized) return !disabled;
  initialized = true;
  const saPath = (process.env.FCM_SERVICE_ACCOUNT_PATH ?? '').trim();
  if (!saPath) {
    log.warn('fcm', 'disabled — set FCM_SERVICE_ACCOUNT_PATH in .env.production to enable push delivery');
    disabled = true;
    return false;
  }
  if (!fs.existsSync(saPath)) {
    log.warn('fcm', `disabled — service-account file not found at ${saPath}`);
    disabled = true;
    return false;
  }
  try {
    // Проект работает как ESM (`type: module`), поэтому CommonJS require здесь
    // аварийно падал бы сразу после подключения реального ключа Firebase.
    // Динамический import сохраняет ленивую загрузку SDK без этой несовместимости.
    const appModule = await import('firebase-admin/app');
    const messagingModule = await import('firebase-admin/messaging');
    const app = appModule.getApps()[0] ?? appModule.initializeApp({ credential: appModule.cert(saPath) });
    messaging = messagingModule.getMessaging(app);
    log.info('fcm', 'initialized — push delivery is live');
    return true;
  } catch (err) {
    log.error('fcm', `init failed: ${(err as Error).message}`);
    disabled = true;
    return false;
  }
}

/** Per-user-per-minute bucket — защита от шторма push'ей одному юзеру. */
const userPushBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_PUSH_PER_USER_PER_MIN = 5;
function bumpUserBucket(userId: string): boolean {
  const now = Date.now();
  const cur = userPushBuckets.get(userId);
  if (!cur || cur.resetAt <= now) {
    userPushBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (cur.count >= MAX_PUSH_PER_USER_PER_MIN) return false;
  cur.count += 1;
  return true;
}

/**
 * Отправка push'а конкретному юзеру (всем его зарегистрированным устройствам).
 * Возвращает количество успешно доставленных push'ей.
 * Принимает db и pushTokens table из caller (DI избегает circular import).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  db: any,
  pushTokens: any,
): Promise<number> {
  if (disabled || !messaging) return 0;
  if (!bumpUserBucket(userId)) {
    log.warn('fcm', `rate-limited push to ${userId}`);
    return 0;
  }
  let tokens: Array<{ id: string; token: string; userId: string }>;
  try {
    tokens = await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  } catch (err) {
    log.error('fcm', `tokens fetch failed: ${(err as Error).message}`);
    return 0;
  }
  if (tokens.length === 0) return 0;

  const messages = tokens.map((t) => ({
    token: t.token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    android: {
      priority: (payload.priority ?? 'high') as 'high' | 'normal',
      notification: {
        channelId: 'techpravo_updates',
        icon: 'ic_stat_techpravo',
        color: '#00FFFF',
      },
    },
  }));

  let successCount = 0;
  try {
    const res = await messaging.sendEach(messages);
    successCount = res.successCount;
    // GC мёртвых токенов: indexed по той же позиции что messages[].
    const deadTokens: string[] = [];
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code ?? '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        deadTokens.push(tokens[i]!.token);
      }
    });
    if (deadTokens.length > 0) {
      try {
        await db.delete(pushTokens).where(inArray(pushTokens.token, deadTokens));
        log.info('fcm', `GC ${deadTokens.length} dead tokens for user ${userId}`);
      } catch (err) {
        log.error('fcm', `GC failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    log.error('fcm', `send failed: ${(err as Error).message}`);
    return 0;
  }
  return successCount;
}

/**
 * Broadcast — отправляет много push'ей разным юзерам (admin-рассылка).
 * Делит на чанки по 100 (FCM лимит — 500 за раз, берём с запасом).
 */
export async function sendPushBatch(
  userIds: string[],
  payload: PushPayload,
  db: any,
  pushTokens: any,
): Promise<number> {
  if (disabled || !messaging) return 0;
  if (userIds.length === 0) return 0;
  let total = 0;
  // 100 юзеров за раз — exposeся через Promise.all каждой группы.
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const results = await Promise.all(
      chunk.map((uid) => sendPushToUser(uid, payload, db, pushTokens)),
    );
    total += results.reduce((a, b) => a + b, 0);
  }
  return total;
}

/** Для отладки: статус модуля. Используется в /health endpoint. */
export function fcmStatus(): { initialized: boolean; disabled: boolean } {
  return { initialized, disabled };
}
