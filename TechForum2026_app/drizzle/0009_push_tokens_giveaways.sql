-- 0009_push_tokens_giveaways.sql
-- Round 5 (АРХИТЕКТУРА III): push_tokens + giveaways + giveaway_entries.
-- Идемпотентная: IF NOT EXISTS / DO $$ EXCEPTION.

-- 1) push_tokens ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "platform" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "device_label" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
 ALTER TABLE "push_tokens"
   ADD CONSTRAINT "push_tokens_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "push_tokens_user_idx" ON "push_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "push_tokens_token_idx" ON "push_tokens" ("token");

-- 2) giveaways ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "giveaways" (
  "id" text PRIMARY KEY,
  "category" text NOT NULL,
  "item" text NOT NULL,
  "icon_key" text NOT NULL DEFAULT 'Gift',
  "gradient" text NOT NULL DEFAULT 'from-[#4ec9c0]/40 to-[#4ec9c0]/10',
  "description" text NOT NULL,
  "condition" text NOT NULL,
  "end_time" text NOT NULL,
  "featured" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "giveaways_sort_idx" ON "giveaways" ("sort_order");

-- 3) giveaway_entries -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "giveaway_entries" (
  "user_id" text NOT NULL,
  "giveaway_id" text NOT NULL,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "giveaway_entries_pk" PRIMARY KEY ("user_id", "giveaway_id")
);

DO $$ BEGIN
 ALTER TABLE "giveaway_entries"
   ADD CONSTRAINT "giveaway_entries_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "giveaway_entries"
   ADD CONSTRAINT "giveaway_entries_giveaway_id_fk"
   FOREIGN KEY ("giveaway_id") REFERENCES "giveaways"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "giveaway_entries_giveaway_idx" ON "giveaway_entries" ("giveaway_id");
