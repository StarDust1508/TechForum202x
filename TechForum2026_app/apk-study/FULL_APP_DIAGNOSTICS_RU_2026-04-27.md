# Полная диагностика приложения TechForum2026

Дата: 2026-04-27
Диагностика выполнена по исходникам, runtime-проверкам API и Android/Capacitor-конфигурации.

## 1. Резюме состояния

Общий статус: **желтый (работает, но есть критичные архитектурные и security-риски)**.

Что хорошо:
- `npm run lint` проходит (TypeScript без ошибок).
- `npm run build` проходит (production-сборка успешна).
- Базовые API `/api/v1/health`, `/api/v1/ready`, `register/login/me/logout` работают.
- `npm audit --omit=dev` не выявил уязвимостей в зависимостях.

Что критично:
- Есть логическая ошибка, из-за которой приложение может зависать на спиннере после успешной cookie-сессии.
- Gemini API ключ проектно прокидывается в клиентский бандл.
- Локальная fallback-аутентификация хранит пароли в `localStorage` в открытом виде.
- Android pipeline не верифицирован локально (нет Java Runtime), а embedded web-assets в `android/` не совпадают с текущим `dist/`.
- Разрыв между анализируемым `app-release.apk` и текущим проектом (разные package/appId).

## 2. Прогнанные проверки

## 2.1 Сборка и типы
- `npm run lint` -> OK
- `npm run build` -> OK
- В build есть предупреждение по размеру чанка:
  - `dist/assets/index-DgviIRIP.js` ~827.62 KB (gzip ~221.60 KB)

## 2.2 Зависимости
- `npm audit --omit=dev --json` -> `0` уязвимостей.
- `npx cap doctor` -> зависимости Capacitor актуальны.

## 2.3 Runtime smoke тест API
Протестировано:
- `GET /api/v1/health` -> 200
- `GET /api/v1/ready` -> 200
- `POST /api/v1/auth/register` -> 200 + `Set-Cookie`
- `GET /api/v1/auth/me` (после register) -> 200
- `POST /api/v1/auth/logout` -> 200
- `GET /api/v1/auth/me` (после logout) -> 401
- `GET /api/health` -> 200 + заголовки `Deprecation`, `Sunset`
- CORS: allow-list работает (разрешенный origin -> 200, посторонний -> 403)

## 2.4 Android/Gradle
- `./gradlew -v` не запускается: отсутствует Java Runtime в системе диагностики.

## 3. Критичные и важные проблемы (с приоритетом)

## P1-1. Возможный вечный экран загрузки при валидной серверной сессии
Симптом:
- В `App.tsx` при успешном `/auth/me` происходит `return` до `setLoading(false)`.
- На валидной cookie-сессии пользователь может остаться на спиннере.

Доказательство:
- `src/App.tsx:43-47` (успешный `res.ok` -> `return`)
- `src/App.tsx:57-59` (`setLoading(false)` находится только в `finally` второго блока)

Риск:
- Блокирует вход в приложение при reload с активной серверной сессией.

## P1-2. Секрет Gemini проектно утекает в клиентский бандл
Симптом:
- Ключ подставляется в браузерный код через `vite.define`.
- AI SDK вызывается напрямую из клиентского `Chat.tsx`.

Доказательство:
- `vite.config.ts:10-12`
- `src/pages/Chat.tsx:13`
- `src/pages/Chat.tsx:342-346`

Риск:
- Любой пользователь может извлечь ключ из бандла/сети и использовать вне приложения.

## P1-3. Локальная fallback-auth хранит пароли в plaintext в localStorage
Симптом:
- Модель пользователя содержит поле `password`.
- Список пользователей целиком сериализуется в `localStorage`.
- Есть seed-пользователь с паролем `123`.

Доказательство:
- `src/lib/localAuth.ts:5`
- `src/lib/localAuth.ts:21`
- `src/lib/localAuth.ts:46-47`
- `src/lib/localAuth.ts:113-118`
- `src/lib/localAuth.ts:143-148`

Риск:
- Компрометация учетных данных через XSS/доступ к устройству/бэкап браузера.

## P1-4. Session-cookie и session-secret ослаблены для production
Симптом:
- `SESSION_SECRET` имеет небезопасный fallback.
- `cookie.secure` принудительно `false`, даже в production.

Доказательство:
- `server.ts:108`
- `server.ts:117-122`

Риск:
- Повышенный риск перехвата/подделки сессий в небезопасной сети/конфигурации.

## P2-1. Вкладка «Лента» показывает неотфильтрованные типы контента
Симптом:
- Условие emptiness фильтрует `posts` без `video/status`, но реальный `map` рендерит все `posts`.

Доказательство:
- `src/pages/Feed.tsx:319` (фильтрация проверки)
- `src/pages/Feed.tsx:325` (рендер `posts.map` без фильтра)

Риск:
- Неконсистентный UX: во вкладке постов могут отображаться reel/video элементы.

## P2-2. Несовпадение web-assets в Android проекте и текущего dist
Симптом:
- Текущий `dist/assets`: `index-DgviIRIP.js`, `index-BGdROIZ-.css`
- В `android/app/src/main/assets/public/assets`: старые `index-BNFINWrr.js`, `index-Zo5mTDKB.css`

Риск:
- Android билд может собираться с устаревшим фронтендом.

## P2-3. Разрыв между анализируемым APK и текущим исходным проектом
Симптом:
- Ранее анализируемый APK: package `com.psy_lololo.conferenceapp`
- Текущий проект: appId `com.egor.techforum2026`

Доказательство:
- `apk-study/apk_components.json` -> `com.psy_lololo.conferenceapp`
- `capacitor.config.ts:4`
- `android/app/build.gradle:4,7`

Риск:
- Высокая вероятность, что исследованный `app-release.apk` собран не из текущей ветки исходников.

## P2-4. Android сборка не верифицирована (нет Java Runtime)
Симптом:
- `./gradlew -v` падает с ошибкой Java Runtime.

Риск:
- Нельзя подтвердить, что Android проект в текущем состоянии действительно собирается.

## P2-5. Жестко зашитые LAN endpoints в env и fallback CORS origins
Симптом:
- `.env.development`/`.env.production` используют `192.168.31.24`.
- Серверный fallback CORS также включает конкретный LAN origin.

Доказательство:
- `.env.development:1-2`
- `.env.production:1-2`
- `server.ts:130-137`

Риск:
- Ломкость в других средах, повышенный риск misconfig в релизе.

## P3-1. Несогласованность runtime версии Node
Симптом:
- Требование проекта: `>=22.12 <23`, `.nvmrc = 22.12.0`
- Фактически диагностика выполнялась на Node `v25.2.1`.

Доказательство:
- `package.json:6-8`
- `.nvmrc:1`
- runtime: `node -v -> v25.2.1`

Риск:
- Недетерминированные расхождения поведения между dev/CI/prod.

## P3-2. Отсутствуют автотесты
Симптом:
- Не обнаружены `*.test.*`, `*.spec.*`, e2e-проекты.

Риск:
- Регрессии не ловятся автоматически.

## P3-3. Технический долг типизации
Симптом:
- Много `any` в ключевых страницах (`App`, `Auth`, `Feed`, `Profile`, `Chat`).

Риск:
- Скрытые runtime-ошибки и усложнение поддержки.

## P3-4. UI/UX шероховатости
- В `Ticket.tsx` QR-матрица генерируется через `Math.random()` на рендер (`src/pages/Ticket.tsx:44-54`), визуально меняется без бизнес-смысла.
- В `Chat.tsx` есть `alert(...)` вместо UX-нотификаций (`src/pages/Chat.tsx:225,335,361`).

## 4. Диагностика архитектуры

Текущая архитектура гибридная:
- API + SSR-like dev middleware: `server.ts` (Express + Vite middleware)
- SPA frontend: React + Vite
- Mobile shell: Capacitor Android
- Локальный fallback для auth/части state через `localStorage`

Ключевой архитектурный риск:
- Дублируются модели авторизации (серверная сессия и локальная auth), что создает расхождения поведения и security-поверхность.

## 5. Сводка по безопасности

Положительное:
- Пароли на сервере хэшируются через `scrypt`.
- CORS не wildcard, есть allow-list.
- `httpOnly` на session cookie включен.

Нужно исправить в первую очередь:
1. Убрать AI ключ из клиентского бандла (перенести Gemini-вызовы в backend endpoint).
2. Убрать plaintext-password local fallback или хранить только ограниченный оффлайн-профиль без пароля.
3. Сделать `cookie.secure = isProduction` и запретить insecure fallback `SESSION_SECRET` в production.
4. Добавить basic rate limiting для auth/post/comment endpoints.

## 6. Сводка по Android

Проверено:
- Capacitor зависимости актуальны.

Не подтверждено:
- Локальная Gradle сборка (нет Java Runtime).

Важно:
- Android assets устарели относительно `dist`; нужен обязательный шаг `npx cap sync android` в релизном pipeline.
- package/appId проекта не совпадает с исследованным внешним APK.

## 7. Приоритетный план исправлений

## 24 часа (критичный минимум)
1. Исправить `loading`-flow в `App.tsx` (гарантированный `setLoading(false)` на всех ветках).
2. Убрать `process.env.GEMINI_API_KEY` из фронтенда; создать backend endpoint для AI.
3. Отключить plaintext-local-auth в production (фича-флаг или полный remove).
4. Усилить сессии: обязательный `SESSION_SECRET`, `secure` cookie для production.

## 3-5 дней
1. Починить фильтрацию постов во вкладке «Лента».
2. Ввести обязательный шаг sync web-assets в Android CI (`build -> cap sync -> gradle assemble`).
3. Убрать hardcoded LAN из production env.
4. Добавить smoke e2e (login/feed/profile) + unit на auth state machine.

## 1-2 недели
1. Типизировать доменные модели вместо `any`.
2. Разделить data-layer для online/offline с единой контрактной моделью.
3. Добавить security hardening: rate-limit, CSRF strategy для cookie-сессий, structured logging.

## 8. Вывод

Приложение функционально работоспособно и собирается, но на текущий момент имеет несколько проблем уровня P1, которые могут привести к блокирующим UX-сценариям и утечке секретов. До production-релиза необходимо устранить P1, подтвердить Android сборку в Java-окружении и синхронизировать mobile assets pipeline.
