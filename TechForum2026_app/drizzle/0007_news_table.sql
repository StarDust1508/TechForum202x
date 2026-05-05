-- 0007_news_table.sql
-- Round 3 (АРХИТЕКТУРА): переносим контент NEWS из src/data.ts в БД.
-- Идемпотентная — IF NOT EXISTS / DO $$ EXCEPTION.

CREATE TABLE IF NOT EXISTS "news" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "time" text NOT NULL,
  "is_critical" boolean NOT NULL DEFAULT false,
  "category" text,
  "speaker_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "sort_order" integer NOT NULL DEFAULT 0
);

DO $$ BEGIN
 ALTER TABLE "news"
   ADD CONSTRAINT "news_speaker_id_fk"
   FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "news_sort_idx" ON "news" ("sort_order");
CREATE INDEX IF NOT EXISTS "news_speaker_idx" ON "news" ("speaker_id");
