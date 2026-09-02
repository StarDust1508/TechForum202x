-- READ-ONLY preflight for a staging copy or an explicitly read-only production session.
-- It never creates, updates or deletes data. Run before considering migrations 0018/0019.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_user,
       pg_is_in_recovery() AS is_replica,
       now() AS inspected_at;

SELECT expected_table,
       to_regclass('public.' || expected_table) AS actual_relation
FROM (VALUES
  ('users'),
  ('contact_pins'),
  ('telegram_link_tokens'),
  ('app_content'),
  ('events'),
  ('faq')
) AS expected(expected_table)
ORDER BY expected_table;

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('contact_pins', 'telegram_link_tokens', 'app_content', 'events', 'faq')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass::text AS table_name,
       conname,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  to_regclass('public.contact_pins'),
  to_regclass('public.telegram_link_tokens')
)
ORDER BY table_name, conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('contact_pins', 'telegram_link_tokens')
ORDER BY tablename, indexname;

-- Dynamic read-only checks keep the preflight usable even when a relation is
-- absent. Results are emitted as NOTICE lines and must be saved with the run.
DO $preflight$
DECLARE
  row_data record;
BEGIN
  IF to_regclass('public.app_content') IS NULL THEN
    RAISE NOTICE 'app_content: MISSING';
  ELSE
    FOR row_data IN EXECUTE
      $sql$SELECT id, payload->>'email' AS email, updated_at
           FROM app_content WHERE id = 'conference_2026'$sql$
    LOOP
      RAISE NOTICE 'app_content: id=%, email=%, updated_at=%',
        row_data.id, row_data.email, row_data.updated_at;
    END LOOP;
  END IF;

  IF to_regclass('public.events') IS NULL THEN
    RAISE NOTICE 'events: MISSING';
  ELSE
    FOR row_data IN EXECUTE
      $sql$SELECT slug, organizer_email FROM events WHERE slug = 'techforum-2026'$sql$
    LOOP
      RAISE NOTICE 'events: slug=%, organizer_email=%',
        row_data.slug, row_data.organizer_email;
    END LOOP;
  END IF;

  IF to_regclass('public.faq') IS NULL THEN
    RAISE NOTICE 'faq: MISSING';
  ELSE
    FOR row_data IN EXECUTE
      $sql$SELECT count(*) AS stale_rows FROM faq
           WHERE answer LIKE '%info@tech-pravo.ru%'$sql$
    LOOP
      RAISE NOTICE 'faq: stale_email_rows=%', row_data.stale_rows;
    END LOOP;
  END IF;
END
$preflight$;

ROLLBACK;
