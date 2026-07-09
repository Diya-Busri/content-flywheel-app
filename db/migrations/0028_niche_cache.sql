-- Cache for niche suggestions (trending) to reduce OpenAI calls
CREATE TABLE IF NOT EXISTS "niche_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cache_key" text NOT NULL DEFAULT 'trending',
  "niches" jsonb NOT NULL,
  "refreshed_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "niche_cache_key_refreshed_idx" ON "niche_cache" ("cache_key", "refreshed_at" DESC);

COMMENT ON TABLE "niche_cache" IS 'Cached niche suggestions; refresh periodically to avoid calling OpenAI on every visit';
