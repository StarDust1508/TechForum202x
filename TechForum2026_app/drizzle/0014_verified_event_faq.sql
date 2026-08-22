-- Only verified attendee information. Unknown venue details (parking, Wi-Fi,
-- cloakroom, exact entrance and floor plan) must not be guessed.
UPDATE "faq" SET "is_active" = false;

INSERT INTO "faq" ("id", "category", "question", "answer", "is_active", "sort_order") VALUES
  ('faq_venue_2026', 'Площадка', 'Где проходит конференция?', '25–26 сентября 2026 года в Москве, БЦ «Красные Ворота»: Садовая-Спасская улица, 21/1. Маршрут доступен в разделе «Как добраться».', true, 10),
  ('faq_ticket_email_2026', 'Билет', 'Почему в приложении не появился билет?', 'QR-билет привязан к email, который был указан при покупке. Войдите именно с этим адресом. Если адрес отличается или билет не появился, напишите на info@tech-pravo.ru.', true, 20),
  ('faq_download_2026', 'Билет', 'Кто может скачать приложение?', 'Скачать приложение и зарегистрироваться может каждый. Наличие аккаунта не создаёт билет автоматически: билет доступен только покупателю после входа по email покупки.', true, 30),
  ('faq_program_2026', 'Программа', 'Где смотреть актуальную программу?', 'В разделе «Программа» приложения и на странице tech-pravo.ru/conference. Состав и время сессий могут уточняться; в приложении показывается актуальная опубликованная версия.', true, 40),
  ('faq_hall_2026', 'Площадка', 'Как узнать зал конкретной сессии?', 'Откройте карточку события в программе: подтверждённый зал указан рядом со временем. Неподтверждённую схему этажей приложение не показывает.', true, 50),
  ('faq_giveaway_2026', 'Розыгрыш', 'Как участвовать в розыгрыше MacBook?', 'Откройте раздел «Розыгрыши» и перейдите к исследованию «ИИ для юристов». Условия участия и результаты публикуются на странице исследования и в Telegram-канале @TechPravoAI.', true, 60),
  ('faq_contacts_2026', 'Поддержка', 'Как связаться с организаторами?', 'Email: info@tech-pravo.ru. Лично в Telegram: @CEO_WYRM1. Новости конференции: @TechPravoAI.', true, 70)
ON CONFLICT ("id") DO UPDATE SET
  "category" = EXCLUDED."category",
  "question" = EXCLUDED."question",
  "answer" = EXCLUDED."answer",
  "is_active" = EXCLUDED."is_active",
  "sort_order" = EXCLUDED."sort_order";
