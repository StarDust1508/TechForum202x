-- Public conference contacts use the current ticket/support mailbox.
-- Historical migration files remain immutable; this migration corrects
-- already-created production rows as well as a clean sequential install.

UPDATE "app_content"
SET "payload" = COALESCE("payload", '{}'::jsonb) || jsonb_build_object(
  'email', 'tickets@notify.tech-pravo.ru',
  'researchIntro', 'Ответы используются в агрегированной аналитике. После короткой регистрации профессиональный материал открывается сразу; прохождение сохраняется и продолжается с того же места.',
  'researchConditions', 'Материал доступен после регистрации на выбранном лендинге. Условия сертификатов и проверяемого розыгрыша опубликованы там же; приложение не подменяет их отдельным описанием.',
  'researchLawyerTitle', 'ИИ в работе юристов',
  'researchLawyerDescription', '12 практических вопросов о сценариях применения ИИ, барьерах, инструментах и защите данных.',
  'researchLawyerMaterial', 'Профессиональный PDF: мировые практики, российский рынок и прикладные инструменты 2026.',
  'researchLawyerUrl', 'https://tech-pravo.ru/opros2',
  'researchManagerTitle', 'Практика и защита управляющего',
  'researchManagerDescription', 'Исследование рабочих процессов, рисков, судебных позиций и направлений автоматизации.',
  'researchManagerMaterial', 'Практический PDF: защита арбитражного управляющего, судебные позиции и рабочие ориентиры.',
  'researchManagerUrl', 'https://tech-pravo.ru/opros'
)
WHERE "id" = 'conference_2026';

UPDATE "events"
SET "organizer_email" = 'tickets@notify.tech-pravo.ru'
WHERE "slug" = 'techforum-2026';

UPDATE "faq"
SET "answer" = replace("answer", 'info@tech-pravo.ru', 'tickets@notify.tech-pravo.ru')
WHERE "answer" LIKE '%info@tech-pravo.ru%';
