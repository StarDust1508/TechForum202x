-- 0004_dm_media.sql
-- Добавляет поля media_url + media_type к direct_messages для прикреплений
-- (image/audio/video). text стал необязательным (только media-сообщения).
-- Идемпотентно.

ALTER TABLE "direct_messages" ALTER COLUMN "text" SET DEFAULT '';
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "media_url" text;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "media_type" text;
