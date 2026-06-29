CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_type" text NOT NULL DEFAULT 'direct',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "last_message_at" timestamp DEFAULT now(),
  "last_message_preview" text
);

CREATE TABLE IF NOT EXISTS "conversation_participants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "user_email" text,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  "last_read_at" timestamp
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "sender_id" text NOT NULL,
  "sender_email" text,
  "content" text NOT NULL,
  "is_admin_message" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");
CREATE INDEX IF NOT EXISTS "conversation_participants_conversation_id_idx" ON "conversation_participants"("conversation_id");

CREATE TABLE IF NOT EXISTS "community_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reported_by_user_id" text NOT NULL,
  "post_id" uuid,
  "comment_id" uuid,
  "reported_user_id" text,
  "reason" text NOT NULL,
  "details" text,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_by_admin" boolean NOT NULL DEFAULT false,
  "reviewed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
