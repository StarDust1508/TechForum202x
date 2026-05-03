-- 0003_direct_messages.sql
-- Adds 1:1 DM table for Chat «Личные».
-- Idempotent.

CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" text PRIMARY KEY NOT NULL,
    "from_user_id" text NOT NULL,
    "to_user_id" text NOT NULL,
    "text" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "read_at" timestamp with time zone
);

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_from_user_id_users_id_fk"
   FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_to_user_id_users_id_fk"
   FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "dm_from_idx" ON "direct_messages" ("from_user_id");
CREATE INDEX IF NOT EXISTS "dm_to_idx" ON "direct_messages" ("to_user_id");
CREATE INDEX IF NOT EXISTS "dm_created_at_idx" ON "direct_messages" ("created_at");
