// FILE: src/db/schema.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT:
// PURPOSE: Drizzle-схема БД для TechForum 2026. Включает auth, контент-ленту,
//          справочники программы (треки/залы/дни/спикеры/сессии/партнёры) и
//          клиентские отношения (регистрации на сессии).
// SCOPE: Schema-only. Никаких запросов, миграций, seed-логики.
// INPUT: Используется drizzle-kit для генерации SQL-миграций и runtime для типизации.
// OUTPUT: Экспортируемые pgTable-объекты + типы Insert/Select.
// KEYWORDS: DOMAIN(9): ConferenceProgram, Auth, SocialFeed; CONCEPT(8): RelationalSchema; TECH(9): Drizzle, Postgres
// LINKS: USED_BY(10): src/db/index.ts, server.ts, src/db/seed.ts
// END_MODULE_CONTRACT
//
// START_RATIONALE:
// Q: Почему id-колонки text, а не uuid?
// A: Совместимость с существующим API — фронт ожидает строки, а text-колонки
//    позволяют генерировать id на сервере через crypto.randomUUID() без cast'ов
//    в каждом запросе. Перфоманс-разница на наших объёмах несущественна.
// Q: Почему справочники (tracks/halls/days/speakers/sessions/partners) — таблицы,
//    а не keep-as-static-TS?
// A: Сейчас они статичны через src/data.ts. Но (1) для будущих фич (rate session,
//    Q&A, polls) нужны foreign keys, (2) ор для админки для оперативных правок
//    программы. Seed скрипт грузит их из data.ts — то есть data.ts остаётся
//    источником истины при разработке, а БД — источником в рантайме.
// Q: Почему registrations и post_likes — отдельные join-таблицы, а не jsonb-массивы?
// A: Постгрес умеет нормально индексировать jsonb, но для подсчёта счётчиков
//    (count(*)) и фильтра по пользователю (where userId=...) нормализованные
//    таблицы дают предсказуемый план запроса.
// END_RATIONALE
//
// START_INVARIANTS:
// - Все таблицы имеют createdAt timestamp (audit/sort).
// - Каждый foreign key с onDelete cascade или set null — явно указан.
// - Email хранится в нижнем регистре (контракт уровня сервера, не БД).
// END_INVARIANTS
//
// START_CHANGE_SUMMARY:
// LAST_CHANGE: [v1.0.0 - Первичная схема: users, sessions, posts, post_likes,
//                       post_comments, statuses, registrations, tracks, halls,
//                       days, speakers, session_speakers, partners.]
// END_CHANGE_SUMMARY

import { pgTable, text, integer, boolean, timestamp, primaryKey, index, varchar } from 'drizzle-orm/pg-core';

// ============================================================================
// AUTH
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    avatar: text('avatar').notNull().default(''),
    bio: text('bio').notNull().default(''),
    phone: text('phone'),
    role: text('role').notNull().default('Участник'),
    isPrivate: boolean('is_private').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index('users_email_idx').on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// ============================================================================
// EVENTS — multi-event фундамент (Round 4)
// ============================================================================
// Раньше приложение было однособытийное (хардкод 'techforum-2026' в server.ts:
// ticket-payload). Теперь events — отдельная таблица, и одно приложение может
// обслуживать N событий (как Eventicious-эталон). Существующие таблицы
// (sessions, speakers, partners, news, etc) пока БЕЗ event_id колонок —
// реальная миграция к multi-event схеме делается позже, когда:
//  1) появится второе событие в реальности (осенний форум 2026)
//  2) будет готова админка для seed'а нового event'а
// Пока этого нет — все queries неявно работают с default-событием.
//
// hmacSecret отдельный per-event — используется для подписи QR-билета
// (см. server.ts ticket payload). Если протекает один — другой event
// остаётся защищённым.
//
// settings jsonb — гибкий контейнер для feature-flags конкретного события
// (показывать/скрывать модули, кастомные ссылки в Settings, etc).
export const events = pgTable(
  'events',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    location: text('location').notNull().default(''),
    city: text('city').notNull().default(''),
    timezone: text('timezone').notNull().default('Europe/Moscow'),
    organizer: text('organizer').notNull().default(''),
    organizerEmail: text('organizer_email'),
    url: text('url'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    hmacSecret: text('hmac_secret').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index('events_slug_idx').on(t.slug),
  }),
);

// ============================================================================
// PROGRAM REFERENCE TABLES (треки / залы / дни / спикеры / сессии / партнёры)
// ============================================================================

export const tracks = pgTable('tracks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: varchar('color', { length: 16 }).notNull(),
  shortLabel: text('short_label').notNull(),
});

export const halls = pgTable('halls', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
});

export const days = pgTable('days', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  label: text('label').notNull(),
  weekday: text('weekday').notNull(),
});

export const speakers = pgTable(
  'speakers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    company: text('company').notNull(),
    bio: text('bio').notNull(),
    avatarLetter: text('avatar_letter').notNull(),
    topic: text('topic'),
    trackId: text('track_id').notNull().references(() => tracks.id, { onDelete: 'restrict' }),
    // BUG_FIX_CONTEXT: Для ранжирования "Recommended" в Schedule нужно знать
    // тематические интересы спикера. text[] — нативный массив Postgres,
    // Drizzle поддерживает через .array(). Default '{}' гарантирует non-null.
    interestIds: text('interest_ids').array().notNull().default([]),
  },
  (t) => ({
    trackIdx: index('speakers_track_idx').on(t.trackId),
  }),
);

export const sessionsEvent = pgTable(
  'sessions_event',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    format: text('format').notNull(),
    hallId: text('hall_id').references(() => halls.id, { onDelete: 'set null' }),
    dayId: text('day_id').notNull().references(() => days.id, { onDelete: 'restrict' }),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('Soon'),
  },
  (t) => ({
    dayIdx: index('sessions_day_idx').on(t.dayId),
    trackIdx: index('sessions_track_idx').on(t.trackId),
    hallIdx: index('sessions_hall_idx').on(t.hallId),
  }),
);

// many-to-many: одна сессия — несколько спикеров (для panel)
export const sessionSpeakers = pgTable(
  'session_speakers',
  {
    sessionId: text('session_id').notNull().references(() => sessionsEvent.id, { onDelete: 'cascade' }),
    speakerId: text('speaker_id').notNull().references(() => speakers.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.speakerId] }),
  }),
);

export const partners = pgTable('partners', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  url: text('url').notNull(),
  description: text('description').notNull(),
});

// News (Лента) — раньше жил в src/data.ts. Round 3 переносит в БД, чтобы
// контент мог обновляться без релиза APK. speakerId — опциональная ссылка
// на автора (FK SET NULL: если спикер удалён, новость остаётся).
// isCritical — красная точка-индикатор в UI. category — рубрика.
export const news = pgTable(
  'news',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    body: text('body').notNull().default(''),
    time: text('time').notNull(),
    isCritical: boolean('is_critical').notNull().default(false),
    category: text('category'),
    speakerId: text('speaker_id').references(() => speakers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    sortIdx: index('news_sort_idx').on(t.sortOrder),
    speakerIdx: index('news_speaker_idx').on(t.speakerId),
  }),
);

// ============================================================================
// SOCIAL FEED
// ============================================================================

export const posts = pgTable(
  'posts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    url: text('url').notNull().default(''),
    text: text('text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('posts_user_idx').on(t.userId),
    createdAtIdx: index('posts_created_at_idx').on(t.createdAt),
  }),
);

export const postLikes = pgTable(
  'post_likes',
  {
    postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.userId] }),
  }),
);

export const postComments = pgTable(
  'post_comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    postIdx: index('post_comments_post_idx').on(t.postId),
    userIdx: index('post_comments_user_idx').on(t.userId),
  }),
);

export const statuses = pgTable(
  'statuses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    url: text('url').notNull().default(''),
    text: text('text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('statuses_user_idx').on(t.userId),
    createdAtIdx: index('statuses_created_at_idx').on(t.createdAt),
  }),
);

// ============================================================================
// USER ↔ SESSION (регистрации, для будущих ratings — отдельная таблица)
// ============================================================================

export const registrations = pgTable(
  'registrations',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull().references(() => sessionsEvent.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sessionId] }),
    sessionIdx: index('registrations_session_idx').on(t.sessionId),
  }),
);

// ============================================================================
// INTERESTS (Onboarding + ранжирование Recommended в Schedule)
// ============================================================================

export const interests = pgTable('interests', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  color: varchar('color', { length: 16 }).notNull(),
});

export const userInterests = pgTable(
  'user_interests',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    interestId: text('interest_id').notNull().references(() => interests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.interestId] }),
    userIdx: index('user_interests_user_idx').on(t.userId),
  }),
);

// ============================================================================
// DIRECT MESSAGES (DM в Chat «Личные»)
// ============================================================================
// Простая 1-к-1 переписка. Нет групп, нет threads, нет реакций. Удаление —
// onDelete cascade (если автор/получатель удаляется, его DM физически
// уходят). readAt — для индикатора непрочитанного.
// mediaUrl/mediaType — опциональное вложение image|audio|video.
// FK on delete SET NULL (P1 FIX): раньше cascade удалял всю переписку
// А↔B когда B удаляет аккаунт, А терял свою историю. Теперь from/to
// делается NULL, переписка остаётся, UI рисует «удалённый пользователь».
export const directMessages = pgTable(
  'direct_messages',
  {
    id: text('id').primaryKey(),
    fromUserId: text('from_user_id').references(() => users.id, { onDelete: 'set null' }),
    toUserId: text('to_user_id').references(() => users.id, { onDelete: 'set null' }),
    text: text('text').notNull().default(''),
    mediaUrl: text('media_url'),
    mediaType: text('media_type'),
    // Reply: ссылка на оригинал. ON DELETE SET NULL — если оригинал удалили,
    // цитата сохраняется (UI рисует "[удалено]"). self-FK добавлен в SQL
    // миграции 0006 (drizzle.kit не любит self-references на сгенерации).
    replyToId: text('reply_to_id'),
    // Forward: ссылка на оригинального автора. ON DELETE SET NULL.
    forwardedFromUserId: text('forwarded_from_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => ({
    fromIdx: index('dm_from_idx').on(t.fromUserId),
    toIdx: index('dm_to_idx').on(t.toUserId),
    createdAtIdx: index('dm_created_at_idx').on(t.createdAt),
    replyToIdx: index('dm_reply_to_idx').on(t.replyToId),
  }),
);

// ============================================================================
// DM PINS (закреплённые сообщения в диалогах)
// ============================================================================
// Pin — per-user, per-dialog. То есть «я закрепил» — видно только мне.
// Это компромисс между «закрепить только себе» (LocalStorage был именно
// таким) и «закрепить обоим» (требует прав на чужой mailbox). Сейчас:
// сохраняется на сервере → переживает переустановку, sync между устройствами
// одного юзера. Один pinned per (user, partnerUserId).
export const dmPins = pgTable(
  'dm_pins',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    // partnerUserId — собеседник в диалоге, контекст pin'а. Пара (userId,
    // partnerUserId) однозначно идентифицирует диалог в нашей 1-к-1 модели.
    partnerUserId: text('partner_user_id').notNull(),
    messageId: text('message_id').notNull().references(() => directMessages.id, { onDelete: 'cascade' }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.partnerUserId] }),
    msgIdx: index('dm_pins_message_idx').on(t.messageId),
  }),
);

// ============================================================================
// NOTES (личные заметки в MyRecords → 3-я вкладка)
// ============================================================================
// Простой персональный текстовый блокнот. Один юзер = одна стопка заметок.
// title не отдельный — берётся из первой непустой строки body (UI-конвенция).
export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('notes_user_idx').on(t.userId),
    updatedAtIdx: index('notes_updated_at_idx').on(t.updatedAt),
  }),
);

// ============================================================================
// PASSWORD RESET (forgot-password flow)
// ============================================================================
// Хранит short-lived reset-токены. token хешируется (SHA-256) — в БД лежит
// только digest, raw token уходит в email/SMS пользователю один раз. После
// успешной смены пароля или истечения TTL запись удаляется.
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('password_reset_user_idx').on(t.userId),
    tokenHashIdx: index('password_reset_token_hash_idx').on(t.tokenHash),
  }),
);
