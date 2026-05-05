-- 0006_dm_reply_forward_pins_notes.sql
-- Раунд 2 (ЧЕСТНОСТЬ): убираем localStorage-фейки Pin/Reply/Forward/Notes,
-- переносим persistence в БД.
--
-- 1) direct_messages.reply_to_id (self-FK, SET NULL) — структурный reply
-- 2) direct_messages.forwarded_from_user_id (FK users, SET NULL) — атрибуция forward
-- 3) dm_pins — закреплённые сообщения (per-user, per-dialog)
-- 4) notes — персональные заметки
--
-- Все ALTER идемпотентны через DO $$ BEGIN ... EXCEPTION WHEN duplicate_*
-- THEN null; END $$ — миграция безопасна на повторный прогон.

-- 1. reply_to_id ----------------------------------------------------------
DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD COLUMN "reply_to_id" text;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_reply_to_id_fk"
   FOREIGN KEY ("reply_to_id") REFERENCES "direct_messages"("id")
   ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "dm_reply_to_idx" ON "direct_messages" ("reply_to_id");

-- 2. forwarded_from_user_id -----------------------------------------------
DO $$ BEGIN
 ALTER TABLE "direct_messages" ADD COLUMN "forwarded_from_user_id" text;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_forwarded_from_user_id_users_id_fk"
   FOREIGN KEY ("forwarded_from_user_id") REFERENCES "users"("id")
   ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. dm_pins --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "dm_pins" (
  "user_id" text NOT NULL,
  "partner_user_id" text NOT NULL,
  "message_id" text NOT NULL,
  "pinned_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "dm_pins_pk" PRIMARY KEY ("user_id", "partner_user_id")
);

DO $$ BEGIN
 ALTER TABLE "dm_pins"
   ADD CONSTRAINT "dm_pins_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "dm_pins"
   ADD CONSTRAINT "dm_pins_message_id_dm_id_fk"
   FOREIGN KEY ("message_id") REFERENCES "direct_messages"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "dm_pins_message_idx" ON "dm_pins" ("message_id");

-- 4. notes ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notes" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "notes"
   ADD CONSTRAINT "notes_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "notes_user_idx" ON "notes" ("user_id");
CREATE INDEX IF NOT EXISTS "notes_updated_at_idx" ON "notes" ("updated_at");
