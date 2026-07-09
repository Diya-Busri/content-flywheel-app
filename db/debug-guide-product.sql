-- Run this in Supabase SQL Editor to see what product name is stored for the video guide.
-- Tables are "scripts" and "products" (not library_scripts). Column is product_id.

SELECT
  s.id AS guide_id,
  s.title AS guide_title,
  s.product_id,
  p.id AS product_id_uuid,
  p.title AS product_title
FROM scripts s
LEFT JOIN products p ON p.id = s.product_id
WHERE s.id = 'b778c2c3-a8b7-41bf-9f9c-ae687ed86c53';

-- To also see product name inside the guide's JSON content (if needed):
-- SELECT id, title, product_id, content::jsonb->>'productName' AS content_product_name
-- FROM scripts
-- WHERE id = 'b778c2c3-a8b7-41bf-9f9c-ae687ed86c53';
