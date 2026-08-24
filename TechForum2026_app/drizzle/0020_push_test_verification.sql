-- Проверка push считается завершённой только после нажатия пользователем
-- системного уведомления. Значение хранится в аккаунте и переживает
-- переустановку приложения или вход с другого устройства.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "push_test_verified_at" timestamp with time zone;
