-- Save the blueprint (product type) image URL so the product detail page can show a 3D composite preview
ALTER TABLE "pod_products" ADD COLUMN IF NOT EXISTS "blueprint_image_url" text;
