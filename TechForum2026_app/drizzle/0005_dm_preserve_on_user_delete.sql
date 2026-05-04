-- 0005_dm_preserve_on_user_delete.sql
-- Меняем direct_messages FK с CASCADE на SET NULL чтобы переписка
-- сохранялась когда один из участников удаляет аккаунт (раньше А
-- терял всю свою историю с B при удалении B).
-- Идемпотентно: проверяем существование constraint перед drop'ом.

DO $$ BEGIN
 ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_from_user_id_users_id_fk";
EXCEPTION WHEN undefined_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages" DROP CONSTRAINT "direct_messages_to_user_id_users_id_fk";
EXCEPTION WHEN undefined_object THEN null; END $$;

ALTER TABLE "direct_messages" ALTER COLUMN "from_user_id" DROP NOT NULL;
ALTER TABLE "direct_messages" ALTER COLUMN "to_user_id" DROP NOT NULL;

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_from_user_id_users_id_fk"
   FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
 ALTER TABLE "direct_messages"
   ADD CONSTRAINT "direct_messages_to_user_id_users_id_fk"
   FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;
