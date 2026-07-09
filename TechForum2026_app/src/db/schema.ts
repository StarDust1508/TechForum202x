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

import { pgTable, text, integer, boolean, timestamp, primaryKey, index, varchar, jsonb } from 'drizzle-orm/pg-core';

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
    company: text('company').notNull().default(''),
    workplace: text('workplace').notNull().default(''),
    education: text('education').notNull().default(''),
    birthday: text('birthday').notNull().default(''),
    isPrivate: boolean('is_private').notNull().default(false),
    pushPreviewHidden: boolean('push_preview_hidden').notNull().default(false),
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
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
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
// PASSWORD RESET TOKENS
// ============================================================================

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// DIRECT MESSAGES
// ============================================================================

export const directMessages = pgTable(
  'direct_messages',
  {
    id: text('id').primaryKey(),
    fromUserId: text('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    toUserId: text('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    text: text('text'),
    mediaUrl: text('media_url'),
    mediaType: varchar('media_type', { length: 32 }),
    replyToId: text('reply_to_id'),
    forwardedFromUserId: text('forwarded_from_user_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromIdx: index('dm_from_idx').on(t.fromUserId),
    toIdx: index('dm_to_idx').on(t.toUserId),
  }),
);

export const dmPins = pgTable(
  'dm_pins',
  {
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    partnerUserId: text('partner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    messageId: text('message_id').notNull().references(() => directMessages.id, { onDelete: 'cascade' }),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.messageId] }),
  }),
);

// ============================================================================
// NOTES (личные заметки участника)
// ============================================================================

export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// NEWS & EVENTS
// ============================================================================

export const news = pgTable('news', {
  id: text('id').primaryKey(),
  type: varchar('type', { length: 32 }).notNull().default('news'),
  title: text('title').notNull(),
  content: text('content'),
  body: text('body').notNull(),
  time: text('time'),
  isCritical: boolean('is_critical').notNull().default(false),
  category: varchar('category', { length: 64 }),
  imageUrl: text('image_url'),
  speakerId: text('speaker_id'),
  sortOrder: integer('sort_order').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  city: text('city'),
  timezone: varchar('timezone', { length: 64 }),
  organizer: text('organizer'),
  url: text('url'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  location: text('location'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    platform: varchar('platform', { length: 16 }).notNull().default('android'),
    deviceLabel: text('device_label'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ============================================================================
// GIVEAWAYS
// ============================================================================

export const giveaways = pgTable('giveaways', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: varchar('category', { length: 64 }).notNull().default('general'),
  item: text('item').notNull().default(''),
  iconKey: varchar('icon_key', { length: 32 }),
  gradient: text('gradient'),
  description: text('description'),
  condition: text('condition'),
  imageUrl: text('image_url'),
  endTime: text('end_time'),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  featured: boolean('featured').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  winnerId: text('winner_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const giveawayEntries = pgTable(
  'giveaway_entries',
  {
    giveawayId: text('giveaway_id').notNull().references(() => giveaways.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.giveawayId, t.userId] }),
  }),
);

// ============================================================================
// FAQ
// ============================================================================

export const faq = pgTable('faq', {
  id: text('id').primaryKey(),
  category: varchar('category', { length: 64 }).notNull().default('general'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ============================================================================
// AI CHAT MESSAGES (серверная персистенция диалогов с AI-ассистентом)
// ============================================================================

export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'bot'
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('ai_chat_messages_user_idx').on(t.userId),
  }),
);

// ============================================================================
// CONTACT EXCHANGES (QR-визитка)
// ============================================================================

export const contactExchanges = pgTable(
  'contact_exchanges',
  {
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    note: text('note').notNull().default(''),
    metAt: timestamp('met_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ownerId, t.contactId] }),
  }),
);
