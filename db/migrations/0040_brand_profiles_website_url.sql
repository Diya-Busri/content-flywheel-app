-- Add website/store URL to brand profiles.
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS website_url text;
