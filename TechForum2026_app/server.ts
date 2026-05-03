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
} from './src/lib/validation.js';
import { log } from './src/lib/log.js';

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
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { eq, desc, and } from 'drizzle-orm';

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
const { users, posts, postLikes, postComments, statuses, registrations, sessionsEvent, userInterests } = schemaModule;

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
  isPrivate: boolean;
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
    isPrivate: row.isPrivate,
  };
}

function getSessionUserId(req: Request): string | null {
  const userId = (req.session as { userId?: unknown } | undefined)?.userId;
  return typeof userId === 'string' ? userId : null;
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
  // BUG_FIX_CONTEXT: in-memory rate-limiter сохраняется между запросами
  // в рамках одного process. На multi-instance проде нужен redis, но в dev
  // и на single-VPS этого достаточно.
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedFirst = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '';
    const ip = forwardedFirst || req.socket.remoteAddress || 'unknown';
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

  // BUG_FIX_CONTEXT: trust proxy=1 включаем ТОЛЬКО когда мы реально за reverse-proxy
  // (nginx/cloudflare). При прямом доступе к http://72.56.9.90:3100 без proxy,
  // express-session с trust proxy и secure=false вёл себя странно (Set-Cookie
  // не отдавался). Включается через TRUST_PROXY=1 в env.
  if (String(process.env.TRUST_PROXY || '').trim() === '1') {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '2mb' }));
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
          "img-src 'self' data: blob: https://api.dicebear.com http://72.56.9.90:3100 https://72.56.9.90:3100",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' http://72.56.9.90:3100 https://72.56.9.90:3100 ws://72.56.9.90:3100 wss://72.56.9.90:3100 capacitor://localhost",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      );
      // BUG_FIX_CONTEXT: HSTS отключён пока backend на cleartext IP.
      // С HSTS WebView-кеш заставляет upgrade http://72.56.9.90:3100 →
      // https://72.56.9.90:3100, которого нет → "ERR_CONNECTION_REFUSED".
      // Юзер видит "нет сети". Включим обратно когда будет domain + cert.
      // res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });
  // BUG_FIX_CONTEXT: Пока у нас нет domain + Let's Encrypt сертификата, APK
  // ходит к backend по cleartext (http://72.56.9.90:3100). Cookie c secure=true
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

  app.use(session({
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
  }));

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

  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const geminiModel = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
  const authRateLimit = createRateLimiter(30, 60_000);
  const aiRateLimit = createRateLimiter(20, 60_000);

  // Sanity-check соединения с БД до старта роутов.
  try {
    await pool.query('SELECT 1');
    log.info('db', 'connection OK');
  } catch (err) {
    log.error('db', 'connection FAILED — aborting server start', { err: String(err) });
    process.exit(1);
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
    limits: { fileSize: 5 * 1024 * 1024 },
  });
  app.use('/uploads', express.static(uploadDir));

  const api = express.Router();

  // ========================================================================
  // HEALTH
  // ========================================================================

  api.get('/health', async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    res.json({
      status: dbOk ? 'ok' : 'degraded',
      service: 'backend-api',
      architecture: 'Express + Postgres (Drizzle)',
      db: dbOk ? 'up' : 'down',
    });
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
  function buildEventContext(): string {
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
    return lines.join('\n');
  }

  const SYSTEM_INSTRUCTION = `Ты — AI-ассистент конференции TechForum 2026. Отвечай по-русски, кратко (2-4 предложения) и по делу. Используй ТОЛЬКО факты из контекста программы ниже, не выдумывай сессий и спикеров. Если вопрос вне программы — говори "не нашёл этого в программе" и предлагай ближайшую релевантную сессию из контекста.`;

  api.post('/ai/chat', aiRateLimit, requireAuth, validateBody(aiChatSchema), async (req, res) => {
    const { message, context: userContext } = req.body as import('./src/lib/validation.js').AiChatBody;

    if (!gemini) {
      res.status(503).json({ error: 'ai_not_configured' });
      return;
    }

    const eventContext = buildEventContext();
    const prompt = [
      SYSTEM_INSTRUCTION,
      '',
      '=== КОНТЕКСТ ПРОГРАММЫ ===',
      eventContext,
      '=== КОНЕЦ КОНТЕКСТА ===',
      userContext ? `\nДополнительный контекст пользователя:\n${userContext}` : '',
      `\nВопрос пользователя: ${message}`,
    ].join('\n');

    try {
      const result = await gemini.models.generateContent({
        model: geminiModel,
        contents: prompt,
      });
      const text = typeof result.text === 'string' ? result.text.trim() : '';
      if (!text) {
        res.status(502).json({ error: 'ai_empty_response' });
        return;
      }
      res.json({ text });
    } catch (error) {
      log.error('ai', 'chat error', { err: String(error) });
      res.status(502).json({ error: 'ai_unavailable' });
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

    (req.session as { userId?: string }).userId = id;

    const created = await findUserById(id);
    if (!created) {
      res.status(500).json({ error: 'user_create_failed' });
      return;
    }
    res.json({ ...toPublicUser(created), interestsCount: 0 });
  });

  api.post('/auth/login', authRateLimit, validateBody(authLoginSchema), async (req, res) => {
    const { email, password } = req.body as import('./src/lib/validation.js').AuthLoginBody;
    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Неверные данные' });
      return;
    }

    (req.session as { userId?: string }).userId = user.id;
    const myInterests = await db.select().from(userInterests).where(eq(userInterests.userId, user.id));
    res.json({ ...toPublicUser(user), interestsCount: myInterests.length });
  });

  api.post('/auth/logout', authRateLimit, (req, res) => {
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
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    // BUG_FIX_CONTEXT: Onboarding-флоу: фронт решает показать onboarding-экран
    // если interestsCount === 0. Считаем числом строк в user_interests.
    const myInterests = await db.select().from(userInterests).where(eq(userInterests.userId, userId));
    res.json({ ...toPublicUser(user), interestsCount: myInterests.length });
  });

  api.patch('/auth/me', requireAuth, validateBody(authMePatchSchema), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const { name, bio, phone, email: emailRaw } = req.body as import('./src/lib/validation.js').AuthMePatchBody;

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
    }).where(eq(users.id, user.id));

    const updated = await findUserById(user.id);
    if (!updated) {
      res.status(500).json({ error: 'user_update_failed' });
      return;
    }
    res.json(toPublicUser(updated));
  });

  // ========================================================================
  // AVATAR UPLOAD
  // ========================================================================

  // BUG_FIX_CONTEXT: Возвращаем относительный URL ('/uploads/<file>'), а не абсолютный.
  // Клиент сам резолвит через resolveAssetUrl() — это позволяет одному и тому же
  // payload работать как через прямой http://72.56.9.90:3100, так и через прокси.
  api.post('/me/avatar', requireAuth, upload.single('file'), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }

    const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMime.has(file.mimetype)) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      res.status(400).json({ error: 'unsupported_mime', mime: file.mimetype });
      return;
    }

    const user = await findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const relativeUrl = `/uploads/${file.filename}`;
    await db.update(users).set({ avatar: relativeUrl }).where(eq(users.id, user.id));

    res.json({ avatar: relativeUrl });
  });

  // ========================================================================
  // POSTS / COMMENTS / LIKES
  // ========================================================================

  api.post('/posts', requireAuth, validateBody(postCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
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

  api.get('/posts', async (req, res) => {
    const query = String(req.query?.q || '').trim().toLowerCase();

    // Простая реализация: тянем все посты в обратном хроно-порядке, потом
    // в JS присоединяем юзера/комменты/лайки. Для ~100-1000 постов хватит.
    // Когда лента вырастет — переделаем на JOIN + pagination.
    const allPosts = await db.select().from(posts).orderBy(desc(posts.createdAt));

    const userIds = Array.from(new Set(allPosts.map(p => p.userId)));
    const userRows = userIds.length
      ? await db.select().from(users).where(/* in */ inListExpr(userIds))
      : [];
    const userById = new Map(userRows.map(u => [u.id, toPublicUser(u)]));

    const allLikes = await db.select().from(postLikes);
    const likesByPost = new Map<string, string[]>();
    for (const l of allLikes) {
      const arr = likesByPost.get(l.postId) ?? [];
      arr.push(l.userId);
      likesByPost.set(l.postId, arr);
    }

    const allComments = await db.select().from(postComments);
    const commentsByPost = new Map<string, typeof allComments>();
    for (const c of allComments) {
      const arr = commentsByPost.get(c.postId) ?? [];
      arr.push(c);
      commentsByPost.set(c.postId, arr);
    }

    const filtered = query
      ? allPosts.filter(p => {
          const author = userById.get(p.userId);
          return p.text.toLowerCase().includes(query)
            || (author?.name.toLowerCase().includes(query) ?? false);
        })
      : allPosts;

    const feed = filtered.map(p => {
      const likedBy = likesByPost.get(p.id) ?? [];
      const comments = (commentsByPost.get(p.id) ?? []).map(c => ({
        id: c.id,
        userId: c.userId,
        text: c.text,
        createdAt: c.createdAt,
      }));
      return {
        id: p.id,
        userId: p.userId,
        type: p.type,
        url: p.url,
        text: p.text,
        likes: likedBy.length,
        likedBy,
        comments,
        createdAt: p.createdAt,
        user: userById.get(p.userId) ?? null,
      };
    });

    res.json(feed);
  });

  api.post('/posts/:id/like', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const postId = String(req.params.id);

    const post = (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0];
    if (!post) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }

    const existing = await db.select().from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
      .limit(1);

    let liked: boolean;
    if (existing.length > 0) {
      await db.delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)));
      liked = false;
    } else {
      await db.insert(postLikes).values({ postId, userId });
      liked = true;
    }

    const totalLikes = (await db.select().from(postLikes).where(eq(postLikes.postId, postId))).length;
    res.json({ likes: totalLikes, liked });
  });

  api.post('/posts/:id/comment', requireAuth, validateBody(commentCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
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
  // STATUSES (24h-stories)
  // ========================================================================

  api.post('/statuses', requireAuth, validateBody(statusCreateSchema), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
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
    const userIds = Array.from(new Set(all.map(s => s.userId)));
    const userRows = userIds.length
      ? await db.select().from(users).where(inListExpr(userIds))
      : [];
    const userById = new Map(userRows.map(u => [u.id, toPublicUser(u)]));
    const list = all.map(s => ({ ...s, user: userById.get(s.userId) ?? null }));
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

  api.get('/me/interests', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const rows = await db.select().from(userInterests).where(eq(userInterests.userId, userId));
    res.json({ interestIds: rows.map(r => r.interestId) });
  });

  api.put('/me/interests', requireAuth, validateBody(meInterestsPutSchema), async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const { interestIds } = req.body as import('./src/lib/validation.js').MeInterestsPutBody;
    const validIds = new Set(INTERESTS.map((i: { id: string }) => i.id));
    const incoming = Array.from(new Set(interestIds)).filter(id => validIds.has(id));
    // Atomic delete + insert. Drizzle pg-pool поддерживает .transaction().
    await db.transaction(async (tx) => {
      await tx.delete(userInterests).where(eq(userInterests.userId, userId));
      if (incoming.length > 0) {
        await tx.insert(userInterests).values(incoming.map(interestId => ({ userId, interestId })));
      }
    });
    res.json({ ok: true, interestIds: incoming, count: incoming.length });
  });

  // ========================================================================
  // SESSION REGISTRATIONS (привязка юзера к сессии расписания)
  // ========================================================================

  api.get('/sessions/registered', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const rows = await db.select().from(registrations).where(eq(registrations.userId, userId));
    res.json({ sessionIds: rows.map(r => r.sessionId) });
  });

  api.post('/sessions/:id/register', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const sessionId = String(req.params.id);

    // Проверяем что сессия вообще существует в БД
    const sess = (await db.select().from(sessionsEvent).where(eq(sessionsEvent.id, sessionId)).limit(1))[0];
    if (!sess) {
      res.status(404).json({ error: 'session_not_found' });
      return;
    }

    await db.insert(registrations)
      .values({ userId, sessionId })
      .onConflictDoNothing();

    res.json({ ok: true, sessionId });
  });

  api.delete('/sessions/:id/register', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
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

  // Возвращает payload-ы для QR-кода билета. Подпись HMAC-SHA256 от
  // (userId|email|name|tier) с использованием SESSION_SECRET. Сканер на входе
  // проверяет подпись и пускает.
  api.get('/ticket/me', requireAuth, async (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }
    const user = await findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const tier = 'standard';
    const eventId = 'techforum-2026';
    const payload = `${eventId}|${user.id}|${user.email}|${user.name}|${tier}`;
    const hmac = crypto.createHmac('sha256', sessionSecret).update(payload).digest('hex').slice(0, 32);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hybrid Architecture Server running on http://0.0.0.0:${PORT}`);
    console.log(`API health: http://localhost:${PORT}${API_V1_PREFIX}/health`);
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

// Helper: безопасный inArray-выражение для drizzle.
// Импорт inArray из drizzle-orm даёт нативный `WHERE id IN (?, ?, ...)`.
import { inArray } from 'drizzle-orm';
function inListExpr(ids: string[]) {
  return inArray(users.id, ids);
}

startServer().catch((error) => {
  console.error('Fatal server startup error:', error);
  process.exit(1);
});
