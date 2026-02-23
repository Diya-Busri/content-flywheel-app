-- Add cover_background_preference for Regenerate Design / Auto-Design (match product vs random).
-- Run in Supabase SQL Editor if Regenerate Design fails with: column "cover_background_preference" does not exist
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS cover_background_preference text DEFAULT 'match_product';
