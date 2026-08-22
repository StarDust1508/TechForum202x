-- Align runtime schema with the original events table and keep admin platform
-- analytics truthful for both Android and iOS clients.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "registration_platform" varchar(16) NOT NULL DEFAULT 'unknown';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "registration_device" text;

-- These columns already exist on the current production database, but were
-- missing from the migration history. Keeping them additive makes a clean
-- install and a disaster-recovery restore match the runtime Drizzle schema.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company" text NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workplace" text NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "education" text NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday" text NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;

ALTER TABLE "speakers" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT '';
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "used_at" timestamp with time zone;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "is_published" boolean NOT NULL DEFAULT true;
ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "dm_pins" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "contact_exchanges" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "ai_chat_messages" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "text" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_chat_messages_user_idx" ON "ai_chat_messages" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_hall_idx" ON "sessions_event" ("hall_id");
CREATE INDEX IF NOT EXISTS "post_comments_user_idx" ON "post_comments" ("user_id");

UPDATE "events"
SET
  "name" = 'ТехнологИИ Права 2026',
  "location" = 'БЦ «Красные Ворота», Садовая-Спасская улица, 21/1',
  "city" = 'Москва',
  "timezone" = 'Europe/Moscow',
  "organizer" = 'ТехнологИИ Права',
  "organizer_email" = 'info@tech-pravo.ru',
  "url" = 'https://tech-pravo.ru/conference',
  "starts_at" = '2026-09-25 09:00:00+03',
  "ends_at" = '2026-09-26 20:00:00+03',
  "is_active" = true
WHERE "slug" = 'techforum-2026';
