-- Chat messages for support chatbot (user_id nullable for anonymous visitors)
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "message" text NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('user', 'assistant')),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chat_messages_user_id_created_at" ON "chat_messages" ("user_id", "created_at");
