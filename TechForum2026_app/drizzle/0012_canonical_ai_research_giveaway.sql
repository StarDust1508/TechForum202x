-- Единственный канонический розыгрыш 2026: исследование применения ИИ юристами.
-- Убираем демонстрационные призы и их заявки, затем создаём реальный приз.
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT '';
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone;
ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "winner_id" text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='giveaway_entries' AND column_name='joined_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='giveaway_entries' AND column_name='created_at') THEN
    ALTER TABLE "giveaway_entries" RENAME COLUMN "joined_at" TO "created_at";
  END IF;
END $$;

UPDATE "giveaways" SET "is_active" = false;

INSERT INTO "giveaways" (
  "id", "title", "category", "item", "icon_key", "gradient",
  "description", "condition", "end_time", "featured", "is_active", "sort_order"
) VALUES (
  'ai-lawyers-2026-macbook-air',
  'Главный приз исследования применения ИИ юристами',
  'research',
  'MacBook Air 13 M4',
  'laptop',
  'from-[#ff3399]/30 via-[#00ffff]/12 to-transparent',
  'Главный приз отраслевого исследования о применении ИИ юристами и юридическими командами.',
  'Ответить на все 12 вопросов исследования и подтвердить email. Тестовые и исключённые записи не участвуют.',
  'Итоги · 25 сентября 2026',
  true,
  true,
  0
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "category" = EXCLUDED."category",
  "item" = EXCLUDED."item",
  "icon_key" = EXCLUDED."icon_key",
  "gradient" = EXCLUDED."gradient",
  "description" = EXCLUDED."description",
  "condition" = EXCLUDED."condition",
  "end_time" = EXCLUDED."end_time",
  "featured" = true,
  "is_active" = true,
  "sort_order" = 0;
