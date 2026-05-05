-- 0010_faq_contact_exchanges.sql
-- Round 6: faq + contact_exchanges. Идемпотентная.

-- 1) faq ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "faq" (
  "id" text PRIMARY KEY,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" text NOT NULL DEFAULT 'Общее',
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "faq_sort_idx" ON "faq" ("sort_order");
CREATE INDEX IF NOT EXISTS "faq_category_idx" ON "faq" ("category");

-- 2) contact_exchanges ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "contact_exchanges" (
  "owner_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "note" text NOT NULL DEFAULT '',
  "met_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "contact_exchanges_pk" PRIMARY KEY ("owner_id", "contact_id")
);

DO $$ BEGIN
 ALTER TABLE "contact_exchanges"
   ADD CONSTRAINT "contact_exchanges_owner_id_users_id_fk"
   FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "contact_exchanges"
   ADD CONSTRAINT "contact_exchanges_contact_id_users_id_fk"
   FOREIGN KEY ("contact_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "contact_exchanges_contact_idx" ON "contact_exchanges" ("contact_id");
