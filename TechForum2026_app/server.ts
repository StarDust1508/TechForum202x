// FILE: server.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Express-сервер TechForum 2026: REST API + Vite middleware (dev) или
//          static dist (prod). Persistence — Postgres через Drizzle ORM.
// SCOPE: Auth (cookie-session + scrypt), Feed (posts/comments/likes/statuses),
//        AI proxy (Gemini), security middleware, rate-limit, CORS.
// INPUT: env: PORT, NODE_ENV, SESSION_SECRET, CORS_ALLOW_ORIGINS, GEMINI_API_KEY,
//        GEMINI_MODEL, DATABASE_URL.
// OUTPUT: HTTP server слушает 0.0.0.0:PORT.
// KEYWORDS: DOMAIN(9): WebBackend; CONCEPT(8): RestApi, Persistence; TECH(9): Express, Drizzle, Postgres
// LINKS: USES_DB(10): src/db/index.ts; USES_API(7): @google/genai
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему все ID в text, а не в bigserial/uuid (Postgres-native)?
// A: Совместимость с существующим API-контрактом фронта (string ID).
//    crypto.randomUUID() даёт 128-битную энтропию, коллизий нет.
// Q: Почему cookie-сессия, а не JWT?
// A: Cookie+session — стандарт для веб/PWA: автоматический refresh, нативная
//    поддержка httpOnly/secure/SameSite. JWT нужен для cross-origin SPA → API
//    через Bearer, но у нас same-origin Capacitor + APK.
// END_RATIONALE
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v2.0.0 - Переход с in-memory массивов на Postgres через Drizzle.
//                       Auth/Feed эндпоинты переписаны на БД-запросы. dev-юзер
//                       и mock-данные больше не инициализируются на старте —
//                       они в src/db/seed.ts.]
// PREV_CHANGE_SUMMARY: [v1.0.0 - In-memory массивы, in-memory rate-limiter, scrypt-auth.]
// END_CHANGE_SUMMARY

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import multer from 'multer';
import { ZodError, type ZodTypeAny } from 'zod';
import {
  authRegisterSchema,
  authLoginSchema,
  authMePatchSchema,
  meInterestsPutSchema,
  postCreateSchema,
  commentCreateSchema,
  statusCreateSchema,
  aiChatSchema,
  forgotPasswordStartSchema,
  forgotPasswordVerifySchema,
  dmSendSchema,
  noteUpsertSchema,
  pushTokenRegisterSchema,
} from './src/lib/validation.js';
import { log } from './src/lib/log.js';
import { initFcm, sendPushToUser, fcmStatus } from './src/lib/pushSender.js';

// Типизируем поле userId на сессии — убирает ad-hoc cast'ы по handler'ам.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

/**
 * Express-middleware для валидации req.body через zod-схему. На ошибке
 * возвращает 400 с массивом field-level сообщений. На успехе — мутирует
 * req.body на типизированный результат parse, чтобы handler ниже работал
 * с гарантированно валидным объектом без повторных приведений типов.
 */
function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issues = (parsed.error as ZodError).issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      res.status(400).json({ error: 'invalid_body', issues });
      return;
    }
    (req as Request & { body: unknown }).body = parsed.data;
    next();
  };
}
// api.navy — OpenAI-compatible AI proxy (replaces Gemini)
import { createServer as createViteServer } from 'vite';
import { eq, desc, asc, and, or, sql, inArray, lt, count } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_V1_PREFIX = '/api/v1';
const LEGACY_API_PREFIX = '/api';

function loadEnvironmentFiles(): void {
  const mode = String(process.env.NODE_ENV || 'development').trim() || 'development';
  const candidates = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];

  for (const filename of candidates) {
    const absolutePath = path.join(__dirname, filename);
    if (!fs.existsSync(absolutePath)) continue;
    dotenv.config({ path: absolutePath, override: false, quiet: true });
  }
}

loadEnvironmentFiles();

// БД должна быть импортирована ПОСЛЕ loadEnvironmentFiles, чтобы DATABASE_URL
// был установлен к моменту инициализации pool.
const dbModule = await import('./src/db/index.js');
const { db, pool } = dbModule;
const schemaModule = await import('./src/db/schema.js');
const {
  users, posts, postLikes, postComments, statuses, registrations,
  sessionsEvent, userInterests, passwordResetTokens, directMessages, dmPins, notes,
  tracks, halls, days, speakers, partners, sessionSpeakers, news, events,
  pushTokens, giveaways, giveawayEntries,
  faq, contactExchanges, aiChatMessages,
} = schemaModule;

// Доменные данные программы (treki, halls, days, speakers, sessions, partners,
// EVENT_META) — источник истины src/data.ts. Используются для AI-контекста
// и .ics-генерации. БД содержит копию через src/db/seed.ts.
const dataModule = await import('./src/data.js');
const { TRACKS, HALLS, DAYS, SPEAKERS, SESSIONS, PARTNERS, EVENT_META, INTERESTS } = dataModule;

const icsModule = await import('./src/lib/ics.js');
const { buildIcsCalendar, formatIcsDateTime } = icsModule;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(password: string, salt?: string): string {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${digest}`;
}

function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, digest] = passwordHash.split(':');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex'), 'hex');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

type PublicUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  bio: string;
  phone: string | null;
  role: string;
  company: string;
  workplace: string;
  education: string;
  birthday: string;
  isPrivate: boolean;
  pushPreviewHidden: boolean;
};

function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    bio: row.bio,
    phone: row.phone,
    role: row.role,
    company: row.company ?? '',
    workplace: row.workplace ?? '',
    education: row.education ?? '',
    birthday: (row as any).birthday ?? '',
    isPrivate: row.isPrivate,
    pushPreviewHidden: row.pushPreviewHidden ?? false,
  };
}

function getSessionUserId(req: Request): string | null {
  const userId = req.session?.userId;
  return typeof userId === 'string' ? userId : null;
}

// Парсим "HH:MM" в минуты от полуночи. Используется для conflict-detection
// при регистрации на сессии. Если формат битый — возвращаем NaN, что выводит
// строки за пределы overlap-диапазона (безопасный default).
function parseTimeToMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}
function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = parseTimeToMinutes(aStart);
  const a2 = parseTimeToMinutes(aEnd);
  const b1 = parseTimeToMinutes(bStart);
  const b2 = parseTimeToMinutes(bEnd);
  if ([a1, a2, b1, b2].some(Number.isNaN)) return false;
  return a1 < b2 && b1 < a2;
}

async function findUserById(id: string): Promise<typeof users.$inferSelect | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

async function findUserByEmail(email: string): Promise<typeof users.$inferSelect | null> {
  const rows = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1);
  return rows[0] ?? null;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  next();
}

function createRateLimiter(limit: number, windowMs: number) {
  // SECURITY FIX (P0): раньше брали req.headers['x-forwarded-for'] как
  // источник IP, и атакующий банально менял заголовок чтобы обойти лимит.
  // Теперь используем ТОЛЬКО req.socket.remoteAddress — это реальный
  // TCP peer (если за trust proxy nginx — req.ip даст правильный
  // X-Real-IP, но мы доверяем только нашему nginx, не клиенту).
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    // req.ip учитывает trust proxy если он включён, иначе == socket.remoteAddress.
    // Express setting 'trust proxy' включается отдельно при наличии nginx.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'rate_limit_exceeded', retryAfterSeconds });
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
}

async function startServer(): Promise<void> {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredSessionSecret = String(process.env.SESSION_SECRET || '').trim();
  if (isProduction && !configuredSessionSecret) {
    throw new Error('SESSION_SECRET is required in production');
  }
  const sessionSecret = configuredSessionSecret || crypto.randomBytes(32).toString('hex');
  if (!isProduction && !configuredSessionSecret) {
    log.warn('boot', 'SESSION_SECRET is not set. Using ephemeral dev secret.');
  }

  // trust proxy=1 — мы за nginx (на проде /api/v1 идёт через :80→:3100).
  // req.ip теперь = X-Real-IP/X-Forwarded-For, выставленный нашим nginx.
  // На dev (TRUST_PROXY=0) — req.ip == socket.remoteAddress.
  // SECURITY: rate-limiter теперь нельзя обойти подменой XFF клиентом,
  // потому что XFF доверяется ТОЛЬКО когда mы знаем что есть proxy.
  const trustProxyEnv = String(process.env.TRUST_PROXY || '').trim();
  const trustProxy = trustProxyEnv === '0' ? false : (trustProxyEnv === '1' || isProduction);
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  // 15mb лимит — глобальный json-parser ловит body раньше per-route override,
  // и при 2mb upload-media-base64 валился с 413. 15 ≈ base64-overhead над
  // 9 MB бинарным upload-лимитом + headroom. Auth+rate-limit гейтят DoS.
  app.use(express.json({ limit: '15mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // BUG_FIX_CONTEXT (FIND-012): CSP только в production. В dev Vite инжектит
    // inline-скрипты для HMR/react-refresh — strict 'self' их блокирует и
    // страница остаётся пустой. 'unsafe-inline' для script — index.html
    // содержит inline `<script>navigator.serviceWorker.register(...)</script>`.
    if (isProduction) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "img-src 'self' data: blob: https://api.dicebear.com http://72.56.38.62:3100 https://72.56.38.62:3100",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' http://72.56.38.62:3100 https://72.56.38.62:3100 ws://72.56.38.62:3100 wss://72.56.38.62:3100 capacitor://localhost",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      );
      // BUG_FIX_CONTEXT: HSTS отключён пока backend на cleartext IP.
      // С HSTS WebView-кеш заставляет upgrade http://72.56.38.62:3100 →
      // https://72.56.38.62:3100, которого нет → "ERR_CONNECTION_REFUSED".
      // Юзер видит "нет сети". Включим обратно когда будет domain + cert.
      // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  // BUG_FIX_CONTEXT: Пока у нас нет domain + Let's Encrypt сертификата, APK
  // ходит к backend по cleartext (http://72.56.38.62:3100). Cookie c secure=true
  // в этом сценарии не сохраняется → юзер не может залогиниться. Env-toggle
  // COOKIE_SECURE=false разрешает cookie без HTTPS. Когда поднимем HTTPS, в
  // .env.production выставим COOKIE_SECURE=true (или удалим — дефолт isProduction).
  const cookieSecureEnv = String(process.env.COOKIE_SECURE || '').trim().toLowerCase();
  const cookieSecure = cookieSecureEnv === 'true' ? true
    : cookieSecureEnv === 'false' ? false
    : isProduction;
  if (isProduction && !cookieSecure) {
    log.warn('security', 'COOKIE_SECURE=false in production. OK ONLY for HTTP-only deployments — switch to true after domain+cert.');
  }

  // BUG_FIX_CONTEXT: До v2.1 express-session использовал дефолтный MemoryStore —
  // session записи жили в RAM Node.js процесса. На любой restart pm2 / OOM /
  // деплой все юзеры разлогинивались и видели Auth-экран на cold-start APK,
  // хотя их строка в users-таблице корректно лежала. Юзер интерпретировал это
  // как "БД не сохранила данные". Переходим на connect-pg-simple — таблица
  // session в той же БД, переживает любой restart. Используем существующий
  // pg.Pool, ноль новых соединений.
  const PgStore = connectPgSimple(session);
  const sessionStore = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    // Чистим истёкшие сессии раз в 15 минут — защита от роста таблицы.
    pruneSessionInterval: 60 * 15,
  });

  // Session middleware вынесен в переменную, чтобы можно было применять его
  // в WebSocket-upgrade handler'е (см. initDmWebSocketServer ниже) — WS
  // должен авторизоваться по тому же session-cookie что и HTTP.
  const sessionMiddleware = session({
    store: sessionStore,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
    },
  });
  app.use(sessionMiddleware);

  // Bearer-session fallback for CapacitorHttp (native OkHttp has no WebView cookies).
  // If no session cookie present but Authorization: Bearer <sid> exists, load that session.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.session?.userId) { next(); return; }
    const ah = req.header("authorization");
    if (!ah || !ah.startsWith("Bearer ")) { next(); return; }
    const sid = ah.slice(7).trim();
    if (!sid) { next(); return; }
    sessionStore.get(sid, (err: any, sess: any) => {
      if (!err && sess && sess.userId) {
        (req as any)._bearerUserId = sess.userId;
        if (!req.session) (req as any).session = {};
        req.session.userId = sess.userId;
      }
      next();
    });
  });

  // ========================================================================
  // WebSocket для DM (Round 4 АРХИТЕКТУРА) — declaration up top чтобы
  // endpoint handlers ниже могли вызывать dmBroadcast.
  // ========================================================================
  // Подключение: ws://host/api/v1/ws/dm — после upgrade авторизуем по
  // session-cookie (тот же sessionMiddleware что HTTP). После connect клиент
  // получает push'и: { type: 'dm:new'|'dm:edit'|'dm:delete'|'dm:pin', from,
  // to, ... } только когда он участник диалога (from===me ИЛИ to===me).
  // На сервере держим Map<userId, Set<WebSocket>> — мультиклиент допускается
  // (web-tab + APK у одного юзера).
  const userSockets = new Map<string, Set<import('ws').WebSocket>>();
  function dmBroadcast(event: { type: string; from?: string | null; to?: string | null; [k: string]: unknown }): void {
    const targets = new Set<string>();
    if (event.from) targets.add(String(event.from));
    if (event.to) targets.add(String(event.to));
    const payload = JSON.stringify(event);
    for (const userId of targets) {
      const set = userSockets.get(userId);
      if (!set) continue;
      for (const ws of set) {
        if (ws.readyState === 1 /* OPEN */) {
          try { ws.send(payload); } catch { /* socket lost */ }
        }
      }
    }
  }

  // DIAG (повторно включено): полный лог auth-flow + interests +
  // body-summary при ошибках 4xx. Без этого нельзя поймать жалобы вида
  // «не могу войти / не работает онбординг» с устройств юзеров. Собирает
  // только public поля (origin/ua/path/method/status); пароли никогда не
  // попадают — body не сериализуем. Удалить после стабилизации.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/auth') ||
        req.path.startsWith('/api/v1/me/interests') ||
        req.path === '/api/v1/health') {
      const ua = String(req.header('user-agent') || '').slice(0, 80);
      const origin = String(req.header('origin') || '<no-origin>');
      const ip = req.ip || req.socket.remoteAddress || '?';
      const start = Date.now();
      res.on('finish', () => {
        const dt = Date.now() - start;
        const status = res.statusCode;
        const tag = status >= 400 ? 'ERR' : 'req';
        console.log(`[${tag}] ${req.method} ${req.path} → ${status} (${dt}ms) origin=${origin} ip=${ip} ua=${ua}`);
      });
    }
    next();
  });

  const configuredCorsOrigins = String(process.env.CORS_ALLOW_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // BUG_FIX_CONTEXT: dev-сервер отдаёт frontend и backend с одного origin (localhost:3000).
  // Когда Vite-middleware подгружает /@react-refresh и прочие HMR-эндпоинты, браузер
  // отправляет Origin: http://localhost:3000 даже для same-origin запросов. CORS-middleware
  // (см. ниже) рубил их 403, потому что в fallbackCorsOrigins не было self-origin'а.
  // Добавили http://localhost:3000 и http://127.0.0.1:3000.
  const fallbackCorsOrigins = isProduction ? [] : [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.31.24:5173',
    'capacitor://localhost',
    'http://localhost',
    'http://127.0.0.1',
  ];

  const allowedOrigins = configuredCorsOrigins.length > 0 ? configuredCorsOrigins : fallbackCorsOrigins;
  if (isProduction && configuredCorsOrigins.length === 0) {
    console.warn('CORS_ALLOW_ORIGINS is not set in production. Browser cross-origin requests will be rejected.');
  }

  // BUG_FIX_CONTEXT (FIND-008): Origin-based CSRF mitigation. Для mutating
  // методов (POST/PUT/PATCH/DELETE) проверяем Origin:
  //   - Origin отсутствует (native server-to-server, fetch без CORS) → пропускаем.
  //   - Origin === 'null' (opaque-origin native WebView, sandboxed iframe,
  //     redirect cross-origin) → пропускаем как native context. Capacitor APK
  //     для cross-origin XHR может слать именно "null" вместо http://localhost,
  //     если запрос прошёл через ServiceWorker или редирект — без этой
  //     ветки регистрация/логин падали 403 ("Нет соединения с сервером" в UI).
  //     Безопасность: SameSite=Lax cookie не уходит на cross-site POST,
  //     реальный CSRF-атакующий из браузера всегда имеет конкретный Origin.
  //   - Origin есть и НЕ в allowedOrigins → 403.
  const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const isAllowedOrigin = (origin: string): boolean =>
    origin === 'null' || allowedOrigins.includes(origin);

  app.use((req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) { next(); return; }
    const origin = req.header('origin');
    if (!origin) { next(); return; }
    if (!isAllowedOrigin(origin)) {
      console.warn(`[csrf] blocked Origin=${origin} method=${req.method} path=${req.path}`);
      res.status(403).json({ error: 'origin_not_allowed', message: `Origin ${origin} blocked by CSRF guard` });
      return;
    }
    next();
  });

  app.use((req, res, next) => {
    const origin = req.header('origin');
    if (!origin) {
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    if (!isAllowedOrigin(origin)) {
      res.status(403).json({
        error: 'origin_not_allowed',
        message: `Origin ${origin} is not allowed`,
      });
      return;
    }

    // Для opaque-origin (Origin: null) возвращаем "null" как ACAO — это
    // валидный CORS-ответ по спецификации Fetch и нужен Capacitor WebView,
    // чтобы fetch не упал на CORS-проверке после ответа сервера.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token, X-Client-Platform');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  const navyApiKey = String(process.env.NAVY_API_KEY || '').trim();
  const navyModel = String(process.env.NAVY_MODEL || 'gpt-4.1').trim();
  const navyBaseUrl = 'https://api.navy/v1';
  const authRateLimit = createRateLimiter(30, 60_000);
  const writeRateLimit = createRateLimiter(60, 60_000); // posts/comments/statuses
  const forgotRateLimit = createRateLimiter(5, 60_000);  // forgot-password старт
  const aiRateLimit = createRateLimiter(20, 60_000);

  // Отдельный секрет для подписи HMAC билета. Best-practice — не переиспользовать
  // session secret для криптографических артефактов. Если TICKET_HMAC_SECRET
  // не задан — fallback на sessionSecret (обратная совместимость со старыми
  // деплоями), но в production лог-предупреждение.
  const ticketHmacSecret = String(process.env.TICKET_HMAC_SECRET || '').trim() || sessionSecret;
  if (isProduction && ticketHmacSecret === sessionSecret) {
    log.warn('security', 'TICKET_HMAC_SECRET is not set — falling back to SESSION_SECRET. Set a separate value in .env.production.');
  }

  // Sanity-check соединения с БД до старта роутов. Делаем 3 retry с
  // backoff'ом — на холодном старте VPS Postgres может не успеть к ноду.
  {
    let attempt = 0;
    const maxAttempts = 3;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await pool.query('SELECT 1');
        log.info('db', `connection OK${attempt ? ` (after ${attempt} retries)` : ''}`);
        break;
      } catch (err) {
        attempt += 1;
        if (attempt >= maxAttempts) {
          log.error('db', 'connection FAILED — aborting server start', { err: String(err), attempt });
          process.exit(1);
        }
        log.warn('db', `connection attempt ${attempt}/${maxAttempts} failed, retrying in 1s`, { err: String(err) });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // ========================================================================
  // FILE UPLOADS (avatars)
  // ========================================================================
  // BUG_FIX_CONTEXT: Avatar uploads — multer пишет файлы в UPLOAD_DIR
  // (по умолчанию /var/data/uploads). Static handler смонтирован ДО api router'ов,
  // чтобы /uploads/<file> шёл напрямую в express.static, а не через api 404.
  const uploadDir = String(process.env.UPLOAD_DIR || '/var/data/uploads').trim();
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn(`[uploads] mkdir failed for ${uploadDir}:`, err);
  }
  const upload = multer({
    dest: uploadDir,
    // 6MB на серверной стороне — чуть меньше nginx 8MB, чтобы multer
    // первый отдал понятную ошибку, а не EPIPE из nginx.
    limits: { fileSize: 6 * 1024 * 1024 },
  });
  // Публичные ассеты — только аватары и публичные media. DM-attachments
  // живут в подпапке dm/ и отдаются через приватный route (см. ниже)
  // с проверкой что юзер — участник этого диалога.
  const dmDir = path.join(uploadDir, 'dm');
  try { fs.mkdirSync(dmDir, { recursive: true }); } catch { /* noop */ }

  // Публичная статика — аватары и т.п. (имена в корне uploads).
  // Запрещаем подъём в подпапку dm через путь.
  // === HMAC media URL signing ===
  // ROOT-CAUSE: native <audio>/<video>/<img> элементы загружают URL через
  // WebView напрямую, минуя CapacitorHttp. У них своя cookie jar — наша
  // session cookie туда не попадает → 401 от auth-протектед /uploads/dm/.
  // Также CapacitorHttp.fetch не реализует .blob() для binary responses —
  // фронтовый pre-fetch + blob URL workaround тоже не работал стабильно.
  // FIX: подписываем URL HMAC'ом на эмиссии (когда выдаём mediaUrl фронту);
  // /uploads/dm/<file> принимает либо session-cookie, либо валидный sig+exp.
  // TTL 24 ч — достаточно чтобы юзер послушал/посмотрел media в чате,
  // даже если открыл диалог через сутки. После TTL → fronted polling
  // получит свежий sig в /messages/with response.
  const MEDIA_URL_TTL_MS = 24 * 60 * 60 * 1000;
  function stripMediaQuery(u: string | null | undefined): string | null {
    if (!u) return null;
    const q = u.indexOf('?');
    return q >= 0 ? u.slice(0, q) : u;
  }
  function signMediaUrl(relUrlMaybeQuery: string): string {
    // Защита от двойного подписания: если на вход пришёл уже подписанный
    // URL (?exp=&sig=), сначала отрезаем query, потом подписываем заново.
    // Раньше в DB хранились URL с sig, на emit signMediaUrl навешивал
    // ВТОРОЙ ?exp=&sig= → клиент получал ?A?B → 401 от сервера → media
    // не игралось.
    const relUrl = stripMediaQuery(relUrlMaybeQuery);
    if (!relUrl || !relUrl.startsWith('/uploads/dm/')) return relUrlMaybeQuery;
    const exp = Date.now() + MEDIA_URL_TTL_MS;
    const payload = `${relUrl}|${exp}`;
    const sig = crypto.createHmac('sha256', sessionSecret).update(payload).digest('hex').slice(0, 32);
    return `${relUrl}?exp=${exp}&sig=${sig}`;
  }
  function verifyMediaSig(relUrl: string, expRaw: unknown, sigRaw: unknown): boolean {
    if (typeof expRaw !== 'string' || typeof sigRaw !== 'string') return false;
    const expNum = parseInt(expRaw, 10);
    if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
    const expected = crypto.createHmac('sha256', sessionSecret).update(`${relUrl}|${expNum}`).digest('hex').slice(0, 32);
    if (sigRaw.length !== expected.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(sigRaw), Buffer.from(expected)); }
    catch { return false; }
  }

  // Приватные DM-attachments.
  // Доступны если: (a) валидная session-cookie + юзер — участник DM,
  //                ИЛИ (b) валидный HMAC-signed URL (sig + exp в query).
  app.get('/uploads/dm/:filename', async (req, res) => {
    const filename = String(req.params.filename || '');
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      res.status(400).json({ error: 'invalid_filename' });
      return;
    }
    const relUrl = `/uploads/dm/${filename}`;

    // Path A: HMAC-signed URL (для нативных <audio>/<video>/<img>, у которых
    // нет наших session cookies).
    if (verifyMediaSig(relUrl, req.query.exp, req.query.sig)) {
      res.sendFile(path.join(dmDir, filename));
      return;
    }

    // Path B: session cookie + участник DM.
    const userId = req.session?.userId;
    if (!userId) {
      res.status(401).json({ error: 'auth_required' });
      return;
    }
    const dmRows = await db.select({
      from: directMessages.fromUserId,
      to: directMessages.toUserId,
    }).from(directMessages).where(eq(directMessages.mediaUrl, relUrl)).limit(1);
    const dm = dmRows[0];
    if (!dm) {
      res.status(404).json({ error: 'media_not_found' });
      return;
    }
    if (dm.from !== userId && dm.to !== userId) {
      res.status(403).json({ error: 'not_a_participant' });
      return;
    }
    res.sendFile(path.join(dmDir, filename));
  });

  // Static-доступ к публичным /uploads/<avatar>.<ext>. /dm/ блокируется
  // явно — выше уже отработал dedicated route с sig/cookie проверкой;
  // если до сюда дошло — кто-то пытается обойти.
  app.use('/uploads', (req, res, next) => {
    const decodedPath = decodeURIComponent(req.path);
    if (decodedPath.startsWith('/dm/') || decodedPath.includes('/dm/')) {
      res.status(404).end();
      return;
    }
    next();
  }, express.static(uploadDir, { fallthrough: true }));

  const api = express.Router();

  // ========================================================================
  // HEALTH
  // ========================================================================

  // /health — кэш на 1 секунду. Под poll-нагрузкой от LB это снимает 99%
  // SELECT 1 запросов и не размывает картину свежести (1с задержка терпимо).
  let healthCache: { ts: number; payload: unknown } = { ts: 0, payload: null };
  api.get('/health', async (_req, res) => {
    const now = Date.now();
    if (healthCache.payload && now - healthCache.ts < 1000) {
      res.json(healthCache.payload);
      return;
    }
    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    const payload = {
      status: dbOk ? 'ok' : 'degraded',
      service: 'backend-api',
      architecture: 'Express + Postgres (Drizzle)',
      db: dbOk ? 'up' : 'down',
    };
    healthCache = { ts: now, payload };
    res.json(payload);
  });

  api.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  // ========================================================================
  // AI (Gemini proxy)
  // ========================================================================

  // BUG_FIX_CONTEXT: AI Chat event-aware. Раньше /ai/chat был общим LLM proxy
  // без знания о конференции — на вопрос "что мне посетить про AI?" отвечал
  // как обычный ChatGPT. Теперь на каждый запрос инжектируем компактный
  // снимок программы (TRACKS, SESSIONS, SPEAKERS, EVENT_META) как system-context.
  // Gemini ест ~6KB этого контекста легко (input до 1M токенов). Function-calling
  // не используем — простой prompt-injection даёт 95% эффекта.
  // Кэшируем event-context. Данные программы статичны до перезапуска
  // сервиса; нет смысла пересобирать ~5KB строки на каждый AI-запрос.
  let eventContextCache: string | null = null;
  function buildEventContext(): string {
    if (eventContextCache !== null) return eventContextCache;
    const lines: string[] = [];
    lines.push(`# КОНФЕРЕНЦИЯ: ${EVENT_META.name}`);
    lines.push(`Локация: ${EVENT_META.location}, ${EVENT_META.city}`);
    lines.push(`Организатор: ${EVENT_META.organizer} (${EVENT_META.organizerEmail})`);
    lines.push('');
    lines.push('## ДНИ:');
    for (const d of DAYS) lines.push(`- ${d.id}: ${d.label} ${d.weekday} (${d.date})`);
    lines.push('');
    lines.push('## ТРЕКИ:');
    for (const t of TRACKS) lines.push(`- ${t.id}: ${t.name}`);
    lines.push('');
    lines.push('## ЗАЛЫ:');
    for (const h of HALLS) lines.push(`- ${h.id}: ${h.name} (вместимость ${h.capacity})`);
    lines.push('');
    lines.push('## СПИКЕРЫ:');
    for (const sp of SPEAKERS) {
      lines.push(`- ${sp.name} | ${sp.role}, ${sp.company} | трек: ${sp.trackId} | тема: ${sp.topic ?? '—'}`);
    }
    lines.push('');
    lines.push('## ПРОГРАММА:');
    for (const s of SESSIONS) {
      const day = DAYS.find(d => d.id === s.dayId)?.label ?? s.dayId;
      const speakerNames = s.speakerIds.map((id: string) => SPEAKERS.find(x => x.id === id)?.name ?? id).join(', ') || '—';
      lines.push(`- [${day} ${s.startTime}-${s.endTime}] ${s.format.toUpperCase()} «${s.title}» в ${s.location}, трек: ${s.trackId ?? '—'}, спикеры: ${speakerNames}`);
    }
    lines.push('');
    lines.push('## ПАРТНЁРЫ:');
    for (const p of PARTNERS) lines.push(`- ${p.name} (${p.tier}): ${p.description}`);
    eventContextCache = lines.join('\n');
    return eventContextCache;
  }

  function buildSystemInstruction(): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Saratov' });
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Saratov' });
    return [
      'Ты — AI-ассистент конференции TechForum 2026 от «Технологии Права».',
      `Сегодня: ${dateStr}, текущее время: ${timeStr} (Europe/Saratov).`,
      '',
      '## Что ты умеешь:',
      '1. **Навигация по программе** — подсказать какие сессии идут сейчас, скоро, или по конкретной теме/спикеру.',
      '2. **Рекомендации** — подобрать сессии по интересам участника (AI, Legal Tech, кибербез, и т.д.).',
      '3. **Информация о спикерах** — био, тема доклада, когда и где выступает.',
      '4. **Практическая помощь** — залы, вместимость, расписание по дням, форматы сессий.',
      '5. **Нетворкинг** — подсказать к кому подойти на основе тематики, предложить сессии для знакомств.',
      '',
      '## Правила:',
      '- Отвечай по-русски, кратко (2-5 предложений), дружелюбно и по делу.',
      '- Используй ТОЛЬКО факты из контекста программы ниже. Не выдумывай сессий и спикеров.',
      '- Если вопрос вне программы — скажи что не нашёл и предложи ближайшую релевантную сессию.',
      '- Используй эмодзи умеренно для дружелюбности.',
      '- При перечислении сессий указывай: название, время, зал, спикера.',
      '- Не путай даты: если тебя спросят какое сегодня число, используй дату из строки выше.',
      '- Если форум ещё не начался — скажи сколько дней осталось.',
      '- Если форум уже идёт — подсказывай что сейчас и что дальше по расписанию.',
      '- Если аудио-сообщение прислали в виде текста (транскрипция) — отвечай на содержание, не комментируй формат.',
    ].join('\n');
  }

  // GET /ai/history — последние 200 сообщений AI-чата текущего пользователя.
  api.get('/ai/history', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const rows = await db.select({
      id: aiChatMessages.id,
      role: aiChatMessages.role,
      text: aiChatMessages.text,
      createdAt: aiChatMessages.createdAt,
    })
      .from(aiChatMessages)
      .where(eq(aiChatMessages.userId, userId))
      .orderBy(asc(aiChatMessages.createdAt))
      .limit(200);
    res.json(rows);
  });

  api.post('/ai/chat', aiRateLimit, requireAuth, validateBody(aiChatSchema), async (req, res) => {
    const { message, context: userContext } = req.body as import('./src/lib/validation.js').AiChatBody;

    if (!navyApiKey) {
      res.status(503).json({ error: 'ai_not_configured' });
      return;
    }

    const eventContext = buildEventContext();
    const systemPrompt = [
      buildSystemInstruction(),
      '',
      '=== КОНТЕКСТ ПРОГРАММЫ ===',
      eventContext,
      '=== КОНЕЦ КОНТЕКСТА ===',
    ].join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
    ];
    if (userContext) {
      messages.push({ role: 'system', content: `Дополнительный контекст: ${userContext}` });
    }
    messages.push({ role: 'user', content: message });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const resp = await fetch(`${navyBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${navyApiKey}`,
        },
        body: JSON.stringify({
          model: navyModel,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '');
        log.error('ai', 'navy api error', { status: resp.status, body: errBody });
        res.status(502).json({ error: 'ai_unavailable' });
        return;
      }

      const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      if (!text) {
        res.status(502).json({ error: 'ai_empty_response' });
        return;
      }

      // Persist both user message and bot response to DB (fire-and-forget,
      // don't block the response on DB write).
      const userId = getSessionUserId(req)!;
      const userMsgId = crypto.randomUUID();
      const botMsgId = crypto.randomUUID();
      const now = new Date();
      db.insert(aiChatMessages).values([
        { id: userMsgId, userId, role: 'user', text: message, createdAt: now },
        { id: botMsgId, userId, role: 'bot', text, createdAt: new Date(now.getTime() + 1) },
      ]).catch((err: any) => log.error('ai', 'failed to persist ai chat', { err: String(err) }));

      res.json({ text });
    } catch (error: any) {
      clearTimeout(timeout);
      const isAbort = error?.name === 'AbortError';
      log.error('ai', isAbort ? 'chat timeout' : 'chat error', { err: String(error) });
      res.status(isAbort ? 504 : 502).json({ error: isAbort ? 'ai_timeout' : 'ai_unavailable' });
    }
  });

  api.post('/ai/transcribe', aiRateLimit, requireAuth, upload.single('audio'), async (req, res) => {
    if (!navyApiKey) {
      res.status(503).json({ error: 'ai_not_configured' });
      return;
    }
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: 'no_audio_file' });
      return;
    }
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: file.mimetype || 'audio/webm' }), file.originalname || 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ru');
      const resp = await fetch(`${navyBaseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${navyApiKey}` },
        body: formData,
      });
      try { fs.unlinkSync(file.path); } catch { /* cleanup */ }
      if (!resp.ok) {
        res.status(502).json({ error: 'transcription_failed' });
        return;
      }
      const data = await resp.json() as { text?: string };
      res.json({ text: data.text || '' });
    } catch (error: any) {
      try { if (file.path) fs.unlinkSync(file.path); } catch { /* cleanup */ }
      log.error('ai', 'transcription error', { err: String(error) });
      res.status(502).json({ error: 'transcription_error' });
    }
  });

  // ========================================================================
  // AUTH
  // ========================================================================

  api.post('/auth/register', authRateLimit, validateBody(authRegisterSchema), async (req, res) => {
    const { email, password, name } = req.body as import('./src/lib/validation.js').AuthRegisterBody;

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(400).json({ error: 'Пользователь уже существует' });
      return;
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

    try {
      await db.insert(users).values({
        id,
        email,
        passwordHash,
        name,
        avatar,
        bio: '',
        isPrivate: false,
        role: 'Участник',
      });
    } catch (err) {
      log.error('auth', 'register insert failed', { err: String(err), email });
      res.status(500).json({ error: 'user_create_failed' });
      return;
    }

    // Сессию ставим ТОЛЬКО после успешного insert — иначе при failure
    // юзер был "залогинен под несуществующим userId".
    req.session.userId = id;

    const created = await findUserById(id);
    if (!created) {
      // race с replication — крайне маловероятно, но обработаем чисто
      delete req.session.userId;
      res.status(500).json({ error: 'user_create_failed' });
      return;
    }
    res.json({ ...toPublicUser(created), interestsCount: 0, token: req.sessionID });
  });

  // Per-account brute-force lockout. Счётчик неудачных попыток на email,
  // не на IP — атакующий не обходит сменой IP. После 8 fails в 15 мин —
  // блок на 30 мин. Очищается при успешном логине или forgot-password reset.
  const accountLockout = new Map<string, { fails: number; lockedUntil: number }>();
  function checkAccountLock(email: string): { locked: boolean; retryAfterSec?: number } {
    const e = email.toLowerCase().trim();
    const rec = accountLockout.get(e);
    if (!rec) return { locked: false };
    if (rec.lockedUntil > Date.now()) {
      return { locked: true, retryAfterSec: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
    }
    return { locked: false };
  }
  function noteFailedLogin(email: string): void {
    const e = email.toLowerCase().trim();
    const now = Date.now();
    const rec = accountLockout.get(e) || { fails: 0, lockedUntil: 0 };
    rec.fails += 1;
    if (rec.fails >= 8) {
      rec.lockedUntil = now + 30 * 60 * 1000;
      rec.fails = 0;
    }
    accountLockout.set(e, rec);
  }
  function clearAccountLock(email: string): void {
    accountLockout.delete(email.toLowerCase().trim());
  }

  api.post('/auth/login', authRateLimit, validateBody(authLoginSchema), async (req, res) => {
    const { email, password } = req.body as import('./src/lib/validation.js').AuthLoginBody;

    const lock = checkAccountLock(email);
    if (lock.locked) {
      res.setHeader('Retry-After', String(lock.retryAfterSec || 60));
      res.status(429).json({ error: 'account_locked', retryAfterSeconds: lock.retryAfterSec });
      return;
    }

    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      noteFailedLogin(email);
      res.status(401).json({ error: 'Неверные данные' });
      return;
    }
    clearAccountLock(email);

    req.session.userId = user.id;
    const interestRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInterests)
      .where(eq(userInterests.userId, user.id));
    res.json({ ...toPublicUser(user), interestsCount: interestRows[0]?.count ?? 0, token: req.sessionID });
  });

  // logout без rate-limit: один и тот же клиент может тыкнуть N раз — это
  // легитимно и не нагружает БД (просто destroy сессии).
  api.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });

  api.get('/auth/me', async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const user = await findUserById(userId);
    if (!user) {
      // session ссылается на удалённого юзера — чистим
      delete req.session.userId;
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const interestRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userInterests)
      .where(eq(userInterests.userId, userId));
    res.json({ ...toPublicUser(user), interestsCount: interestRows[0]?.count ?? 0 });
  });

  api.patch('/auth/me', requireAuth, validateBody(authMePatchSchema), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const user = await findUserById(userId);
    if (!user) {
      delete req.session.userId;
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const { name, bio, phone, email: emailRaw, pushPreviewHidden, company, workplace, education, birthday } = req.body as any;

    let nextEmail = user.email;
    if (emailRaw && emailRaw !== user.email) {
      const dup = await findUserByEmail(emailRaw);
      if (dup && dup.id !== user.id) {
        res.status(400).json({ error: 'Email уже используется' });
        return;
      }
      nextEmail = emailRaw;
    }

    await db.update(users).set({
      name: name ?? user.name,
      bio: bio ?? user.bio,
      phone: phone ?? user.phone,
      email: nextEmail,
      company: company ?? (user as any).company ?? '',
      workplace: workplace ?? (user as any).workplace ?? '',
      education: education ?? (user as any).education ?? '',
      birthday: birthday ?? (user as any).birthday ?? '',
      pushPreviewHidden: pushPreviewHidden ?? user.pushPreviewHidden,
    }).where(eq(users.id, user.id));

    const updated = await findUserById(user.id);
    if (!updated) {
      res.status(500).json({ error: 'user_update_failed' });
      return;
    }
    // Include interestsCount so frontend doesn't lose it and redirect to onboarding
    const interestRows = await db.select({ count: count() }).from(userInterests).where(eq(userInterests.userId, user.id));
    res.json({ ...toPublicUser(updated), interestsCount: interestRows[0]?.count ?? 0 });
  });

  // ========================================================================
  // FORGOT PASSWORD
  // ========================================================================
  // Двухшаговый сброс пароля. Шаг 1 (start): по email создаём короткий
  // токен, ставим TTL 30 минут, лимит 3 активных одновременно. Уведомление
  // (email-link или SMS-код) — через sendResetNotification(); если транспорт
  // не настроен (dev / отсутствие SMTP_URL), линк/токен попадает в server-лог
  // — оператор передаёт пользователю вручную.
  // Шаг 2 (verify): принимаем raw token + новый пароль, валидируем хеш+TTL,
  // меняем passwordHash, удаляем все reset-токены этого юзера.
  //
  // Anti-enumeration: на /start всегда возвращаем 200 ok, не раскрывая
  // существование email-а в БД. Реальная отсылка идёт только если юзер найден.

  function hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async function sendResetNotification(email: string, token: string, tokenId: string): Promise<void> {
    // BACKEND_TODO: интегрировать SMTP / SMS-провайдер.
    // SECURITY: НЕ логируем raw token. Логируем только token-id и факт.
    // Оператор может выдать новый токен через POST /admin/reset-tokens
    // (header X-Admin-Secret) пока SMTP не подключён.
    log.info('forgot-password', `reset issued`, { email, tokenId, ttl: '30m' });
    void token;
  }

  // ADMIN: выдача reset-token оператором без SMTP. Защищено header'ом
  // X-Admin-Secret = process.env.ADMIN_SECRET. Если ADMIN_SECRET не задан
  // в env — endpoint выключен (всегда 503), чтобы не было silent-bypass'а.
  // Оператор делает curl, получает raw-token и пересылает юзеру лично.
  const adminSecret = String(process.env.ADMIN_SECRET || '').trim();
  api.post('/admin/reset-tokens', forgotRateLimit, async (req, res) => {
    if (!adminSecret) {
      res.status(503).json({ error: 'admin_disabled', detail: 'ADMIN_SECRET not configured' });
      return;
    }
    const provided = String(req.header('x-admin-secret') || '').trim();
    if (!provided || provided !== adminSecret) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const email = String((req.body as { email?: unknown })?.email || '').trim().toLowerCase();
    if (!email || !/^.+@.+\..+$/.test(email)) {
      res.status(400).json({ error: 'invalid_email' });
      return;
    }
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    await cleanupExpiredResetTokensIfStale();
    const id = crypto.randomUUID();
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(passwordResetTokens).values({
      id, userId: user.id, tokenHash, expiresAt, attempts: 0,
    });
    log.info('forgot-password', 'admin issued token', { email, tokenId: id });
    res.json({ token: rawToken, ttlSeconds: 30 * 60, userId: user.id });
  });

  // Глобальная очистка истёкших reset-токенов. Дешёвая (один DELETE WHERE
  // expires_at < now()) и предотвращает рост таблицы при долгой истории.
  // Вызывается при каждом /start — в худшем случае O(rows) раз в сутки.
  let lastGlobalResetCleanup = 0;
  async function cleanupExpiredResetTokensIfStale(): Promise<void> {
    const now = Date.now();
    if (now - lastGlobalResetCleanup < 60 * 60 * 1000) return; // не чаще раза в час
    lastGlobalResetCleanup = now;
    try {
      await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
    } catch (err) {
      log.warn('forgot-password', 'global cleanup failed', { err: String(err) });
    }
  }

  api.post('/auth/forgot-password/start', forgotRateLimit, validateBody(forgotPasswordStartSchema), async (req, res) => {
    const { email } = req.body as import('./src/lib/validation.js').ForgotPasswordStartBody;
    await cleanupExpiredResetTokensIfStale();
    const user = await findUserByEmail(email);

    // Anti-enumeration: всегда отвечаем 200, даже если юзера нет.
    if (!user) {
      res.json({ ok: true, ttlSeconds: 30 * 60 });
      return;
    }

    // Чистим истёкшие токены этого юзера + ограничиваем кол-во активных.
    const now = new Date();
    await db.delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), lt(passwordResetTokens.expiresAt, now)));
    const active = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    if (active.length >= 3) {
      // Слишком много активных — отдаём 429, чтобы не плодить спам.
      res.status(429).json({ error: 'too_many_active_resets' });
      return;
    }

    const id = crypto.randomUUID();
    const rawToken = crypto.randomBytes(24).toString('base64url'); // 32-символьная url-safe строка
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      id,
      userId: user.id,
      tokenHash,
      expiresAt,
      attempts: 0,
    });

    await sendResetNotification(user.email, rawToken, id);

    res.json({ ok: true, ttlSeconds: 30 * 60 });
  });

  api.post('/auth/forgot-password/verify', forgotRateLimit, validateBody(forgotPasswordVerifySchema), async (req, res) => {
    const { token, newPassword } = req.body as import('./src/lib/validation.js').ForgotPasswordVerifyBody;
    const tokenHash = hashResetToken(token);

    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1);
    const row = rows[0];
    if (!row) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }
    if (row.expiresAt.getTime() < Date.now()) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id));
      res.status(400).json({ error: 'token_expired' });
      return;
    }
    if (row.attempts >= 5) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id));
      res.status(429).json({ error: 'too_many_attempts' });
      return;
    }

    const user = await findUserById(row.userId);
    if (!user) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id));
      res.status(400).json({ error: 'invalid_token' });
      return;
    }

    const passwordHash = hashPassword(newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      // SECURITY (CRITICAL FIX): инвалидируем ВСЕ активные сессии этого
      // юзера. connect-pg-simple хранит сессии в таблице "session" с
      // полем "sess" (jsonb). Удаляем строки, у которых sess->>'userId'
      // равен нашему user.id. Без этого украденная cookie оставалась
      // валидной 30 дней даже после reset password.
      await tx.execute(sql`DELETE FROM "session" WHERE sess->>'userId' = ${user.id}`);
    });

    res.json({ ok: true });
  });

  // ========================================================================
  // AVATAR UPLOAD
  // ========================================================================

  // SECURITY (P0 FIX): проверяем magic-bytes файла, а не только клиентский
  // Content-Type заголовок. Раньше можно было загрузить ELF / .exe с mime
  // image/jpeg и сервер сохранял его как аватар.
  // Magic bytes:
  //  JPEG: FF D8 FF
  //  PNG:  89 50 4E 47 0D 0A 1A 0A
  //  WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  (RIFF...WEBP)
  function detectImageType(filePath: string): 'jpg' | 'png' | 'webp' | null {
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(12);
      fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);
      if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
      if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
          && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'webp';
      return null;
    } catch { return null; }
  }
  function detectMediaType(filePath: string, declaredMime: string): { type: 'image' | 'audio' | 'video'; ext: string } | null {
    const img = detectImageType(filePath);
    if (img) return { type: 'image', ext: img };
    // Для audio/video magic-bytes сложнее (множество форматов), полагаемся на
    // mime-объявление, но НЕ доверяем тексту — multer уже отверг бы text/*.
    // Дополнительно проверяем что первый байт не ASCII text:
    try {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(4);
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);
      const isPrintableAscii = buf.every((b) => b >= 0x20 && b <= 0x7e);
      if (isPrintableAscii) return null; // тексты + ELF (0x7f) исключаем
      // ELF: 7f 45 4c 46
      if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return null;
    } catch { return null; }
    const audioMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg':  'ogg',
      'audio/mp4':  'm4a',
      'audio/mpeg': 'mp3',
    };
    const videoMap: Record<string, string> = {
      'video/webm': 'webm',
      'video/mp4':  'mp4',
    };
    if (audioMap[declaredMime]) return { type: 'audio', ext: audioMap[declaredMime] };
    if (videoMap[declaredMime]) return { type: 'video', ext: videoMap[declaredMime] };
    return null;
  }

  const MIME_TO_EXT: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  api.post('/me/avatar', requireAuth, upload.single('file'), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    // SECURITY: проверяем magic-bytes, а не клиентский Content-Type.
    // ELF/exe/что-угодно с mime=image/jpeg раньше проходило.
    const detected = detectImageType(file.path);
    if (!detected) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      res.status(400).json({ error: 'invalid_image', detail: 'magic_bytes_mismatch' });
      return;
    }
    const ext = detected;
    void MIME_TO_EXT; // больше не используем mime-table — magic bytes overrides

    const user = await findUserById(userId);
    if (!user) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      delete req.session.userId;
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    // Multer пишет файл с UUID-именем без расширения. Переименовываем
    // в <filename>.<ext>, чтобы клиенты с extension-based кэшем (iOS Safari,
    // некоторые WebView) корректно определяли тип.
    const finalName = `${file.filename}.${ext}`;
    const finalPath = path.join(uploadDir, finalName);
    try {
      fs.renameSync(file.path, finalPath);
    } catch (err) {
      log.error('uploads', 'rename failed', { from: file.path, to: finalPath, err: String(err) });
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      res.status(500).json({ error: 'upload_persist_failed' });
      return;
    }

    // Удаляем старый аватар, если он наш (хранится в /uploads/). Внешние
    // ссылки (api.dicebear.com и т.п.) пропускаем.
    const previousAvatar = user.avatar;
    if (previousAvatar.startsWith('/uploads/')) {
      const oldPath = path.join(uploadDir, path.basename(previousAvatar));
      // Защита от path traversal: убеждаемся что resolved path внутри uploadDir.
      if (path.resolve(oldPath).startsWith(path.resolve(uploadDir))) {
        try { fs.unlinkSync(oldPath); } catch { /* старого может уже не быть */ }
      }
    }

    const relativeUrl = `/uploads/${finalName}`;
    await db.update(users).set({ avatar: relativeUrl }).where(eq(users.id, user.id));

    res.json({ avatar: relativeUrl });
  });

  // ========================================================================
  // POSTS / COMMENTS / LIKES
  // ========================================================================

  api.post('/posts', requireAuth, writeRateLimit, validateBody(postCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const { type, url, text } = req.body as import('./src/lib/validation.js').PostCreateBody;
    const id = crypto.randomUUID();
    await db.insert(posts).values({ id, userId, type, url, text });

    const inserted = (await db.select().from(posts).where(eq(posts.id, id)).limit(1))[0];
    if (!inserted) {
      res.status(500).json({ error: 'post_create_failed' });
      return;
    }

    res.json({
      id: inserted.id,
      userId: inserted.userId,
      type: inserted.type,
      url: inserted.url,
      text: inserted.text,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: inserted.createdAt,
    });
  });

  // GET /posts — пагинация + SQL ILIKE поиск + counts через GROUP BY.
  // Контракт ответа сохранён (массив posts с user/likes/comments), но
  // добавлены query-параметры:
  //   ?limit=N   (default 50, max 100)
  //   ?offset=N  (default 0)
  //   ?q=text    (поиск по тексту поста + имени автора)
  // Раньше тянули все посты+likes+comments в JS — heap-bomb на росте.
  api.get('/posts', async (req, res) => {
    const limitRaw = Number(req.query?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 50;
    const offsetRaw = Number(req.query?.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
    const query = String(req.query?.q || '').trim();

    // Поиск делаем на уровне SQL: ILIKE по тексту поста и имени автора.
    // Используем LEFT JOIN users, фильтр через WHERE с параметром.
    const likePattern = `%${query.replace(/[%_]/g, '\\$&')}%`;
    const baseRows = query
      ? await db
          .select({ post: posts, author: users })
          .from(posts)
          .leftJoin(users, eq(users.id, posts.userId))
          .where(sql`${posts.text} ILIKE ${likePattern} OR ${users.name} ILIKE ${likePattern}`)
          .orderBy(desc(posts.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select({ post: posts, author: users })
          .from(posts)
          .leftJoin(users, eq(users.id, posts.userId))
          .orderBy(desc(posts.createdAt))
          .limit(limit)
          .offset(offset);

    if (baseRows.length === 0) {
      res.json([]);
      return;
    }

    const postIds = baseRows.map((r) => r.post.id);

    // Likes — все строки для текущей страницы (нужен likedBy[]).
    const likesRows = await db.select().from(postLikes).where(inArray(postLikes.postId, postIds));
    const likesByPost = new Map<string, string[]>();
    for (const l of likesRows) {
      const arr = likesByPost.get(l.postId) ?? [];
      arr.push(l.userId);
      likesByPost.set(l.postId, arr);
    }

    // Comments — только для постов текущей страницы.
    const commentsRows = await db.select().from(postComments)
      .where(inArray(postComments.postId, postIds))
      .orderBy(desc(postComments.createdAt));
    const commentsByPost = new Map<string, typeof commentsRows>();
    for (const c of commentsRows) {
      const arr = commentsByPost.get(c.postId) ?? [];
      arr.push(c);
      commentsByPost.set(c.postId, arr);
    }

    const feed = baseRows.map(({ post, author }) => {
      const likedBy = likesByPost.get(post.id) ?? [];
      const comments = (commentsByPost.get(post.id) ?? []).map((c) => ({
        id: c.id,
        userId: c.userId,
        text: c.text,
        createdAt: c.createdAt,
      }));
      return {
        id: post.id,
        userId: post.userId,
        type: post.type,
        url: post.url,
        text: post.text,
        likes: likedBy.length,
        likedBy,
        comments,
        createdAt: post.createdAt,
        user: author ? toPublicUser(author) : null,
      };
    });

    res.json(feed);
  });

  // POST /posts/:id/like — toggle через ON CONFLICT, без race.
  // Раньше: SELECT → INSERT/DELETE — между шагами 1-2 другой клиент
  // мог нарушить unique-constraint и handler падал 500. Теперь:
  //   INSERT ... ON CONFLICT DO NOTHING — если строка уже была, INSERT no-op,
  //   воспринимаем как "снятие лайка" → DELETE и возвращаем liked=false.
  api.post('/posts/:id/like', requireAuth, writeRateLimit, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const postId = String(req.params.id);

    const post = (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0];
    if (!post) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }

    const inserted = await db.insert(postLikes)
      .values({ postId, userId })
      .onConflictDoNothing()
      .returning();
    let liked: boolean;
    if (inserted.length > 0) {
      liked = true;
    } else {
      // строка уже существовала — toggle на снятие лайка
      await db.delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
      liked = false;
    }

    // Считаем total на уровне SQL — без bring-all-rows-in-JS.
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, postId));
    res.json({ likes: countRows[0]?.count ?? 0, liked });
  });

  api.post('/posts/:id/comment', requireAuth, writeRateLimit, validateBody(commentCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const postId = String(req.params.id);
    const { text } = req.body as import('./src/lib/validation.js').CommentCreateBody;

    const post = (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0];
    if (!post) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }

    const id = crypto.randomUUID();
    await db.insert(postComments).values({ id, postId, userId, text });
    const inserted = (await db.select().from(postComments).where(eq(postComments.id, id)).limit(1))[0];
    if (!inserted) {
      res.status(500).json({ error: 'comment_create_failed' });
      return;
    }
    res.json({
      id: inserted.id,
      userId: inserted.userId,
      text: inserted.text,
      createdAt: inserted.createdAt,
    });
  });

  // ========================================================================
  // USERS (search для DM new-dialog)
  // ========================================================================
  // Простой prefix-поиск по email/name — нужен в Chat «Личные» когда юзер
  // хочет начать новый диалог. Минимум 2 символа в q. Возвращает только
  // public-поля (id, name, email, avatar, role) без password_hash.
  // SECURITY (P1 FIX): не отдаём email и phone в результатах поиска —
  // раньше любой залогиненный мог выкачать всю базу email-ов через
  // %a% %b% запросы (~26 запросов на весь алфавит). Сейчас отдаём
  // только id/name/avatar/role — этого достаточно для new-DM-dialog.
  // Поиск идёт ТОЛЬКО по name (не по email), чтобы нельзя было
  // подтверждать наличие конкретного email через timing/result.
  api.get('/users/search', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const q = String(req.query?.q || '').trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const limitRaw = Number(req.query?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(50, Math.floor(limitRaw)) : 20;
    const escaped = q.replace(/[%_]/g, '\\$&');
    const pattern = `%${escaped}%`;
    const rows = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      role: users.role,
      isPrivate: users.isPrivate,
    }).from(users)
      .where(sql`${users.name} ILIKE ${pattern} AND ${users.id} <> ${me} AND ${users.isPrivate} = false`)
      .orderBy(users.name)
      .limit(limit);
    res.json(rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, role: r.role })));
  });

  // ========================================================================
  // DIRECT MESSAGES (Chat «Личные»)
  // ========================================================================
  // Простой 1-к-1 polling-DM. Без WS — фронт делает GET /messages/with/:id
  // каждые 5 сек когда диалог открыт. На событии 30/сессия — нагрузка <1 RPS.

  // POST /messages — отправить DM. Создаём запись, возвращаем её для optimistic UI.
  // Поддерживается text + media (image/audio/video) одновременно.
  // Media предварительно загружается через POST /messages/upload-media.
  //
  // Per-receiver rate-limit (P1 FIX): защита от спама с пула ботов.
  // 100 ботов × 60 msg/min = 6000 spam/min на одного юзера обходится так,
  // потому что writeRateLimit у нас per-sender. Дополнительно лимитируем
  // вход на конкретного receiver: 120 msg/min (на всех отправителей вместе).
  const receiverBuckets = new Map<string, { count: number; resetAt: number }>();
  const RECEIVER_LIMIT = 120;
  const RECEIVER_WINDOW = 60_000;
  function noteReceiver(toUserId: string): boolean {
    const now = Date.now();
    const cur = receiverBuckets.get(toUserId);
    if (!cur || cur.resetAt <= now) {
      receiverBuckets.set(toUserId, { count: 1, resetAt: now + RECEIVER_WINDOW });
      return true;
    }
    if (cur.count >= RECEIVER_LIMIT) return false;
    cur.count += 1;
    return true;
  }

  api.post('/messages', requireAuth, writeRateLimit, validateBody(dmSendSchema), async (req, res) => {
    const fromUserId = getSessionUserId(req)!;
    const { toUserId, text, mediaUrl, mediaType, replyToId, forwardedFromUserId } = req.body as import('./src/lib/validation.js').DmSendBody;

    if (toUserId === fromUserId) {
      res.status(400).json({ error: 'cannot_message_self' });
      return;
    }
    if (!noteReceiver(toUserId)) {
      res.status(429).json({ error: 'receiver_rate_limited' });
      return;
    }

    const recipient = await findUserById(toUserId);
    if (!recipient) {
      res.status(404).json({ error: 'recipient_not_found' });
      return;
    }

    // Reply: оригинал должен существовать И принадлежать ЭТОМУ диалогу
    // (между fromUserId↔toUserId в любую сторону). Защита от leak'а — нельзя
    // «ответить» на чужое сообщение из чужой переписки.
    if (replyToId) {
      const orig = (await db.select().from(directMessages)
        .where(eq(directMessages.id, replyToId)).limit(1))[0];
      if (!orig) {
        res.status(404).json({ error: 'reply_target_not_found' });
        return;
      }
      const sameDialog =
        (orig.fromUserId === fromUserId && orig.toUserId === toUserId) ||
        (orig.fromUserId === toUserId && orig.toUserId === fromUserId);
      if (!sameDialog) {
        res.status(403).json({ error: 'reply_target_other_dialog' });
        return;
      }
    }

    // Forward: автор оригинала должен существовать (или null если уже удалён —
    // тогда фронт пришлёт без поля). Никаких extra-checks — forward допускает
    // переслать что угодно куда угодно.
    if (forwardedFromUserId) {
      const author = await findUserById(forwardedFromUserId);
      if (!author) {
        // Не блокируем — просто игнорируем атрибуцию (юзер удалён).
        // Альтернатива — 404, но это сломает UX когда оригинальный автор
        // удалил аккаунт.
      }
    }

    const id = crypto.randomUUID();
    // Storing CANONICAL relUrl без query. signMediaUrl вешает sig только
    // на emit. Иначе — двойное подписание → 401.
    await db.insert(directMessages).values({
      id, fromUserId, toUserId,
      text: text || '',
      mediaUrl: stripMediaQuery(mediaUrl ?? null),
      mediaType: mediaType ?? null,
      replyToId: replyToId ?? null,
      forwardedFromUserId: forwardedFromUserId ?? null,
    });
    const inserted = (await db.select().from(directMessages).where(eq(directMessages.id, id)).limit(1))[0];
    if (!inserted) {
      res.status(500).json({ error: 'dm_create_failed' });
      return;
    }
    const out = {
      id: inserted.id,
      fromUserId: inserted.fromUserId,
      toUserId: inserted.toUserId,
      text: inserted.text,
      mediaUrl: inserted.mediaUrl ? signMediaUrl(inserted.mediaUrl) : null,
      mediaType: inserted.mediaType,
      replyToId: inserted.replyToId,
      forwardedFromUserId: inserted.forwardedFromUserId,
      createdAt: inserted.createdAt,
      readAt: inserted.readAt,
    };
    // Round 4: WebSocket push участникам диалога (отправителю и получателю).
    // Клиенты, у которых открыт WS, увидят сообщение мгновенно — без 4с-poll.
    dmBroadcast({ type: 'dm:new', from: inserted.fromUserId, to: inserted.toUserId, message: out });
    // Round 7: FCM push receiver'у когда приложение в фоне / закрыто.
    // Проверяем pushPreviewHidden — если включено, body = generic.
    void (async () => {
      const sender = await findUserById(fromUserId);
      const senderName = sender?.name ?? 'Участник';
      const recipient = await findUserById(toUserId);
      const hidden = !!recipient?.pushPreviewHidden;
      const previewBody = (text && text.length > 0) ? text : (mediaType ? `[${mediaType}]` : '');
      await sendPushToUser(toUserId, {
        title: hidden ? 'Новое сообщение' : senderName,
        body: hidden ? '' : previewBody.slice(0, 120),
        data: { type: 'dm', from: fromUserId },
        priority: 'high',
      }, db, pushTokens);
    })().catch(() => { /* push failure — DM still delivered via WS+poll */ });
    res.json(out);
  });

  // POST /messages/upload-media — заливка вложения для DM.
  // Принимает один файл (image/audio/video, до 6MB после nginx), сохраняет
  // в /var/data/uploads/<uuid>.<ext>, возвращает {url, type}.
  // Клиент потом шлёт /messages с {mediaUrl, mediaType}.
  const DM_MEDIA_MIME: Record<string, { type: 'image' | 'audio' | 'video'; ext: string }> = {
    'image/jpeg': { type: 'image', ext: 'jpg' },
    'image/png':  { type: 'image', ext: 'png' },
    'image/webp': { type: 'image', ext: 'webp' },
    'audio/webm': { type: 'audio', ext: 'webm' },
    'audio/ogg':  { type: 'audio', ext: 'ogg' },
    'audio/mp4':  { type: 'audio', ext: 'm4a' },
    'audio/mpeg': { type: 'audio', ext: 'mp3' },
    'video/webm': { type: 'video', ext: 'webm' },
    'video/mp4':  { type: 'video', ext: 'mp4' },
  };
  api.post('/messages/upload-media', requireAuth, writeRateLimit, upload.single('file'), async (req, res) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }
    // SECURITY (P0 FIX): magic-bytes-проверка для media (image — точный
    // signature, audio/video — отсев ASCII/ELF + mime-whitelist).
    const detected = detectMediaType(file.path, file.mimetype);
    if (!detected) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      res.status(400).json({ error: 'invalid_media', detail: 'magic_bytes_mismatch_or_unsupported' });
      return;
    }
    void DM_MEDIA_MIME;
    const meta = detected;
    const finalName = `${file.filename}.${meta.ext}`;
    // SECURITY (P0): сохраняем в dm/ — отдаётся только участникам диалога.
    const finalPath = path.join(dmDir, finalName);
    try { fs.renameSync(file.path, finalPath); }
    catch (err) {
      log.error('uploads', 'dm media rename failed', { err: String(err) });
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      res.status(500).json({ error: 'upload_persist_failed' });
      return;
    }
    res.json({ url: signMediaUrl(`/uploads/dm/${finalName}`), type: meta.type });
  });

  // POST /messages/upload-media-base64 — JSON-вариант загрузки.
  // Существует параллельно с multipart-эндпоинтом потому что CapacitorHttp
  // (включён в capacitor.config.ts для обхода cleartext-блока) ломает
  // FormData/multipart-боди — конвертирует blob в JSON и сервер на той
  // стороне получает мусор. JSON base64 идёт через CapacitorHttp без
  // мангления.
  // Body: { filename: string; mimeType: string; base64: string }
  // Лимит — 12 MB JSON (~9 MB бинарный после base64).
  api.post(
    '/messages/upload-media-base64',
    requireAuth,
    writeRateLimit,
    express.json({ limit: '12mb' }),
    async (req, res) => {
      const body = req.body as { filename?: string; mimeType?: string; base64?: string } | undefined;
      if (!body || typeof body.base64 !== 'string' || typeof body.mimeType !== 'string') {
        res.status(400).json({ error: 'invalid_body' });
        return;
      }
      // Декодируем base64 → bytes. Защита от мусора: max 9 MB бинарных.
      let bytes: Buffer;
      try {
        bytes = Buffer.from(body.base64, 'base64');
      } catch {
        res.status(400).json({ error: 'invalid_base64' });
        return;
      }
      if (bytes.length === 0 || bytes.length > 9 * 1024 * 1024) {
        res.status(400).json({ error: 'size_out_of_range' });
        return;
      }
      // Пишем во временный файл, прогоняем через тот же detectMediaType
      // (magic-bytes + mime-whitelist) что и multipart-вариант.
      const tmpName = crypto.randomUUID();
      const tmpPath = path.join(uploadDir, tmpName);
      try { fs.writeFileSync(tmpPath, bytes); }
      catch (err) {
        log.error('uploads', 'b64 tmp write failed', { err: String(err) });
        res.status(500).json({ error: 'persist_failed' });
        return;
      }
      const detected = detectMediaType(tmpPath, body.mimeType);
      if (!detected) {
        try { fs.unlinkSync(tmpPath); } catch { /* noop */ }
        res.status(400).json({ error: 'invalid_media', detail: 'magic_bytes_mismatch_or_unsupported' });
        return;
      }
      const finalName = `${tmpName}.${detected.ext}`;
      const finalPath = path.join(dmDir, finalName);
      try { fs.renameSync(tmpPath, finalPath); }
      catch (err) {
        log.error('uploads', 'b64 dm rename failed', { err: String(err) });
        try { fs.unlinkSync(tmpPath); } catch { /* noop */ }
        res.status(500).json({ error: 'persist_failed' });
        return;
      }
      res.json({ url: signMediaUrl(`/uploads/dm/${finalName}`), type: detected.type });
    },
  );

  // GET /users/list?q=... — public list of attendees (auth-only).
  // IMPORTANT: must be declared BEFORE /users/:id to avoid Express matching "list" as :id.
  api.get('/users/list', requireAuth, async (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const me = getSessionUserId(req)!;
    let rows = await db.select().from(users);
    rows = rows.filter((u) => u.id !== me && !u.isPrivate);
    if (q) {
      rows = rows.filter((u) =>
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company ?? '').toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    res.json(rows.slice(0, 200).map((u) => toPublicUser(u)));
  });

  // GET /users/:id — публичный профиль участника. Возвращает поля, которые
  // другой юзер видит при тапе на иконку в чате: имя, роль, аватар, био.
  // Email/phone скрыты (audit #9 fix). Заблокированные private-юзеры
  // тоже отдаются (имя/аватар безопасно), но без bio (приватность).
  api.get('/users/:id', requireAuth, async (req, res) => {
    const targetId = String(req.params.id || '');
    if (!targetId || targetId.length < 8) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const rows = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      role: users.role,
      bio: users.bio,
      isPrivate: users.isPrivate,
    }).from(users).where(eq(users.id, targetId)).limit(1);
    const u = rows[0];
    if (!u) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    res.json({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      bio: u.isPrivate ? null : u.bio,
    });
  });

  // DELETE /messages/:id — удаление СВОЕГО сообщения (отправитель = me).
  // Если есть mediaUrl и он наш (/uploads/dm/...), удаляем файл с диска.
  // Получатель/админ-редактирование — отдельный flow, не реализован.
  api.delete('/messages/:id', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id || '');
    if (!id || id.length < 8) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const rows = await db.select().from(directMessages).where(eq(directMessages.id, id)).limit(1);
    const dm = rows[0];
    if (!dm) {
      res.status(404).json({ error: 'message_not_found' });
      return;
    }
    if (dm.fromUserId !== me) {
      res.status(403).json({ error: 'not_sender' });
      return;
    }
    // Удаляем медиа-файл, если был.
    if (dm.mediaUrl && typeof dm.mediaUrl === 'string' && dm.mediaUrl.startsWith('/uploads/dm/')) {
      const fname = dm.mediaUrl.replace(/^\/uploads\/dm\//, '').split('?')[0];
      if (fname && !fname.includes('/') && !fname.includes('..')) {
        try { fs.unlinkSync(path.join(dmDir, fname)); } catch { /* noop */ }
      }
    }
    await db.delete(directMessages).where(eq(directMessages.id, id));
    dmBroadcast({ type: 'dm:delete', from: dm.fromUserId, to: dm.toUserId, messageId: id });
    res.json({ ok: true });
  });

  // PATCH /messages/:id — редактирование своего сообщения (только text).
  // Media не трогаем (если был — оставляем как есть). 24h soft-limit чтобы
  // не редактировать древние сообщения.
  api.patch('/messages/:id', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id || '');
    if (!id || id.length < 8) {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const newText = String((req.body as { text?: string })?.text || '');
    if (newText.length > 4000) {
      res.status(400).json({ error: 'text_too_long' });
      return;
    }
    const rows = await db.select().from(directMessages).where(eq(directMessages.id, id)).limit(1);
    const dm = rows[0];
    if (!dm) {
      res.status(404).json({ error: 'message_not_found' });
      return;
    }
    if (dm.fromUserId !== me) {
      res.status(403).json({ error: 'not_sender' });
      return;
    }
    const ageMs = Date.now() - new Date(dm.createdAt).getTime();
    if (ageMs > 24 * 60 * 60 * 1000) {
      res.status(403).json({ error: 'too_old_to_edit' });
      return;
    }
    await db.update(directMessages).set({ text: newText }).where(eq(directMessages.id, id));
    dmBroadcast({ type: 'dm:edit', from: dm.fromUserId, to: dm.toUserId, messageId: id, text: newText });
    res.json({ ok: true, text: newText });
  });

  // GET /messages/with/:userId — последние 100 сообщений диалога с :userId.
  // Также помечает входящие как прочитанные (UPDATE read_at = now()).
  api.get('/messages/with/:userId', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const otherId = String(req.params.userId);

    const rows = await db.select().from(directMessages)
      .where(or(
        and(eq(directMessages.fromUserId, me), eq(directMessages.toUserId, otherId)),
        and(eq(directMessages.fromUserId, otherId), eq(directMessages.toUserId, me)),
      ))
      .orderBy(desc(directMessages.createdAt))
      .limit(100);

    // Помечаем прочитанным всё что пришло мне от otherId и ещё не read.
    await db.update(directMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(directMessages.fromUserId, otherId),
        eq(directMessages.toUserId, me),
        sql`${directMessages.readAt} IS NULL`,
      ));

    // Возвращаем в хроно-порядке (старые → новые) — UI рисует сверху вниз.
    res.json(rows.reverse().map((m) => ({
      id: m.id,
      fromUserId: m.fromUserId,
      toUserId: m.toUserId,
      text: m.text,
      mediaUrl: m.mediaUrl ? signMediaUrl(m.mediaUrl) : null,
      mediaType: m.mediaType,
      replyToId: m.replyToId,
      forwardedFromUserId: m.forwardedFromUserId,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })));
  });

  // ========================================================================
  // DM PINS — закреплённые сообщения (per-user, per-dialog)
  // ========================================================================
  // GET /messages/pins/:partnerUserId — id закреплённого, или null
  // PUT /messages/pins/:partnerUserId { messageId } — закрепить
  // DELETE /messages/pins/:partnerUserId — открепить
  api.get('/messages/pins/:partnerUserId', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const partnerUserId = String(req.params.partnerUserId);
    const row = (await db.select().from(dmPins)
      .where(and(eq(dmPins.userId, me), eq(dmPins.partnerUserId, partnerUserId)))
      .limit(1))[0];
    res.json({ messageId: row?.messageId ?? null });
  });

  api.put('/messages/pins/:partnerUserId', requireAuth, writeRateLimit, async (req, res) => {
    const me = getSessionUserId(req)!;
    const partnerUserId = String(req.params.partnerUserId);
    const messageId = String((req.body as { messageId?: unknown })?.messageId ?? '').trim();
    if (!messageId) {
      res.status(400).json({ error: 'messageId_required' });
      return;
    }
    // Проверяем что сообщение существует и относится к этому диалогу.
    const msg = (await db.select().from(directMessages)
      .where(eq(directMessages.id, messageId)).limit(1))[0];
    if (!msg) {
      res.status(404).json({ error: 'message_not_found' });
      return;
    }
    const inDialog =
      (msg.fromUserId === me && msg.toUserId === partnerUserId) ||
      (msg.fromUserId === partnerUserId && msg.toUserId === me);
    if (!inDialog) {
      res.status(403).json({ error: 'message_other_dialog' });
      return;
    }
    // upsert по PK (userId, partnerUserId).
    await db.insert(dmPins)
      .values({ userId: me, partnerUserId, messageId })
      .onConflictDoUpdate({
        target: [dmPins.userId, dmPins.partnerUserId],
        set: { messageId, pinnedAt: new Date() },
      });
    // Sync pin между устройствами одного юзера (web-tab + APK).
    dmBroadcast({ type: 'dm:pin', from: me, to: null, partnerUserId, messageId });
    res.json({ messageId });
  });

  api.delete('/messages/pins/:partnerUserId', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const partnerUserId = String(req.params.partnerUserId);
    await db.delete(dmPins)
      .where(and(eq(dmPins.userId, me), eq(dmPins.partnerUserId, partnerUserId)));
    dmBroadcast({ type: 'dm:pin', from: me, to: null, partnerUserId, messageId: null });
    res.json({ ok: true });
  });

  // ========================================================================
  // NOTES — личные заметки в MyRecords (3-я вкладка)
  // ========================================================================
  // GET /notes — все мои заметки, отсортированные по updatedAt desc
  // POST /notes { body } — создать новую
  // PATCH /notes/:id { body } — обновить (только свою; пустой body = no-op)
  // DELETE /notes/:id — удалить (только свою)
  api.get('/notes', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const rows = await db.select().from(notes)
      .where(eq(notes.userId, me))
      .orderBy(desc(notes.updatedAt))
      .limit(500);
    res.json(rows.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })));
  });

  api.post('/notes', requireAuth, writeRateLimit, validateBody(noteUpsertSchema), async (req, res) => {
    const me = getSessionUserId(req)!;
    const { body } = req.body as import('./src/lib/validation.js').NoteUpsertBody;
    const trimmed = body.replace(/\s+$/g, '');
    if (!trimmed.trim()) {
      res.status(400).json({ error: 'empty_body' });
      return;
    }
    // Cap на количество заметок per-user — защита от спама.
    const count = (await db.select({ id: notes.id }).from(notes).where(eq(notes.userId, me))).length;
    if (count >= 500) {
      res.status(429).json({ error: 'too_many_notes' });
      return;
    }
    const id = crypto.randomUUID();
    await db.insert(notes).values({ id, userId: me, body: trimmed });
    const inserted = (await db.select().from(notes).where(eq(notes.id, id)).limit(1))[0];
    res.json({
      id: inserted.id,
      body: inserted.body,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  });

  api.patch('/notes/:id', requireAuth, writeRateLimit, validateBody(noteUpsertSchema), async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id);
    const { body } = req.body as import('./src/lib/validation.js').NoteUpsertBody;
    const trimmed = body.replace(/\s+$/g, '');
    const row = (await db.select().from(notes).where(eq(notes.id, id)).limit(1))[0];
    if (!row) {
      res.status(404).json({ error: 'note_not_found' });
      return;
    }
    if (row.userId !== me) {
      res.status(403).json({ error: 'not_your_note' });
      return;
    }
    if (!trimmed.trim()) {
      res.status(400).json({ error: 'empty_body' });
      return;
    }
    await db.update(notes).set({ body: trimmed, updatedAt: new Date() }).where(eq(notes.id, id));
    const updated = (await db.select().from(notes).where(eq(notes.id, id)).limit(1))[0];
    res.json({
      id: updated.id,
      body: updated.body,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  });

  api.delete('/notes/:id', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id);
    const row = (await db.select().from(notes).where(eq(notes.id, id)).limit(1))[0];
    if (!row) {
      res.status(404).json({ error: 'note_not_found' });
      return;
    }
    if (row.userId !== me) {
      res.status(403).json({ error: 'not_your_note' });
      return;
    }
    await db.delete(notes).where(eq(notes.id, id));
    res.json({ ok: true });
  });

  // GET /messages/contacts — список собеседников с last-message + unread.
  // Используется для левого списка в "Личные".
  api.get('/messages/contacts', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;

    // Тянем все мои DM (отправленные и полученные) — для малых объёмов OK.
    // Для масштаба нужен materialized view.
    const all = await db.select().from(directMessages)
      .where(or(eq(directMessages.fromUserId, me), eq(directMessages.toUserId, me)))
      .orderBy(desc(directMessages.createdAt));

    type ContactSummary = {
      userId: string;
      lastText: string;
      lastAt: Date;
      unread: number;
    };
    const map = new Map<string, ContactSummary>();
    for (const m of all) {
      const other = m.fromUserId === me ? m.toUserId : m.fromUserId;
      const existing = map.get(other);
      if (!existing) {
        map.set(other, {
          userId: other,
          lastText: m.text,
          lastAt: m.createdAt,
          unread: m.toUserId === me && m.readAt === null ? 1 : 0,
        });
      } else if (m.toUserId === me && m.readAt === null) {
        existing.unread += 1;
      }
    }

    const contactIds = Array.from(map.keys());
    const userRows = contactIds.length
      ? await db.select().from(users).where(inArray(users.id, contactIds))
      : [];
    const userById = new Map(userRows.map((u) => [u.id, toPublicUser(u)]));

    const list = Array.from(map.values())
      .map((c) => ({ ...c, user: userById.get(c.userId) ?? null }))
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    res.json(list);
  });

  // ========================================================================
  // STATUSES (24h-stories)
  // ========================================================================

  api.post('/statuses', requireAuth, writeRateLimit, validateBody(statusCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const id = crypto.randomUUID();
    const { type, url, text } = req.body as import('./src/lib/validation.js').StatusCreateBody;

    await db.insert(statuses).values({ id, userId, type, url, text });
    const inserted = (await db.select().from(statuses).where(eq(statuses.id, id)).limit(1))[0];
    if (!inserted) {
      res.status(500).json({ error: 'status_create_failed' });
      return;
    }
    res.json(inserted);
  });

  api.get('/statuses', async (_req, res) => {
    const all = await db.select().from(statuses).orderBy(desc(statuses.createdAt));
    const userIds = Array.from(new Set(all.map((s) => s.userId)));
    const userRows = userIds.length
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userById = new Map(userRows.map((u) => [u.id, toPublicUser(u)]));
    const list = all.map((s) => ({ ...s, user: userById.get(s.userId) ?? null }));
    res.json(list);
  });

  // ========================================================================
  // INTERESTS (Onboarding + Recommended ранжирование Schedule)
  // ========================================================================

  // BUG_FIX_CONTEXT: справочник 22 интересов — читаем напрямую из data.ts
  // INTERESTS, чтобы избежать лишнего SELECT (данные статичны и одинаковы
  // в БД и в data.ts). Public — нужен на onboarding-экране ДО auth (на
  // случай если решим показывать его сразу после регистрации без редиректа).
  api.get('/interests', (_req, res) => {
    res.json(INTERESTS);
  });

  // ========================================================================
  // PROGRAM CONTENT (Round 3 — раньше src/data.ts шипился внутри APK,
  // теперь читается из БД → можно править без релиза приложения).
  // Public endpoints (без auth), кэш через HTTP-headers нет — но содержимое
  // мало (десятки строк), запрос быстрый, prefetch на splash прогревает.
  // ========================================================================
  api.get('/tracks', async (_req, res) => {
    const rows = await db.select().from(tracks);
    res.json(rows);
  });

  api.get('/halls', async (_req, res) => {
    const rows = await db.select().from(halls);
    res.json(rows);
  });

  api.get('/days', async (_req, res) => {
    const rows = await db.select().from(days);
    res.json(rows);
  });

  api.get('/speakers', async (_req, res) => {
    const rows = await db.select().from(speakers);
    res.json(rows.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      company: s.company,
      bio: s.bio,
      avatarLetter: s.avatarLetter,
      topic: s.topic,
      trackId: s.trackId,
      interestIds: s.interestIds,
    })));
  });

  api.get('/sessions', async (_req, res) => {
    // Один большой fetch с computed-полями (location/speakerName/track/day),
    // которые ожидают v1 страницы (Schedule, MyRecords, SpeakerDetail).
    // Раньше эти поля заполнялись в src/data.ts вручную; теперь — при выдаче.
    const [sessRows, linkRows, hallRows, dayRows, trackRows, speakerRows] = await Promise.all([
      db.select().from(sessionsEvent),
      db.select().from(sessionSpeakers).orderBy(sessionSpeakers.sortOrder),
      db.select().from(halls),
      db.select().from(days),
      db.select().from(tracks),
      db.select().from(speakers),
    ]);
    const hallById = new Map(hallRows.map((h) => [h.id, h]));
    const dayById = new Map(dayRows.map((d) => [d.id, d]));
    const trackById = new Map(trackRows.map((t) => [t.id, t]));
    const speakerById = new Map(speakerRows.map((s) => [s.id, s]));
    const speakerIdsByMsg = new Map<string, string[]>();
    for (const l of linkRows) {
      const arr = speakerIdsByMsg.get(l.sessionId) ?? [];
      arr.push(l.speakerId);
      speakerIdsByMsg.set(l.sessionId, arr);
    }
    res.json(sessRows.map((s) => {
      const speakerIds = speakerIdsByMsg.get(s.id) ?? [];
      const firstSpeaker = speakerIds[0] ? speakerById.get(speakerIds[0]) : null;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        startTime: s.startTime,
        endTime: s.endTime,
        format: s.format,
        hallId: s.hallId,
        dayId: s.dayId,
        trackId: s.trackId,
        status: s.status,
        speakerIds,
        // Backwards-compat computed для v1 страниц.
        location: s.hallId ? (hallById.get(s.hallId)?.name ?? '') : 'Главный зал',
        speakerName: firstSpeaker?.name ?? '—',
        track: s.trackId ? (trackById.get(s.trackId)?.name ?? '') : '',
        day: dayById.get(s.dayId)?.label ?? '',
      };
    }));
  });

  api.get('/partners', async (_req, res) => {
    const rows = await db.select().from(partners);
    res.json(rows);
  });

  // ========================================================================
  // PUSH TOKENS — регистрация подписок устройств (Round 5)
  // ========================================================================
  // POST /me/push-token — upsert по token (один token = одно устройство).
  //   Если уже зарегистрирован у этого юзера — обновляем last_seen_at.
  //   Если у ДРУГОГО юзера (передача устройства / shared device) —
  //   переписываем user_id (первый юзер уже не получит push на этот токен).
  // DELETE /me/push-token — удалить конкретный токен (logout).
  // GET /me/push-tokens — список своих регистраций (для UI Settings, опционально).
  api.post(
    '/me/push-token',
    requireAuth,
    writeRateLimit,
    validateBody(pushTokenRegisterSchema),
    async (req, res) => {
      const me = getSessionUserId(req)!;
      const { token, platform, deviceLabel } = req.body as import('./src/lib/validation.js').PushTokenRegisterBody;
      // Upsert по token (UNIQUE). Если token уже есть — обновляем
      // user_id (на случай смены аккаунта на устройстве) + last_seen_at.
      const id = crypto.randomUUID();
      await db.insert(pushTokens).values({
        id, userId: me, platform, token, deviceLabel: deviceLabel ?? null,
      }).onConflictDoUpdate({
        target: pushTokens.token,
        set: {
          userId: me,
          platform,
          deviceLabel: deviceLabel ?? null,
          lastSeenAt: new Date(),
        },
      });
      res.json({ ok: true });
    },
  );

  api.delete('/me/push-token', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const tokenRaw = req.query.token;
    if (typeof tokenRaw !== 'string' || tokenRaw.length < 8) {
      res.status(400).json({ error: 'token_required' });
      return;
    }
    await db.delete(pushTokens).where(and(
      eq(pushTokens.userId, me),
      eq(pushTokens.token, tokenRaw),
    ));
    res.json({ ok: true });
  });

  api.get('/me/push-tokens', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const rows = await db.select().from(pushTokens).where(eq(pushTokens.userId, me));
    res.json(rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      deviceLabel: r.deviceLabel,
      // token НЕ отдаём — это секрет (если попадёт в логи фронта = leak).
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt,
    })));
  });

  // ========================================================================
  // GIVEAWAYS — призы и заявки участников (Round 5)
  // ========================================================================
  // GET /giveaways — активные призы, отсортированные по sort_order.
  // GET /me/giveaways — список ID призов в которых я участвую.
  // POST /giveaways/:id/join — подать заявку.
  // DELETE /giveaways/:id/join — отозвать заявку.
  api.get('/giveaways', async (_req, res) => {
    const rows = await db.select().from(giveaways)
      .where(eq(giveaways.isActive, true))
      .orderBy(giveaways.sortOrder);
    res.json(rows.map((g) => ({
      id: g.id,
      category: g.category,
      item: g.item,
      iconKey: g.iconKey,
      gradient: g.gradient,
      description: g.description,
      condition: g.condition,
      endTime: g.endTime,
      featured: g.featured,
    })));
  });

  api.get('/me/giveaways', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const rows = await db.select().from(giveawayEntries).where(eq(giveawayEntries.userId, me));
    res.json({ giveawayIds: rows.map((r) => r.giveawayId) });
  });

  api.post('/giveaways/:id/join', requireAuth, writeRateLimit, async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id);
    const g = (await db.select().from(giveaways).where(eq(giveaways.id, id)).limit(1))[0];
    if (!g) {
      res.status(404).json({ error: 'giveaway_not_found' });
      return;
    }
    if (!g.isActive) {
      res.status(403).json({ error: 'giveaway_closed' });
      return;
    }
    await db.insert(giveawayEntries)
      .values({ userId: me, giveawayId: id })
      .onConflictDoNothing();
    res.json({ ok: true });
  });

  api.delete('/giveaways/:id/join', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const id = String(req.params.id);
    await db.delete(giveawayEntries).where(and(
      eq(giveawayEntries.userId, me),
      eq(giveawayEntries.giveawayId, id),
    ));
    res.json({ ok: true });
  });

  // Round 4: GET /events — список активных событий, /events/:slug — один.
  // Используется на splash + (будет) для переключателя «Другое событие».
  // Сейчас — один default 'techforum-2026'.
  api.get('/events', async (_req, res) => {
    const rows = await db.select().from(events).where(eq(events.isActive, true));
    res.json(rows.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      location: e.location,
      city: e.city,
      timezone: e.timezone,
      organizer: e.organizer,
      url: e.url,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
    })));
  });

  api.get('/events/:slug', async (req, res) => {
    const slug = String(req.params.slug);
    const row = (await db.select().from(events).where(eq(events.slug, slug)).limit(1))[0];
    if (!row) {
      res.status(404).json({ error: 'event_not_found' });
      return;
    }
    res.json({
      id: row.id,
      slug: row.slug,
      name: row.name,
      location: row.location,
      city: row.city,
      timezone: row.timezone,
      organizer: row.organizer,
      url: row.url,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    });
  });

  api.get('/news', async (_req, res) => {
    const rows = await db.select().from(news).orderBy(news.sortOrder);
    res.json(rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      body: n.body,
      time: n.time,
      isCritical: n.isCritical,
      category: n.category,
      speakerId: n.speakerId,
    })));
  });

  api.get('/me/interests', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const rows = await db.select().from(userInterests).where(eq(userInterests.userId, userId));
    res.json({ interestIds: rows.map((r) => r.interestId) });
  });

  api.put('/me/interests', requireAuth, validateBody(meInterestsPutSchema), async (req, res) => {
    const userId = getSessionUserId(req)!;
    const { interestIds } = req.body as import('./src/lib/validation.js').MeInterestsPutBody;
    const validIds = new Set(INTERESTS.map((i: { id: string }) => i.id));
    const dedup = Array.from(new Set(interestIds));
    const unknown = dedup.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_interest_ids', unknown });
      return;
    }
    // schema уже гарантирует min(3); ещё одна страховка чтобы серверная
    // логика не зависела от порядка middleware.
    if (dedup.length < 3) {
      res.status(400).json({ error: 'need_at_least_3_interests' });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(userInterests).where(eq(userInterests.userId, userId));
      await tx.insert(userInterests).values(dedup.map((interestId) => ({ userId, interestId })));
    });
    res.json({ ok: true, interestIds: dedup, count: dedup.length });
  });

  // ========================================================================
  // SESSION REGISTRATIONS (привязка юзера к сессии расписания)
  // ========================================================================

  api.get('/sessions/registered', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const rows = await db.select().from(registrations).where(eq(registrations.userId, userId));
    res.json({ sessionIds: rows.map((r) => r.sessionId) });
  });

  api.post('/sessions/:id/register', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const sessionId = String(req.params.id);

    const sess = (await db.select().from(sessionsEvent).where(eq(sessionsEvent.id, sessionId)).limit(1))[0];
    if (!sess) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }

    // Capacity check: считаем уже зарегистрированных + сравниваем с capacity зала.
    // hallId в sessions_event опционален (онлайн-формат), capacity тогда не лимитируем.
    if (sess.hallId) {
      const hallMeta = HALLS.find((h: { id: string }) => h.id === sess.hallId);
      if (hallMeta && hallMeta.capacity > 0) {
        const cnt = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(registrations)
          .where(eq(registrations.sessionId, sessionId));
        if ((cnt[0]?.c ?? 0) >= hallMeta.capacity) {
          res.status(409).json({ error: 'hall_full', capacity: hallMeta.capacity });
          return;
        }
      }
    }

    // Conflict-warning: уже зарегистрирован на параллельную сессию?
    // Возвращаем как warning (не блокируем — фронт показывает пользователю
    // и подтверждает override). Это backward-compatible: фронт может игнорить
    // поле conflicts, поведение API в успехе остаётся 200 + ok:true.
    const myRegs = await db.select().from(registrations).where(eq(registrations.userId, userId));
    const conflicts: string[] = [];
    if (myRegs.length > 0) {
      const otherIds = myRegs.map((r) => r.sessionId).filter((id) => id !== sessionId);
      if (otherIds.length > 0) {
        const others = await db.select().from(sessionsEvent).where(inArray(sessionsEvent.id, otherIds));
        for (const o of others) {
          if (o.dayId === sess.dayId && timeRangesOverlap(sess.startTime, sess.endTime, o.startTime, o.endTime)) {
            conflicts.push(o.id);
          }
        }
      }
    }

    await db.insert(registrations)
      .values({ userId, sessionId })
      .onConflictDoNothing();

    res.json({ ok: true, sessionId, conflicts });
  });

  api.delete('/sessions/:id/register', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const sessionId = String(req.params.id);

    await db.delete(registrations)
      .where(and(eq(registrations.userId, userId), eq(registrations.sessionId, sessionId)));

    res.json({ ok: true, sessionId });
  });

  // ========================================================================
  // CALENDAR EXPORT (.ics)
  // ========================================================================

  // BUG_FIX_CONTEXT: ICS для одной сессии — анонимный, не требует auth.
  // Полезно когда юзер делится ссылкой "добавить эту сессию" со знакомым.
  //
  // TECH_DEBT (audit P0.4): этот хендлер и /sessions/calendar читают сессии
  // из data.ts (`SESSIONS.find(...)`), а регистрации — из БД. Если data.ts
  // и БД рассинхронизированы (программу правили без re-seed), юзер увидит
  // старую информацию. Долгосрочный фикс — JOIN из sessionsEvent + speakers
  // + halls + days. НЕ сделано в текущем рефакторинге, чтобы не сломать
  // .ics-формат, который уже работает на проде.
  api.get('/sessions/:id/calendar', (req, res) => {
    const sessionId = String(req.params.id);
    const sess = SESSIONS.find(s => s.id === sessionId);
    if (!sess) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }
    const day = DAYS.find(d => d.id === sess.dayId);
    if (!day) {
      res.status(500).json({ error: 'day_resolution_failed' });
      return;
    }
    const ics = buildIcsCalendar([
      {
        uid: `session-${sess.id}@techforum2026`,
        dtstart: formatIcsDateTime(day.date, sess.startTime),
        dtend: formatIcsDateTime(day.date, sess.endTime),
        summary: `${sess.title} — ${EVENT_META.name}`,
        description: `${sess.description}\n\nСпикеры: ${sess.speakerName}\nТрек: ${sess.track}`,
        location: `${sess.location}, ${EVENT_META.location}, ${EVENT_META.city}`,
        organizer: { name: EVENT_META.organizer, email: EVENT_META.organizerEmail },
        url: EVENT_META.url,
      },
    ], { name: EVENT_META.name, timezone: EVENT_META.timezone });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="techforum2026-${sess.id}.ics"`);
    res.send(ics);
  });

  // ICS со всеми зарегистрированными юзером сессиями.
  api.get('/sessions/calendar', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const regs = await db.select().from(registrations).where(eq(registrations.userId, userId));
    const registeredIds = new Set(regs.map(r => r.sessionId));
    const userSessions = SESSIONS.filter(s => registeredIds.has(s.id));

    if (userSessions.length === 0) {
      res.status(404).json({ error: 'no_registered_sessions' });
      return;
    }

    const events = userSessions.map(s => {
      const day = DAYS.find(d => d.id === s.dayId)!;
      return {
        uid: `session-${s.id}@techforum2026`,
        dtstart: formatIcsDateTime(day.date, s.startTime),
        dtend: formatIcsDateTime(day.date, s.endTime),
        summary: `${s.title} — ${EVENT_META.name}`,
        description: `${s.description}\n\nСпикеры: ${s.speakerName}\nТрек: ${s.track}`,
        location: `${s.location}, ${EVENT_META.location}, ${EVENT_META.city}`,
        organizer: { name: EVENT_META.organizer, email: EVENT_META.organizerEmail },
        url: EVENT_META.url,
      };
    });

    const ics = buildIcsCalendar(events, { name: `Моя программа — ${EVENT_META.name}`, timezone: EVENT_META.timezone });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="techforum2026-my.ics"`);
    res.send(ics);
  });

  // ========================================================================
  // TICKET (для QR на входе)
  // ========================================================================

  // ========================================================================
  // FAQ — «Гид по мероприятию» (Round 6). Public read.
  // ========================================================================
  api.get('/faq', async (_req, res) => {
    const rows = await db.select().from(faq)
      .where(eq(faq.isActive, true))
      .orderBy(faq.sortOrder);
    res.json(rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      category: r.category,
    })));
  });

  // ========================================================================
  // BUSINESS CARD / CONTACT EXCHANGE (Round 6)
  // ========================================================================
  // GET /me/business-card — мой QR payload для нетворкинга (отличается от
  //   /ticket/me: тут card-payload типа 'card|userId|sig', сканер обменивается
  //   контактами вместо пускания на форум). HMAC от (userId|name|role|exp).
  // POST /me/contacts/exchange { qrPayload, note? } — отсканировал QR
  //   другого юзера, серверная сторона валидирует sig, записывает обоим
  //   запись в contact_exchanges (симметрично).
  // GET /me/contacts — мой список «обменялись QR».
  api.get('/me/business-card', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const user = await findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    // exp = +24h чтобы старые QR-снимки не работали бесконечно (фотограф
    // на стенде сделал screenshot, через 2 года кто-то пытается «обменяться»).
    const expSec = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const safeName = user.name.replace(/\|/g, ' ');
    const safeRole = (user.role || '').replace(/\|/g, ' ');
    const payload = `card|${user.id}|${safeName}|${safeRole}|${expSec}`;
    const hmac = crypto.createHmac('sha256', ticketHmacSecret).update(payload).digest('hex').slice(0, 32);
    res.json({
      qrPayload: `${payload}|${hmac}`,
      userId: user.id,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(expSec * 1000).toISOString(),
    });
  });

  api.post('/me/contacts/exchange', requireAuth, writeRateLimit, async (req, res) => {
    const me = getSessionUserId(req)!;
    const body = req.body as { qrPayload?: unknown; note?: unknown } | undefined;
    const qrPayload = String(body?.qrPayload ?? '');
    const note = String(body?.note ?? '').slice(0, 500);
    // payload: 'card|userId|name|role|expSec|hmac'
    const parts = qrPayload.split('|');
    if (parts.length !== 6 || parts[0] !== 'card') {
      res.status(400).json({ error: 'invalid_qr' });
      return;
    }
    const [, otherId, , , expSecStr, sig] = parts;
    const expSec = parseInt(expSecStr ?? '0', 10);
    if (!otherId || !sig || !expSec) {
      res.status(400).json({ error: 'invalid_qr' });
      return;
    }
    if (expSec * 1000 < Date.now()) {
      res.status(400).json({ error: 'qr_expired' });
      return;
    }
    if (otherId === me) {
      res.status(400).json({ error: 'self_exchange' });
      return;
    }
    // Реконструируем подписанную часть и сверяем sig.
    const signedPart = parts.slice(0, 5).join('|');
    const expected = crypto.createHmac('sha256', ticketHmacSecret).update(signedPart).digest('hex').slice(0, 32);
    if (expected !== sig) {
      res.status(400).json({ error: 'invalid_signature' });
      return;
    }
    const otherUser = await findUserById(otherId);
    if (!otherUser) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    // Симметричная запись: я→он + он→я. Note сохраняется только мой
    // (note про знакомство — скан-сторона решает).
    await db.insert(contactExchanges)
      .values({ ownerId: me, contactId: otherId, note })
      .onConflictDoUpdate({
        target: [contactExchanges.ownerId, contactExchanges.contactId],
        set: { note, metAt: new Date() },
      });
    await db.insert(contactExchanges)
      .values({ ownerId: otherId, contactId: me, note: '' })
      .onConflictDoNothing();
    res.json({
      ok: true,
      contact: {
        id: otherUser.id,
        name: otherUser.name,
        role: otherUser.role,
        avatar: otherUser.avatar,
      },
    });
  });

  api.get('/me/contacts', requireAuth, async (req, res) => {
    const me = getSessionUserId(req)!;
    const rows = await db.select().from(contactExchanges)
      .where(eq(contactExchanges.ownerId, me))
      .orderBy(desc(contactExchanges.metAt));
    if (rows.length === 0) { res.json([]); return; }
    const ids = rows.map((r) => r.contactId);
    const userRows = await db.select().from(users).where(inArray(users.id, ids));
    const userById = new Map(userRows.map((u) => [u.id, u]));
    res.json(rows.map((r) => {
      const u = userById.get(r.contactId);
      return {
        contactId: r.contactId,
        note: r.note,
        metAt: r.metAt,
        user: u ? toPublicUser(u) : null,
      };
    }));
  });

  // Возвращает payload-ы для QR-кода билета. Подпись HMAC-SHA256 от
  // (userId|email|name|tier) с использованием SESSION_SECRET. Сканер на входе
  // проверяет подпись и пускает.
  api.get('/ticket/me', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req)!;
    const user = await findUserById(userId);
    if (!user) {
      delete req.session.userId;
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const tier = 'standard';
    const eventId = 'techforum-2026';
    const payload = `${eventId}|${user.id}|${user.email}|${user.name}|${tier}`;
    const hmac = crypto.createHmac('sha256', ticketHmacSecret).update(payload).digest('hex').slice(0, 32);
    const qrPayload = `${payload}|${hmac}`;

    res.json({
      eventId,
      userId: user.id,
      name: user.name,
      email: user.email,
      tier,
      qrPayload,
      issuedAt: new Date().toISOString(),
    });
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'endpoint_not_found' });
  });

  app.use(API_V1_PREFIX, api);
  app.use(
    LEGACY_API_PREFIX,
    (_req, res, next) => {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
      next();
    },
    api,
  );

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith(API_V1_PREFIX) || req.path.startsWith(LEGACY_API_PREFIX)) {
        res.status(404).json({ error: 'endpoint_not_found' });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  async function initDmWs(httpServer: import('node:http').Server): Promise<void> {
    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (req, socket, head) => {
      // Авторизуем только наш WS path. Любой другой upgrade закрываем.
      const url = req.url ?? '';
      if (!url.startsWith(`${API_V1_PREFIX}/ws/dm`)) {
        socket.destroy();
        return;
      }
      // Прогоняем session middleware на фейковом res, чтобы получить
      // req.session с userId из cookie.
      sessionMiddleware(req as any, {} as any, () => {
        const userId = (req as any).session?.userId;
        if (!userId || typeof userId !== 'string') {
          // 401 не отдадим красиво (uprgade hijack), просто закрываем.
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          // Регистрируем сокет в Map.
          let set = userSockets.get(userId);
          if (!set) { set = new Set(); userSockets.set(userId, set); }
          set.add(ws);
          ws.send(JSON.stringify({ type: 'hello', userId }));
          // Heart-beat: пинг каждые 30с, отключаем мёртвых клиентов.
          const heartbeat = setInterval(() => {
            if (ws.readyState !== 1) { clearInterval(heartbeat); return; }
            try { ws.ping(); } catch { /* socket lost */ }
          }, 30_000);
          ws.on('close', () => {
            clearInterval(heartbeat);
            const s = userSockets.get(userId);
            if (s) {
              s.delete(ws);
              if (s.size === 0) userSockets.delete(userId);
            }
          });
          ws.on('error', () => {
            try { ws.close(); } catch { /* noop */ }
          });
          // Клиент-инициированных сообщений у нас нет (пока). Игнорируем.
        });
      });
    });
  }

  // Round 4 (АРХИТЕКТУРА): WebSocket для DM. Поднимаем http.Server вручную,
  // прицепляем ws.Server на upgrade event, broadcast'им dm-events на send/edit/
  // delete/pin. Frontend подключается к /api/v1/ws/dm и получает push'ы.
  // Polling 4с остаётся как fallback (если WS не открылся / упал).
  const httpServer = (await import('node:http')).createServer(app);
  await initDmWs(httpServer);
  // Round 7: FCM init на startup. Lazy: если FCM_SERVICE_ACCOUNT_PATH
  // не задан — disabled, sendPushToUser() становится no-op (но в БД
  // /me/push-token продолжает копить токены, чтобы при включении FCM
  // рассылка пошла на уже зарегистрированных юзеров).
  initFcm();

  // Cron: session reminders за 15 минут до начала. Каждую минуту проверяем
  // регистрации, окно: now + 14..16мин. Атомарный UPDATE ... RETURNING чтобы
  // несколько инстансов не отправили дубликат (на сейчас один инстанс).
  // Для каждого hit'а fire-and-forget push. После — все успешные помечены
  // reminder_sent_at чтобы не отправить повторно.
  try {
    const cron = await import('node-cron');
    cron.default.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const lower = new Date(now.getTime() + 14 * 60_000);
        const upper = new Date(now.getTime() + 16 * 60_000);
        // sessions_event.startTime — это TEXT 'HH:MM' + день из days.date.
        // Простой подход: SELECT с join'ом, фильтр в коде. Объёмы малые.
        const candidates = await db
          .select({
            userId: registrations.userId,
            sessionId: registrations.sessionId,
            startTime: sessionsEvent.startTime,
            title: sessionsEvent.title,
            dayDate: days.date,
            location: sessionsEvent.hallId,
          })
          .from(registrations)
          .innerJoin(sessionsEvent, eq(registrations.sessionId, sessionsEvent.id))
          .innerJoin(days, eq(sessionsEvent.dayId, days.id))
          .where(sql`${registrations.reminderSentAt} IS NULL`);
        for (const c of candidates) {
          // Парсим день+время в Date.
          const [hh, mm] = String(c.startTime).split(':').map((s) => parseInt(s, 10));
          const sessionStart = new Date(`${c.dayDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
          if (sessionStart >= lower && sessionStart <= upper) {
            // Атомарно ставим флаг (если кто-то уже взял — UPDATE не вернёт row).
            const updated = await db.update(registrations)
              .set({ reminderSentAt: new Date() })
              .where(and(
                eq(registrations.userId, c.userId),
                eq(registrations.sessionId, c.sessionId),
                sql`${registrations.reminderSentAt} IS NULL`,
              ))
              .returning();
            if (updated.length === 0) continue;
            void sendPushToUser(c.userId, {
              title: 'Через 15 минут',
              body: c.title,
              data: { type: 'session', sessionId: c.sessionId },
              priority: 'normal',
            }, db, pushTokens);
          }
        }
      } catch (err) {
        log.error('cron', `reminder tick failed: ${(err as Error).message}`);
      }
    });
    log.info('cron', 'session reminder cron scheduled (every minute)');
  } catch (err) {
    log.warn('cron', `node-cron not available: ${(err as Error).message}`);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const fcm = fcmStatus();
    console.log(`Hybrid Architecture Server running on http://0.0.0.0:${PORT}`);
    console.log(`API health: http://localhost:${PORT}${API_V1_PREFIX}/health`);
    console.log(`WebSocket: ws://0.0.0.0:${PORT}${API_V1_PREFIX}/ws/dm`);
    console.log(`FCM: ${fcm.disabled ? 'disabled (set FCM_SERVICE_ACCOUNT_PATH)' : 'live'}`);
  });

  // BUG_FIX_CONTEXT: graceful shutdown — Postgres pool должен закрыться явно,
  // иначе остаются "висячие" idle connections, и при рестарте сервер не может
  // взять lock на migration (drizzle-kit migrate ругается).
  process.on('SIGINT', async () => {
    console.log('[server] SIGINT received, closing pool…');
    await pool.end();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    console.log('[server] SIGTERM received, closing pool…');
    await pool.end();
    process.exit(0);
  });
}

startServer().catch((error) => {
  console.error('Fatal server startup error:', error);
  process.exit(1);
});
