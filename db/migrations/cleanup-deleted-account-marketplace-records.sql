-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: cleanup-deleted-account-marketplace-records
-- Purpose:   Remove all public-facing marketplace records that reference
--            accounts with a non-null deleted_at timestamp in the profiles
--            table.  Runs safely on a live DB (no locks held across rows).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Remove featured_products entries whose seller account is deleted
DELETE FROM featured_products
WHERE user_id IN (
  SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
);

-- 2. Remove featured_products entries whose product belongs to a deleted seller
--    (catches cases where user_id on the product differs from featured row)
--    Cast products.id (uuid) to text to match featured_products.product_id (text)
DELETE FROM featured_products fp
WHERE fp.product_id IN (
  SELECT p.id::text
  FROM products p
  JOIN profiles pr ON pr.user_id = p.user_id
  WHERE pr.deleted_at IS NOT NULL
);

-- 3. Remove wishlist saves for products whose creator is deleted
--    Cast products.id (uuid) to text to match product_wishlists.product_id (text)
DELETE FROM product_wishlists
WHERE product_id IN (
  SELECT p.id::text
  FROM products p
  JOIN profiles pr ON pr.user_id = p.user_id
  WHERE pr.deleted_at IS NOT NULL
);

-- 4. Remove follow relationships where the followed creator is deleted
DELETE FROM creator_follows
WHERE followed_id IN (
  SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
);

-- 5. Remove follow relationships where the follower is a deleted account
DELETE FROM creator_follows
WHERE follower_id IN (
  SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
);

-- 6. Remove leaderboard / creator score rows for deleted accounts
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creator_scores') THEN
    DELETE FROM creator_scores WHERE user_id IN (SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL);
  END IF;
END $$;

-- 7. Remove trust score rows for deleted accounts
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creator_trust_scores') THEN
    DELETE FROM creator_trust_scores WHERE user_id IN (SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL);
  END IF;
END $$;

-- 8. Remove trust score history for deleted accounts
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creator_trust_score_history') THEN
    DELETE FROM creator_trust_score_history WHERE user_id IN (SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL);
  END IF;
END $$;

-- 9. Remove reputation events for deleted accounts
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'creator_reputation_events') THEN
    DELETE FROM creator_reputation_events WHERE user_id IN (SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL);
  END IF;
END $$;

-- 10. Remove affiliate links created by deleted sellers
DELETE FROM affiliate_links
WHERE creator_user_id IN (
  SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
);

-- 11. Mark products belonging to deleted accounts as soft-deleted
--     (sets deleted_at to now if not already set, so they vanish from all queries)
UPDATE products
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND user_id IN (
    SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
  );

-- 12. Deactivate any product bundles from deleted sellers
UPDATE product_bundles
SET active = FALSE
WHERE creator_user_id IN (
  SELECT user_id FROM profiles WHERE deleted_at IS NOT NULL
);
