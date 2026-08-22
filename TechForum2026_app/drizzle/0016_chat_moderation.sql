CREATE TABLE IF NOT EXISTS "user_blocks" (
  "blocker_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "blocked_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
  CONSTRAINT "user_blocks_not_self" CHECK ("blocker_id" <> "blocked_id")
);
CREATE TABLE IF NOT EXISTS "content_reports" (
  "id" text PRIMARY KEY NOT NULL,
  "reporter_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reported_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message_id" text,
  "reason" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
