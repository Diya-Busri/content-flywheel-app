export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable, videosTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";

/**
 * DELETE: Permanently delete all library items (products, videos, scripts) for the current user.
 */
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await Promise.all([
      db.delete(productsTable).where(eq(productsTable.userId, userId)),
      db.delete(videosTable).where(eq(videosTable.userId, userId)),
      db.delete(scriptsTable).where(eq(scriptsTable.userId, userId)),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Library delete-all failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete library" },
      { status: 500 }
    );
  }
}
