export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { featuredProductsTable } from "@/db/schema/featured-products-schema";
import { eq, and } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

type ModerationAction =
  | "hide"          // hide from marketplace, creator draft preserved
  | "suspend"       // suspend: stronger signal than hide (rule violation)
  | "restore"       // restore hidden/suspended/removed/archived product
  | "archive"       // archive (unpublish without deleting)
  | "remove"        // admin soft-delete (disappears from marketplace; only admin can see/restore)
  | "unpublish"     // admin un-publishes from native store (creator can re-publish)
  | "duplicate"     // clone product into creator's library (admin convenience)
  | "feature"       // feature on homepage (pinnedHomepage = true)
  | "unfeature"     // remove from featured homepage
  | "staff-pick"    // mark as Staff Pick
  | "unstaff-pick"  // remove Staff Pick badge
  | "pin"           // pin to homepage
  | "unpin"         // unpin from homepage
  | "edit-metadata" // update title, niche, description, priceLabel, adminNotes
  | "add-note";     // update internal admin notes only

/**
 * GET /api/admin/marketplace/[id]
 * Returns full product details (admin view — bypasses ownership check).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json({ product });
}

/**
 * PATCH /api/admin/marketplace/[id]
 * Body: { action: ModerationAction, ...actionPayload }
 *
 * All actions are admin-only and server-side verified.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify product exists
  const [product] = await db
    .select({
      id:              productsTable.id,
      marketingAssets: productsTable.marketingAssets,
      userId:          productsTable.userId,
      niche:           productsTable.niche,
    })
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .limit(1);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as {
    action?: ModerationAction;
    title?: string;
    niche?: string;
    description?: string;
    priceLabel?: string;
    adminNotes?: string;
    reason?: string;
  };

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const now = new Date();

  // ── Handle each moderation action ────────────────────────────────────────
  switch (action) {

    case "hide": {
      await db.update(productsTable).set({
        moderationStatus: "hidden",
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, moderationStatus: "hidden" });
    }

    case "suspend": {
      // Suspend unpublishes from native store too
      const updatedMa: MarketingAssets = { ...ma, isNativePublished: false };
      await db.update(productsTable).set({
        moderationStatus: "suspended",
        marketingAssets: updatedMa,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, moderationStatus: "suspended" });
    }

    case "restore": {
      // Clear all admin-applied restrictions
      await db.update(productsTable).set({
        moderationStatus: null,
        removedAt: null,
        archivedAt: null,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, restored: true });
    }

    case "archive": {
      // Archive: same as creator archive but admin-initiated
      const updatedMa: MarketingAssets = { ...ma, isNativePublished: false };
      await db.update(productsTable).set({
        archivedAt: now,
        marketingAssets: updatedMa,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, archivedAt: now.toISOString() });
    }

    case "remove": {
      // Admin soft-delete: product disappears from marketplace and creator library
      // Not in removedAt = only admins can see it
      const updatedMa: MarketingAssets = { ...ma, isNativePublished: false };
      await db.update(productsTable).set({
        removedAt: now,
        moderationStatus: null,
        marketingAssets: updatedMa,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, removedAt: now.toISOString() });
    }

    case "feature":
    case "pin": {
      await db.update(productsTable).set({
        pinnedHomepage: true,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      // Also upsert into featuredProductsTable for compatibility
      const existingFeatured = await db
        .select({ id: featuredProductsTable.id })
        .from(featuredProductsTable)
        .where(eq(featuredProductsTable.productId, id))
        .limit(1);
      if (existingFeatured.length === 0) {
        await db.insert(featuredProductsTable).values({
          productId: id,
          userId: product.userId,
          niche: product.niche,
          active: true,
        });
      } else {
        await db.update(featuredProductsTable)
          .set({ active: true, updatedAt: now })
          .where(eq(featuredProductsTable.productId, id));
      }
      return NextResponse.json({ ok: true, action, pinnedHomepage: true });
    }

    case "unfeature":
    case "unpin": {
      await db.update(productsTable).set({
        pinnedHomepage: false,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      await db.update(featuredProductsTable)
        .set({ active: false, updatedAt: now })
        .where(eq(featuredProductsTable.productId, id));
      return NextResponse.json({ ok: true, action, pinnedHomepage: false });
    }

    case "staff-pick": {
      await db.update(productsTable).set({
        staffPick: true,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, staffPick: true });
    }

    case "unstaff-pick": {
      await db.update(productsTable).set({
        staffPick: false,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, staffPick: false });
    }

    case "edit-metadata": {
      // Build marketingAssets update if price/description changed
      let updatedMa: MarketingAssets | undefined;
      if (typeof body.priceLabel === "string" || typeof body.description === "string") {
        updatedMa = { ...ma };
        if (typeof body.priceLabel === "string") updatedMa.priceLabel = body.priceLabel;
        if (typeof body.description === "string") updatedMa.productDescription = body.description;
      }
      await db.update(productsTable).set({
        ...(typeof body.title === "string" && body.title.trim() && { title: body.title.trim() }),
        ...(typeof body.niche === "string" && body.niche.trim() && { niche: body.niche.trim() }),
        ...(typeof body.adminNotes === "string" && { adminNotes: body.adminNotes }),
        ...(updatedMa !== undefined && { marketingAssets: updatedMa }),
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action });
    }

    case "add-note": {
      await db.update(productsTable).set({
        adminNotes: typeof body.adminNotes === "string" ? body.adminNotes : null,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action });
    }

    case "unpublish": {
      // Admin un-publishes from native store; creator can re-publish from their library
      const updatedMa: MarketingAssets = { ...ma, isNativePublished: false };
      await db.update(productsTable).set({
        marketingAssets: updatedMa,
        updatedAt: now,
      }).where(eq(productsTable.id, id));
      return NextResponse.json({ ok: true, action, isNativePublished: false });
    }

    case "duplicate": {
      // Clone the product into the same creator's library
      const [original] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, id))
        .limit(1);
      if (!original) return NextResponse.json({ error: "Product not found" }, { status: 404 });

      const clonedMa: MarketingAssets = { ...(original.marketingAssets as MarketingAssets), isNativePublished: false };
      const newId = crypto.randomUUID();
      await db.insert(productsTable).values({
        id:              newId,
        title:           `Copy of ${original.title}`,
        niche:           original.niche,
        format:          original.format,
        userId:          original.userId,
        marketingAssets: clonedMa,
        status:          original.status,
        // Admin fields reset to clean slate
        moderationStatus: null,
        removedAt:        null,
        archivedAt:       null,
        staffPick:        false,
        pinnedHomepage:   false,
        adminNotes:       null,
      });
      return NextResponse.json({ ok: true, action, newProductId: newId });
    }

    default: {
      return NextResponse.json({ error: `Unknown action: ${action as string}` }, { status: 400 });
    }
  }
}
