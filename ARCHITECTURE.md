# TechForum 2026 — техническое описание системы

Документ собран по факту работающего стека на 2026-05-03. Любое расхождение с реальностью — баг документа.

## 1. Архитектура одной картинкой

```
                    ┌──────────────────────────────┐
                    │ Android устройство (S25/9R)  │
                    │  com.psy_lololo.conferenceapp│
                    │  ┌────────────────────────┐  │
                    │  │ Capacitor 8 WebView    │  │
                    │  │  React 19 SPA          │  │
                    │  │  origin = http://      │  │
                    │  │           localhost    │  │
                    │  └────────┬───────────────┘  │
                    └───────────┼──────────────────┘
                                │ http (cleartext)
                                ▼
                    ┌──────────────────────────────┐
                    │ VPS Timeweb 72.56.9.90       │
                    │  Ubuntu 24.04, Node 20       │
                    │ ┌──────────────────────────┐ │
                    │ │ systemd: techforum.service│ │
                    │ │  /opt/techforum          │ │
                    │ │  Express + Drizzle (tsx)  │ │
                    │ │  listen 0.0.0.0:3100     │ │
                    │ └──────┬───────────────────┘ │
                    │        │ pg-pool             │
                    │ ┌──────▼─────────┐           │
                    │ │ Postgres 16    │           │
                    │ │ db: techforum  │           │
                    │ └────────────────┘           │
                    │ /var/data/uploads (avatars)  │
                    │ /var/backups/postgresql      │
                    └──────────────────────────────┘
```

**Соседи на той же VPS** (не наши, не трогать): Hunter888 (port 3000, Docker), lideryprava (port 8000), manyasha (port 8010).

---

## 2. Стек

### Backend (`TechForum2026_app/server.ts`)
- **Runtime:** Node 20 + tsx (TypeScript без сборки в JS)
- **Framework:** Express 4
- **DB:** Postgres 16 + Drizzle ORM
- **Auth:** cookie-session через `express-session` + `connect-pg-simple` (сессии в БД, переживают рестарт)
- **Validation:** zod на input всех мутирующих эндпоинтов
- **Upload:** multer (avatars в `/var/data/uploads`)
- **AI:** `@google/genai` Gemini (через `/ai/chat`)
- **Rate limit:** in-memory bucket, 30/min на auth, 20/min на AI

### Frontend (`TechForum2026_app/src/`)
- **Framework:** React 19 + Vite 6
- **Routing:** React Router 7
- **Styling:** Tailwind 4 + кастомный шрифт GOST Type A (blueprint-эстетика)
- **Animation:** motion (бывшая framer-motion)
- **Mobile wrapper:** Capacitor 8 (Android only)
- **Native plugins:** `@capacitor/app`, `@capacitor/status-bar`

### CI/CD
- GitHub Actions → собирает APK на каждый push в `main`
- Артефакт + drop в `apk/TechForum2026-v1.0.0-<short>-debug.apk`
- Сервер обновляется отдельно через `rsync + ssh + systemctl restart` (не через CI)

---

## 3. Где что лежит

### Локально на маке (`/Users/bubble3/Desktop/TechForum202x/`)
```
TechForum202x/
├── apk/                                    # Готовые APK (последний всегда актуальный)
├── TechForum2026_app/                      # Основной проект (Capacitor wrapper)
│   ├── server.ts                           # Backend Express server
│   ├── package.json
│   ├── capacitor.config.ts                 # androidScheme: 'http' (важно)
│   ├── vite.config.ts                      # manualChunks для code-splitting
│   ├── drizzle.config.ts
│   ├── drizzle/                            # Сгенерированные миграции
│   │   ├── 0000_init.sql
│   │   └── 0001_add_interests.sql
│   ├── android/                            # Capacitor Android wrapper
│   │   └── app/src/main/
│   │       ├── AndroidManifest.xml         # cleartext + NSC + permissions
│   │       └── res/xml/network_security_config.xml
│   ├── public/
│   │   ├── conference-bg.jpg               # Brand blueprint background
│   │   └── fonts/                          # GOST Type A woff2
│   └── src/
│       ├── App.tsx                         # Routing + ToastProvider + useHardwareBack
│       ├── main.tsx
│       ├── index.css                       # Tailwind theme + GOST font-face
│       ├── data.ts                         # SPEAKERS, SESSIONS, INTERESTS, NEWS
│       ├── lib/
│       │   ├── runtimeEndpoint.ts          # resolveApiUrl, resolveAssetUrl
│       │   ├── ics.ts                      # iCalendar generator
│       │   ├── biometric.ts                # Auto-login через Capacitor BiometricAuth
│       │   ├── prefetch.ts                 # Прогрев публичных endpoints
│       │   └── localAuth.ts                # PBKDF2 fallback для офлайна
│       ├── components/
│       │   ├── AppBackground.tsx           # Единый brand-фон
│       │   ├── BackButton.tsx              # Floating top-left
│       │   ├── Toast.tsx                   # ToastProvider + useToast()
│       │   └── OfflineBanner.tsx
│       ├── db/
│       │   ├── schema.ts                   # Drizzle pgTables
│       │   ├── index.ts                    # Pool + db client
│       │   └── seed.ts                     # Заполняет справочники + dev-юзер
│       └── pages/
│           ├── Home.tsx, Auth.tsx, Onboarding.tsx
│           ├── Schedule.tsx, Speakers.tsx, Map.tsx
│           ├── Chat.tsx, Profile.tsx, Ticket.tsx
│           ├── Feed.tsx, NewsDetail.tsx
│           ├── Giveaways.tsx, Partners.tsx
│           ├── Diagnostics.tsx, About.tsx, MyRecords.tsx
├── .github/workflows/build-apk.yml         # CI — JDK 21 + Android SDK + gradle
├── ARCHITECTURE.md                         # этот файл
├── .gitignore
└── README_INSTALL.txt
```

### На сервере (`72.56.9.90`)
```
/opt/techforum/                  # копия TechForum2026_app/ (rsync)
├── server.ts
├── node_modules/
├── .env.production              # chmod 600, root-only — секреты
├── drizzle/                     # SQL миграции
├── src/
└── public/                      # фронт после vite build (если build здесь делается)

/var/data/uploads/               # Аватарки (multer destination)
/var/backups/postgresql/         # pg_dump артефакты, retention 14 дней
/etc/systemd/system/techforum.service
/etc/cron.daily/techforum-pgdump
```

Postgres БД на сервере: `techforum` (user: `techforum`, пароль в `.env.production` `DATABASE_URL`).

---

## 4. Учётные данные

| Что | Где | Как получить |
|---|---|---|
| SSH на сервер | `ssh root@72.56.9.90` | публичный ключ владельца репо уже скопирован |
| Postgres prod | `postgres://techforum:***@127.0.0.1:5432/techforum` | пароль в `/opt/techforum/.env.production` (chmod 600) |
| Postgres dev | `postgres://bubble3@127.0.0.1:5432/techforum_dev` | peer auth (homebrew Postgres 16) |
| Demo dev-юзер | `v@tech.com / demo1234` | seed.ts создаёт автоматически |
| GitHub repo | `https://github.com/StarDust1508/TechForum202x` | публичный (или с твоим PAT) |
| Backend prod URL | `http://72.56.9.90:3100/api/v1` | cleartext, нет домена пока |

---

## 5. Команды разработчика

### Локально (cwd: `TechForum2026_app/`)

```bash
# Установка
npm install

# Создать .env.development (peer-auth Postgres):
cat > .env.development <<EOF
PORT=3000
NODE_ENV=development
SESSION_SECRET=dev-only-secret-replace-on-prod
DATABASE_URL=postgres://bubble3@127.0.0.1:5432/techforum_dev
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,capacitor://localhost
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1
VITE_WS_BASE_URL=ws://127.0.0.1:3000
VITE_ENABLE_LOCAL_FALLBACK=true
EOF

# Создать локальную БД (один раз)
createdb techforum_dev

# Применить миграции к локальной БД
env $(grep -v '^#' .env.development | xargs) npx drizzle-kit migrate

# Залить справочники (треки/залы/спикеры/сессии/22 интереса/dev-юзер)
env $(grep -v '^#' .env.development | xargs) npm run db:seed

# Поднять dev-сервер (Express + Vite middleware на одном порту 3000)
npm run dev
# Открыть http://localhost:3000

# Прочее
npm run lint              # tsc --noEmit (типы)
npm run build             # vite build → dist/
npm run preview           # serve dist/
npm run db:generate       # сгенерировать новую миграцию из schema.ts
npm run db:migrate        # применить миграции к DATABASE_URL
npm run db:push           # push schema БЕЗ миграции (для прототипирования)
npm run db:seed           # перезалить справочники
npm run db:studio         # GUI для просмотра БД (drizzle-kit studio)
```

### На сервере

```bash
# Зайти
ssh -o ServerAliveInterval=60 root@72.56.9.90

# Статус backend
systemctl status techforum
systemctl restart techforum
journalctl -u techforum -n 100 --no-pager

# Применить новую миграцию (из локальной — после rsync)
cd /opt/techforum
PGPASSWORD=$(grep "^DATABASE_URL=" .env.production | sed "s|.*techforum:\([^@]*\)@.*|\1|") \
  psql -h 127.0.0.1 -U techforum -d techforum -f drizzle/000N_xxx.sql

# Перезалить справочники (после правки src/data.ts → rsync)
cd /opt/techforum
env $(grep -v '^#' .env.production | xargs) npm run db:seed

# Сделать ручной backup сейчас
/etc/cron.daily/techforum-pgdump
ls -la /var/backups/postgresql/

# Восстановить из backup
PGPASSWORD=... pg_restore -h 127.0.0.1 -U techforum -d techforum --clean /var/backups/postgresql/techforum-2026-MM-DD.dump

# Посмотреть env переменные процесса (без секретов наружу)
PID=$(systemctl show -p MainPID --value techforum)
tr '\0' '\n' < /proc/$PID/environ | grep -E "PORT|NODE_ENV|COOKIE_SECURE"
```

### Деплой кода с мака на сервер

```bash
# С мака:
rsync -avz \
  --exclude=node_modules --exclude=.git --exclude='.env*' \
  --exclude=dist --exclude=android --exclude=.DS_Store --exclude=.claude \
  /Users/bubble3/Desktop/TechForum202x/TechForum2026_app/ \
  root@72.56.9.90:/opt/techforum/

# Если меняли deps:
ssh root@72.56.9.90 'cd /opt/techforum && npm install --no-audit --no-fund'

# Если меняли schema.ts → миграция:
ssh root@72.56.9.90 'cd /opt/techforum && PGPASSWORD=$(...) psql -f drizzle/00NN_*.sql'

# Рестарт backend
ssh root@72.56.9.90 'systemctl restart techforum && sleep 3 && systemctl is-active techforum && curl -sS http://127.0.0.1:3100/api/v1/health'
```

### CI / APK билд

- Любой `git push origin main` → GitHub Actions запускает [build-apk.yml](.github/workflows/build-apk.yml).
- Сборка ~1.5 мин: JDK 21 + Android SDK + Gradle assembleDebug.
- Артефакт = `TechForum2026-v1.0.0-<short>-debug.apk` (~6–11 MB).
- Скачать вручную:
  ```bash
  cd apk/
  rm -f *.apk
  gh run download <RUN_ID> --repo StarDust1508/TechForum202x --name TechForum2026-v1.0.0-<short>-debug.apk
  git add apk/ && git commit -m "chore(apk): drop fresh APK" && git push
  ```
- Прямая raw-ссылка: `https://github.com/StarDust1508/TechForum202x/raw/main/apk/<file>.apk`

---

## 6. Эндпоинты API (`/api/v1/`)

| Метод | Path | Auth | Описание |
|---|---|---|---|
| GET | `/health` | — | `{status, db: up\|down}` |
| GET | `/ready` | — | `{status:'ready'}` |
| POST | `/auth/register` | — | `{email, password≥6, name}` → user + Set-Cookie |
| POST | `/auth/login` | — | `{email, password}` → user + Set-Cookie |
| POST | `/auth/logout` | session | invalidates session |
| GET | `/auth/me` | session | user payload + `interestsCount` |
| PATCH | `/auth/me` | session | `{name?, bio?, phone?, email?}` |
| POST | `/me/avatar` | session | multipart `file` → `/uploads/<file>` |
| GET | `/interests` | — | список 22 интересов |
| GET | `/me/interests` | session | `{interestIds: string[]}` |
| PUT | `/me/interests` | session | `{interestIds}` (3-10), atomic replace |
| GET | `/sessions/registered` | session | `{sessionIds: string[]}` |
| POST | `/sessions/:id/register` | session | регистрация на сессию |
| DELETE | `/sessions/:id/register` | session | отписка |
| GET | `/sessions/:id/calendar` | — | `.ics` для одной сессии |
| GET | `/sessions/calendar` | session | `.ics` для всех «моих» |
| GET | `/ticket/me` | session | QR payload + HMAC-подпись |
| GET | `/posts` | — | лента |
| POST | `/posts` | session | создать пост |
| POST | `/posts/:id/like` | session | toggle лайк |
| POST | `/posts/:id/comment` | session | добавить коммент |
| GET | `/statuses` | — | stories |
| POST | `/statuses` | session | создать status |
| POST | `/ai/chat` | session | Gemini с инжектом event-context |

**CORS** — `https://localhost`, `http://localhost`, `capacitor://localhost`, `http://72.56.9.90`, `http://72.56.9.90:3100` все разрешены.

**Cookie config:** `httpOnly + sameSite=lax + secure=COOKIE_SECURE`. `COOKIE_SECURE=false` пока работаем по cleartext IP.

---

## 7. Фичи и особенности

### Auth flow
- Регистрация требует чекбокс «согласие на обработку ПД» (152-ФЗ).
- После регистрации `interestsCount === 0` → ШИРМА Onboarding 22 интересов (3-10 выбрать).
- Onboarding пишет выбор и в БД (PUT /me/interests) и в localStorage как retry-buffer; на cold-start App.tsx досылает pending если БД ещё не получила.
- Cold-start splash 1с с blueprint фоном пока идёт `/auth/me`.

### Hardware back
- `useHardwareBack()` подписывается на `@capacitor/app` `backButton`.
- На `/` — double-tap to exit с фирменным toast «Нажмите ещё раз для выхода».
- На любом другом — `navigate(-1)`, fallback `navigate('/')` если нет history.

### Schedule
- 6 треков, 3 зала, 2 дня, 32 сессии (real Russian tech speakers).
- Вкладки: «20 мая», «21 мая», «Для меня» (Recommended по пересечению интересов), «Мои записи».
- Регистрация на сессию через POST → conflict-detection modal если уже записан на параллельную.
- `.ics export` per-session и for-all через native share intent.

### Chat
- 3 таба единого визуального стиля (Мероприятие / Личные / Ассистент).
- Sticky header + sticky input bar, лента — независимый scroll-container.
- Аудио record: красная пульсирующая точка + MM:SS + 60s auto-stop.
- Видео-bubble: live preview во время записи (200×200 mirrored circle), tap-to-mute после.
- AI Ассистент: Gemini получает в system-prompt компактный snapshot всей программы (TRACKS/SESSIONS/SPEAKERS/PARTNERS/EVENT_META).

### Profile
- Аватар upload (multer 5 MB, jpeg/png/webp).
- «Безопасность» открывает full-screen пользовательское соглашение 152-ФЗ.
- Edit / Security модалки на едином AppBackground.

### Ticket
- Реальный сканируемый QR через `qrcode` lib.
- Payload: `eventId|userId|email|name|tier|hmac` (HMAC-SHA256 подписан `SESSION_SECRET`).

### News (Feed)
- 12 рандомных новостей от спикеров.
- Каждая → `/news/:id` с лидом + полным body + карточкой автора-спикера.

### Шрифт и UI
- GOST Type A (woff2 в `public/fonts/`) — фирменный чертёжный, blueprint-эстетика.
- Sticky «TechForum 2026» header на главном с backdrop-blur halo.
- Единый AppBackground (blueprint conference-bg.jpg + dark gradient + бирюзовый glow) во всех разделах кроме Auth (тот имеет свой фон).
- Capacitor StatusBar настроен Style.Dark + #04020f, `overlaysWebView=false`.

### Безопасность
- scrypt N=16384 + 16-byte salt + `timingSafeEqual` на password compare.
- HMAC-SHA256 на ticket QR.
- zod-валидация на всех `/auth/*` и `/me/*`.
- Rate-limit на /auth (30/60s), /ai (20/60s).
- Postgres-сессии (`session` table), не in-memory.
- CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **HSTS отключён** пока на cleartext IP — иначе WebView кеширует upgrade-to-https и приложение падает.
- Daily pg_dump в `/var/backups/postgresql/`, 14-day retention.

---

## 8. Известные подводные камни (грабли)

| Грабли | Симптом | Решение |
|---|---|---|
| HSTS на cleartext | APK «нет сети», curl 200 | Не возвращать `Strict-Transport-Security` пока нет HTTPS |
| `androidScheme: 'https'` | Mixed content block fetch к http://72.56.9.90 | Стоит `'http'` — оставить пока нет HTTPS |
| `SameSite=Lax` cross-origin | Cookie не отправляется на cross-site PUT/DELETE | Workaround: `androidScheme:'http'` делает same-scheme. Реальное решение — domain + HTTPS + `SameSite=None; Secure` |
| WebView HSTS cache | После HSTS выкручивания — все ещё «нет сети» | Settings → System WebView → Clear Data, переустановить APK с Clear Data |
| Drizzle-kit migrate hangs | На сервере виснет | Применять SQL напрямую через `psql -f drizzle/000N_*.sql` |
| `loadEnv()` без префикса | `VITE_API_BASE_URL` не запекается | Передавать ENV явно через `env:` блок в CI workflow |
| `overflow:hidden` на ancestor | sticky-header не работает | На AppBackground стоит `overflow-x-hidden` (только горизонтальный clip) |
| `window.history.length===1` | Hardware back закрывает APK | Fallback `navigate('/')` при пустом стеке |
| `@capacitor/app` не установлен | Hardware back exit-ит безусловно | Установлен; импорт через `await import('@capacitor/app')` |
| Action mode на long-press | Белый Google-overlay при выделении | `user-select: none` на content-тегах в `index.css` |

---

## 9. Что делать если что-то сломалось

### «Нет сети» в APK
1. `curl -sS http://72.56.9.90:3100/api/v1/health` — backend жив?
2. Если нет → `ssh root@72.56.9.90 'systemctl status techforum && journalctl -u techforum -n 50'`
3. Если backend OK → проверь HSTS не вернулся в server.ts (`grep "Strict-Transport-Security" server.ts` — строка должна быть закомментирована).
4. На телефоне: Settings → System WebView → Clear Data; uninstall + Clear App Data; переустановка APK.
5. Если всё ещё нет — открой /diagnostics в APK, там точный URL и health-response.

### Backend упал
```bash
ssh root@72.56.9.90 'systemctl restart techforum && sleep 3 && systemctl is-active techforum && curl -sS http://127.0.0.1:3100/api/v1/health'
```

### БД повреждена
```bash
# Восстановить из последнего daily backup
ssh root@72.56.9.90
cd /var/backups/postgresql
ls -la  # выбрать свежий .dump
PGPASSWORD=$(grep "^DATABASE_URL=" /opt/techforum/.env.production | sed "s|.*techforum:\([^@]*\)@.*|\1|") \
  pg_restore -h 127.0.0.1 -U techforum -d techforum --clean techforum-2026-MM-DD.dump
systemctl restart techforum
```

### CI APK не собирается
- Открыть [Actions](https://github.com/StarDust1508/TechForum202x/actions) → последний run → логи.
- Чаще всего — typecheck (`tsc --noEmit`) → запусти `npm run lint` локально.

### Юзер не может зарегиться
- Проверь zod-ошибку в response body (`{error:"invalid_body", issues:[...]}`).
- Чаще всего — пароль < 6 или email невалид.

---

## 10. Roadmap (не сделано, но важно)

Из аудита остались (по приоритету):

1. **P1** — domain + Let's Encrypt → `androidScheme:'https'` обратно, `SameSite=None; Secure`, HSTS обратно.
2. **P2** — JWT-токены вместо cookie-session (упростит cross-origin).
3. **P2** — observability: structured-logger (`pino`), correlation-ID, Sentry.
4. **P2** — rate-limit на больше endpoints (сейчас только /auth и /ai).
5. **P3** — uninstall console.log в production-build.
6. **P3** — unit/E2E тесты (vitest + Playwright).

---

## 11. Контакты

- Репо: https://github.com/StarDust1508/TechForum202x
- Owner email: bigmandmitriy777@gmail.com
- Сервер: Timeweb VPS, IPv4 72.56.9.90 (рут-доступ по SSH-ключу)
- Backend domain: пока IP, нужен `techforum.ru` или субдомен для HTTPS

---

_Документ написан 2026-05-03. Если расходится с кодом — патч приветствуется._
