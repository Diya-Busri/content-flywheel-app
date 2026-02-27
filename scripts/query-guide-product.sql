-- Run this in Supabase SQL Editor to see what product name is stored for the video guide.
-- Table names: "scripts" (not library_scripts), "products". Column: product_id on scripts.

SELECT
  s.id AS guide_id,
  s.title AS guide_title,
  s.product_id,
  p.id AS product_id,
  p.title AS product_title,
  p.marketing_assets->>'productTitle' AS marketing_product_title
FROM scripts s
LEFT JOIN products p ON p.id = s.product_id AND p.deleted_at IS NULL
WHERE s.id = 'b778c2c3-a8b7-41bf-9f9c-ae687ed86c53';

-- To also see productName inside the guide's JSON content:
SELECT
  s.id,
  s.title,
  s.product_id,
  s.content::jsonb->>'productName' AS content_product_name
FROM scripts s
WHERE s.id = 'b778c2c3-a8b7-41bf-9f9c-ae687ed86c53';
