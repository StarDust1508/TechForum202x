-- 0002_password_reset.sql
-- Adds password_reset_tokens table for /auth/forgot-password/* flow.
-- Idempotent: IF NOT EXISTS guards allow re-running on prod safely.

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "token_hash" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "password_reset_tokens"
   ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
   FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "password_reset_user_idx" ON "password_reset_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_token_hash_idx" ON "password_reset_tokens" ("token_hash");
