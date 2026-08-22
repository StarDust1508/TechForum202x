CREATE TABLE IF NOT EXISTS "app_content" (
  "id" text PRIMARY KEY NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "app_content" ("id", "payload") VALUES (
  'conference_2026',
  '{"name":"ТехнологИИ Права 2026","tagline":"Два практических дня о том, как ИИ меняет юридическую работу и бизнес.","description":"Первый день — AI, агентные системы, продукты, данные и регулирование. Второй — БФЛ, цифровые доказательства, LegalTech, управление практикой и проверяемые сценарии применения ИИ.","dateLabel":"25–26 сентября 2026","dateDetail":"Пятница и суббота","city":"Москва","venueName":"БЦ «Красные Ворота»","address":"Садовая-Спасская улица, 21/1, Москва","dayOneTitle":"День 1 · AI и агенты","dayOneDescription":"Агенты, продукты, данные, внедрение и регулирование","dayTwoTitle":"День 2 · БФЛ и ИИ","dayTwoDescription":"Суды, доказательства, сделки, LegalTech и рост практики","email":"info@tech-pravo.ru","organizerTelegram":"CEO_WYRM1","telegramChannel":"TechPravoAI","yandexMapUrl":"https://yandex.ru/maps/?text=%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F-%D0%A1%D0%BF%D0%B0%D1%81%D1%81%D0%BA%D0%B0%D1%8F%2021%2F1","twoGisUrl":"https://2gis.ru/moscow/search/%D0%A1%D0%B0%D0%B4%D0%BE%D0%B2%D0%B0%D1%8F-%D0%A1%D0%BF%D0%B0%D1%81%D1%81%D0%BA%D0%B0%D1%8F%2C%2021%2F1","venueHelp":"Точная схема этажей появится после подтверждения площадкой."}'::jsonb
) ON CONFLICT ("id") DO NOTHING;
