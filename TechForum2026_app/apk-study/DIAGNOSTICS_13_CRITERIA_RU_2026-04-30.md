# Диагностика приложения по 13 критериям (повторная, исправленная)

Дата: 2026-04-30
Проект: `/Users/bubble3/Desktop/Приложение TechForum2026`
APK для анализа: `/Users/bubble3/Library/Containers/ru.keepcoder.Telegram/Data/tmp/app-release.apk`

Документ обновлён после повторной тщательной проверки исходников, сборки и smoke-тестов API.

## 1. Frontend (мобильное приложение iOS / Android)
- Frontend реализован на **React 19 + Vite + React Router + Tailwind CSS**.
- Мобильная обёртка: **Capacitor Android** (`android/` присутствует).
- iOS-обёртка в текущем репозитории **не обнаружена** (нет `ios/`, `@capacitor/ios` не подключен).
- По APK-разбору (`apk-study/apk_components.json`):
  - package: `com.psy_lololo.conferenceapp`
  - version: `1.0.0`
  - minSdk: `24`, targetSdk: `36`

## 2. Backend (логика, БД, авторизация)
- Backend: **Node.js + Express** (`server.ts`).
- Авторизация: **session-cookie** (`express-session`), не JWT.
- Бизнес-логика и данные в памяти процесса (`users`, `posts`, `statuses`), без постоянной server-side БД.
- Пароли на backend: хеширование через `crypto.scryptSync` + `timingSafeEqual`.

## 3. API (связь frontend ↔ backend)
- Основной API-префикс: `/api/v1`.
- Legacy-маршруты `/api/*` проксируются с deprecation headers.
- Frontend использует `fetch(..., { credentials: 'include' })`.
- AI-вызов перенесён на backend: `POST /api/v1/ai/chat` (требует авторизацию).

## 4. Database (где хранятся users/messages/orders/settings)
- Серверная БД (PostgreSQL/MySQL/Mongo/SQLite) **не подключена**.
- На backend данные эфемерные (in-memory), очищаются при перезапуске процесса.
- На frontend используется `localStorage` для части пользовательских данных и fallback-режима.
- В local fallback пароли больше не хранятся в plaintext: используется PBKDF2 (Web Crypto, hash+salt).

## 5. Архитектура: User → Frontend → Backend → Database
Фактический поток:
1. `User -> Frontend (React UI)`
2. `Frontend -> Backend API (Express, cookie session)`
3. `Backend -> In-memory state (вместо внешней DB)`

Дополнительный fallback-путь (только при включенном флаге):
1. `User -> Frontend`
2. `Frontend -> localStorage` (локальная auth-модель)

## 6. Язык программирования и что подошло бы лучше
- Текущий язык: **TypeScript/JavaScript** (frontend + backend).
- Для текущего MVP это практично (единый стек).
- Для production масштабирования важнее не смена языка, а:
  - вынести backend в модульную структуру,
  - подключить постоянную БД,
  - добавить тесты/наблюдаемость/инфраструктуру.

## 7. Технологический стек
- Frontend: React 19, react-router-dom, Tailwind CSS, motion, lucide-react.
- Mobile: Capacitor (`@capacitor/android`, `@capacitor/core`, `@capacitor/cli`).
- Backend: Express, express-session, cookie-parser, multer.
- AI: `@google/genai` на backend.
- Прочее: socket.io присутствует в зависимостях.

## 8. Как приложение обрабатывает запрос
1. Клиент вычисляет API URL (`runtimeEndpoint.ts`).
2. Отправляет HTTP-запрос в backend.
3. Middleware backend применяет:
  - JSON/body parsing
  - session handling
  - CORS allowlist
  - security headers
  - rate limit (для auth/ai)
4. Handler обрабатывает запрос и возвращает JSON.

## 9. Балансировка нагрузки (Load Balancer)
- Конфигурация балансировщика в проекте **отсутствует**.
- Backend single-process и хранит состояние в памяти, что не готово к горизонтальному масштабированию без внешней БД/сессий.

## 10. Кэширование
- Серверного cache-слоя (Redis/Memcached) нет.
- HTTP cache policy для API не настроена как отдельный слой оптимизации.
- На клиенте есть localStorage, но это не полноценный распределённый cache.

## 11. Безопасность (HTTPS, пароли, SQLi, JWT)
- HTTPS/SSL termination в коде приложения не реализован (ожидается внешняя инфраструктура: reverse proxy/LB).
- Пароли:
  - backend: `scrypt` (без bcrypt)
  - local fallback: теперь PBKDF2 hash+salt (plaintext убран)
- SQL-injection в текущем виде неактуальна, так как SQL-БД не используется.
- JWT в текущей модели не используется (auth на сессиях).
- Усиления, подтверждённые в коде:
  - production требует `SESSION_SECRET`
  - `cookie.secure` включается в production
  - security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
  - rate limit: `/auth/*` и `/ai/chat`
  - CORS allowlist с блокировкой неразрешённых origin

## 12. DevOps и инфраструктура
- В репозитории не обнаружены готовые CI/CD pipelines (GitHub Actions/GitLab CI/Jenkinsfile), Docker/K8s/Terraform.
- Android синхронизация web-ассетов выполняется командой:
  - `npx cap sync android`
- Для production требуется формализация pipeline, секретов и окружений.

## 13. Мониторинг и логирование (Winston/Loguru/Prometheus/Grafana)
- Сейчас используется базовое логирование через `console.*`.
- Winston/Loguru не интегрированы.
- Prometheus/Grafana и метрики `/metrics` отсутствуют.
- Рекомендуется добавить structured logging + метрики + алерты.

## Фактические проверки (повторная диагностика)

### Сборка и типы
- `npm run lint` -> OK
- `npm run build` -> OK

### Проверка API
- `GET /api/v1/health` -> `200`
- `GET /api/v1/auth/me` без сессии -> `401`
- `POST /api/v1/auth/register` -> `200`
- `POST /api/v1/auth/login` (ошибочный пароль) -> `401`
- `POST /api/v1/auth/logout` -> `200`
- `POST /api/v1/ai/chat` без сессии -> `401`
- `POST /api/v1/ai/chat` с сессией и без `GEMINI_API_KEY` -> `503 ai_not_configured` (ожидаемо)
- Rate limit:
  - `/api/v1/ai/chat` -> `429 rate_limit_exceeded` при превышении лимита
  - `/api/v1/auth/login` -> `429 rate_limit_exceeded` при превышении лимита

### Проверка заголовков и CORS
- Security headers на `/health` присутствуют.
- Разрешённый Origin (`http://localhost:5173`) получает CORS headers.
- Неразрешённый Origin (`https://evil.example`) получает `403 origin_not_allowed`.

## Вывод
Система приведена в более безопасное и стабильное состояние по сравнению с предыдущей ревизией: закрыты критичные вопросы с клиентским AI-вызовом, сессионной конфигурацией, базовой защитой API и fallback-auth хранением паролей. 

При этом архитектура остаётся MVP-уровня из-за отсутствия постоянной БД, production-infra и полноценной observability.
