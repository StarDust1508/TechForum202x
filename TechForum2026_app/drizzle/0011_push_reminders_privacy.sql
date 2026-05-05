-- 0011_push_reminders_privacy.sql
-- Round 7 (PUSH): фундамент уведомлений.
-- 1) registrations.reminder_sent_at — флаг что cron уже отправил «через 15мин»
-- 2) users.push_preview_hidden — privacy-toggle в Settings (body push'а скрыт)
-- 3) users.role меняем на enum-like с admin для dev-юзера v@tech.com (для
--    /admin/* endpoints). Текущие row'ы остаются с 'Участник' / 'Спикер'.
-- Идемпотентная.

DO $$ BEGIN
 ALTER TABLE "registrations" ADD COLUMN "reminder_sent_at" timestamp with time zone;
EXCEPTION WHEN duplicate_column THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "users" ADD COLUMN "push_preview_hidden" boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- Backfill: dev-юзер становится admin для тестирования /admin/* endpoints.
-- Прод: реальные admin-юзеры назначаются вручную через UPDATE.
UPDATE "users" SET "role" = 'admin' WHERE email = 'v@tech.com' AND role <> 'admin';
