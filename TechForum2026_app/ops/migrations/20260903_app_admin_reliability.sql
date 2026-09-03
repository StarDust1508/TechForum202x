-- Additive only. Run in an explicit transaction after a verified backup.
-- Existing content, programme publication history and speaker links are preserved.
ALTER TABLE app_content ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS app_content_revisions (
  id bigserial PRIMARY KEY,
  content_id text NOT NULL REFERENCES app_content(id),
  version integer NOT NULL,
  before_payload jsonb NOT NULL,
  after_payload jsonb NOT NULL,
  changed_keys text[] NOT NULL,
  actor text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, version)
);
CREATE OR REPLACE FUNCTION protect_app_content_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'app_content_history_is_append_only'; END $$;
DROP TRIGGER IF EXISTS app_content_history_immutable ON app_content_revisions;
CREATE TRIGGER app_content_history_immutable BEFORE UPDATE OR DELETE ON app_content_revisions
  FOR EACH ROW EXECUTE FUNCTION protect_app_content_revision();
CREATE TABLE IF NOT EXISTS session_moderators (
  session_id text NOT NULL REFERENCES sessions_event(id) ON DELETE CASCADE,
  speaker_id text NOT NULL REFERENCES speakers(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id, speaker_id)
);
CREATE TABLE IF NOT EXISTS speaker_source_links (
  source_id text PRIMARY KEY,
  speaker_id text NOT NULL UNIQUE REFERENCES speakers(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now()
);
