export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";

type CreatorAction =
  | "suspend"        // set profile status = "suspended"
  | "activate"       // set profile status = "active"
  | "hide"           // hiddenFromMarketplace = true (products hidden, account intact)
  | "unhide"         // hiddenFromMarketplace = false
  | "delete"         // soft-delete: deletedAt = now
  | "restore"        // clear deletedAt, hiddenFromMarketplace=false, status=active
  | "delete-products"; // soft-delete all creator products (called alongside delete)

/**
 * GET /api/admin/creators/[userId]
 * Returns full creator profile for admin view.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  return NextResponse.json({ creator: profile });
}

/**
 * PATCH /api/admin/creators/[userId]
 * Body: { action: CreatorAction, deleteProducts?: boolean }
 *
 * All actions are admin-only and server-side verified.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  const [profile] = await db
    .select({ userId: profilesTable.userId, status: profilesTable.status })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({})) as {
    action?: CreatorAction;
    deleteProducts?: boolean; // when deleting a creator, also remove their products
  };

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const now = new Date();

  switch (action) {

    case "suspend": {
      await db.update(profilesTable).set({
        status: "suspended",
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));
      return NextResponse.json({ ok: true, action, status: "suspended" });
    }

    case "activate": {
      await db.update(profilesTable).set({
        status: "active",
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));
      return NextResponse.json({ ok: true, action, status: "active" });
    }

    case "hide": {
      await db.update(profilesTable).set({
        hiddenFromMarketplace: true,
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));
      return NextResponse.json({ ok: true, action, hiddenFromMarketplace: true });
    }

    case "unhide": {
      await db.update(profilesTable).set({
        hiddenFromMarketplace: false,
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));
      return NextResponse.json({ ok: true, action, hiddenFromMarketplace: false });
    }

    case "delete": {
      // Soft-delete the creator account
      await db.update(profilesTable).set({
        deletedAt: now,
        status: "deleted",
        hiddenFromMarketplace: true,
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));

      // If requested, also soft-delete all their products
      if (body.deleteProducts) {
        const creatorProducts = await db
          .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
          .from(productsTable)
          .where(eq(productsTable.userId, userId));

        for (const p of creatorProducts) {
          const ma = (p.marketingAssets ?? {}) as MarketingAssets;
          const updatedMa: MarketingAssets = { ...ma, isNativePublished: false };
          await db.update(productsTable).set({
            removedAt: now,
            marketingAssets: updatedMa,
            updatedAt: now,
          }).where(eq(productsTable.id, p.id));
        }
      }

      return NextResponse.json({ ok: true, action, deletedAt: now.toISOString() });
    }

    case "restore": {
      await db.update(profilesTable).set({
        deletedAt: null,
        status: "active",
        hiddenFromMarketplace: false,
        updatedAt: now,
      }).where(eq(profilesTable.userId, userId));
      return NextResponse.json({ ok: true, action, restored: true });
    }

    default: {
      return NextResponse.json({ error: `Unknown action: ${action as string}` }, { status: 400 });
    }
  }
}
