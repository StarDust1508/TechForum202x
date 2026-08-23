CREATE TABLE IF NOT EXISTS "contact_pins" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "contact_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "pinned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "contact_pins_user_id_contact_user_id_pk" PRIMARY KEY ("user_id", "contact_user_id"),
  CONSTRAINT "contact_pins_not_self" CHECK ("user_id" <> "contact_user_id")
);
CREATE INDEX IF NOT EXISTS "contact_pins_user_idx" ON "contact_pins" ("user_id", "pinned_at");

CREATE TABLE IF NOT EXISTS "telegram_link_tokens" (
  "token_hash" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "telegram_link_tokens_user_idx" ON "telegram_link_tokens" ("user_id", "expires_at");
