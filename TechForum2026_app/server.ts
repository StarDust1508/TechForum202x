import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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

interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatar: string;
  bio: string;
  phone?: string;
  role?: string;
  isPrivate?: boolean;
}

interface CommentRecord {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
}

interface PostRecord {
  id: string;
  userId: string;
  type: string;
  url: string;
  text: string;
  likes: number;
  likedBy: string[];
  comments: CommentRecord[];
  createdAt: Date;
}

interface StatusRecord {
  id: string;
  userId: string;
  type: string;
  url: string;
  text: string;
  createdAt: Date;
}

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

function toPublicUser(user: UserRecord): Omit<UserRecord, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function getSessionUserId(req: Request): string | null {
  const userId = (req.session as { userId?: unknown } | undefined)?.userId;
  return typeof userId === 'string' ? userId : null;
}

function getPublicUserById(
  users: UserRecord[],
  userId: string,
): Omit<UserRecord, 'passwordHash'> | null {
  const user = users.find((entry) => entry.id === userId);
  return user ? toPublicUser(user) : null;
}

function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  next();
}

function createRateLimiter(limit: number, windowMs: number) {
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
    console.warn('SESSION_SECRET is not set. Using ephemeral dev secret.');
  }

  if (isProduction) {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
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

    if (!allowedOrigins.includes(origin)) {
      res.status(403).json({
        error: 'origin_not_allowed',
        message: `Origin ${origin} is not allowed`,
      });
      return;
    }

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

  const users: UserRecord[] = [];
  const posts: PostRecord[] = [];
  const statuses: StatusRecord[] = [];
  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const geminiModel = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
  const authRateLimit = createRateLimiter(30, 60_000);
  const aiRateLimit = createRateLimiter(20, 60_000);

  users.push({
    id: '1',
    name: 'Дмитрий Волков',
    email: 'v@tech.com',
    passwordHash: hashPassword('123'),
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry',
    bio: 'Tech Lead',
    isPrivate: false,
    role: 'Участник',
  });

  posts.push({
    id: 'r1',
    userId: '1',
    type: 'video',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screens-1151-large.mp4',
    text: 'Кодим будущее #tech #future',
    likes: 120,
    likedBy: [],
    comments: [{ id: 'c1', userId: '1', text: 'Круто!', createdAt: new Date() }],
    createdAt: new Date(),
  });

  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'backend-api', architecture: 'Hybrid: Messenger + Social Network' });
  });

  api.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  api.post('/ai/chat', aiRateLimit, requireAuth, async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const context = typeof req.body?.context === 'string' ? req.body.context.slice(0, 20000) : '';

    if (!message) {
      res.status(400).json({ error: 'message_required' });
      return;
    }

    if (!gemini) {
      res.status(503).json({ error: 'ai_not_configured' });
      return;
    }

    const prompt = context ? `${context}\n\nUser: ${message}` : message;
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
      console.error('AI chat error:', error);
      res.status(502).json({ error: 'ai_unavailable' });
    }
  });

  api.post('/auth/register', authRateLimit, (req, res) => {
    const email = normalizeEmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Заполните обязательные поля: email, password, name' });
      return;
    }

    const existingUser = users.find((entry) => normalizeEmail(entry.email) === email);
    if (existingUser) {
      res.status(400).json({ error: 'Пользователь уже существует' });
      return;
    }

    const user: UserRecord = {
      id: Date.now().toString(),
      email,
      passwordHash: hashPassword(password),
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      bio: '',
      isPrivate: false,
      role: 'Участник',
    };

    users.push(user);
    (req.session as { userId?: string }).userId = user.id;

    res.json(toPublicUser(user));
  });

  api.post('/auth/login', authRateLimit, (req, res) => {
    const email = normalizeEmail(String(req.body?.email || ''));
    const password = String(req.body?.password || '');
    const user = users.find((entry) => normalizeEmail(entry.email) === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Неверные данные' });
      return;
    }

    (req.session as { userId?: string }).userId = user.id;
    res.json(toPublicUser(user));
  });

  api.post('/auth/logout', authRateLimit, (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });

  api.get('/auth/me', (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const user = users.find((entry) => entry.id === userId);
    if (!user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    res.json(toPublicUser(user));
  });

  api.patch('/auth/me', requireAuth, (req, res) => {
    const userId = getSessionUserId(req);
    const user = users.find((entry) => entry.id === userId);

    if (!user) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const bio = typeof req.body?.bio === 'string' ? req.body.bio : undefined;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : undefined;

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (phone !== undefined) user.phone = phone;

    if (email && email !== user.email) {
      const duplicateEmail = users.some((entry) => entry.id !== user.id && normalizeEmail(entry.email) === email);
      if (duplicateEmail) {
        res.status(400).json({ error: 'Email уже используется' });
        return;
      }
      user.email = email;
    }

    res.json(toPublicUser(user));
  });

  api.post('/posts', requireAuth, (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const type = String(req.body?.type || 'text');
    const url = String(req.body?.url || '');
    const text = String(req.body?.text || '');

    const newPost: PostRecord = {
      id: Date.now().toString(),
      userId,
      type,
      url,
      text,
      likes: 0,
      likedBy: [],
      comments: [],
      createdAt: new Date(),
    };

    posts.unshift(newPost);
    res.json(newPost);
  });

  api.get('/posts', (req, res) => {
    const query = String(req.query?.q || '').trim().toLowerCase();
    const filteredPosts = query
      ? posts.filter((entry) => {
          const author = users.find((user) => user.id === entry.userId);
          return entry.text.toLowerCase().includes(query)
            || author?.name.toLowerCase().includes(query);
        })
      : posts;

    const feed = filteredPosts.map((entry) => ({
      ...entry,
      user: getPublicUserById(users, entry.userId),
    }));

    res.json(feed);
  });

  api.post('/posts/:id/like', requireAuth, (req, res) => {
    const userId = getSessionUserId(req);
    const post = posts.find((entry) => entry.id === req.params.id);

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!post) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }

    const index = post.likedBy.indexOf(userId);
    if (index === -1) {
      post.likedBy.push(userId);
      post.likes += 1;
    } else {
      post.likedBy.splice(index, 1);
      post.likes -= 1;
    }

    res.json({ likes: post.likes, liked: index === -1 });
  });

  api.post('/posts/:id/comment', requireAuth, (req, res) => {
    const userId = getSessionUserId(req);
    const post = posts.find((entry) => entry.id === req.params.id);
    const text = String(req.body?.text || '').trim();

    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    if (!post) {
      res.status(404).json({ error: 'Пост не найден' });
      return;
    }

    if (!text) {
      res.status(400).json({ error: 'Комментарий пустой' });
      return;
    }

    const comment: CommentRecord = {
      id: Date.now().toString(),
      userId,
      text,
      createdAt: new Date(),
    };

    post.comments.push(comment);
    res.json(comment);
  });

  api.post('/statuses', requireAuth, (req, res) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Не авторизован' });
      return;
    }

    const type = String(req.body?.type || 'status');
    const url = String(req.body?.url || '');
    const text = String(req.body?.text || '');

    const newStatus: StatusRecord = {
      id: Date.now().toString(),
      userId,
      type,
      url,
      text,
      createdAt: new Date(),
    };

    statuses.unshift(newStatus);
    res.json(newStatus);
  });

  api.get('/statuses', (_req, res) => {
    const list = statuses.map((status) => ({
      ...status,
      user: getPublicUserById(users, status.userId),
    }));
    res.json(list);
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
}

startServer().catch((error) => {
  console.error('Fatal server startup error:', error);
  process.exit(1);
});
