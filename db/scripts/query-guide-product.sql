-- Run this in Supabase SQL Editor to see what product name is stored for a video guide.
-- Table names: "scripts" (not library_scripts), "products". Column: product_id.

SELECT
  s.id AS guide_id,
  s.title AS guide_title,
  s.product_id,
  s.content::jsonb->>'productName' AS content_product_name,
  p.id AS product_id_resolved,
  p.title AS product_title,
  p.marketing_assets::jsonb->>'productTitle' AS product_marketing_title
FROM scripts s
LEFT JOIN products p ON p.id = s.product_id AND p.deleted_at IS NULL
WHERE s.id = 'b778c2c3-a8b7-41bf-9f9c-ae687ed86c53';
