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
