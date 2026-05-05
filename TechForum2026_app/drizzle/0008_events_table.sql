-- 0008_events_table.sql
-- Round 4 (АРХИТЕКТУРА): events table — фундамент для multi-event поддержки.
-- Не добавляет event_id в существующие таблицы (это будет следующий шаг,
-- когда появится реальное второе событие). Только заводит сам реестр.

CREATE TABLE IF NOT EXISTS "events" (
  "id" text PRIMARY KEY,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "location" text NOT NULL DEFAULT '',
  "city" text NOT NULL DEFAULT '',
  "timezone" text NOT NULL DEFAULT 'Europe/Moscow',
  "organizer" text NOT NULL DEFAULT '',
  "organizer_email" text,
  "url" text,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "hmac_secret" text NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "events_slug_idx" ON "events" ("slug");

-- Default event — текущий TechForum 2026. hmac_secret пока пустой, fallback
-- на ENV TICKET_HMAC_SECRET (см. server.ts). Когда реально будет 2-е событие,
-- сгенерим свежий secret через crypto.randomBytes(32).
INSERT INTO "events" (id, slug, name, location, city, timezone, organizer)
VALUES (
  'techforum-2026',
  'techforum-2026',
  'TechForum 2026',
  'Технополис',
  'Саратов',
  'Europe/Moscow',
  'Корпорация Синергия'
)
ON CONFLICT (id) DO NOTHING;
