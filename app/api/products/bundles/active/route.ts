export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bundleJobsTable } from "@/db/schema/bundle-jobs-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, desc, inArray } from "drizzle-orm";

/**
 * GET /api/products/bundles/active
 * Returns all bundle jobs that are still generating (for the progress banner).
 * Also returns recently completed bundles (last 24h) so the banner can show a "ready" state.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch generating + recently completed bundle jobs
  const jobs = await db
    .select()
    .from(bundleJobsTable)
    .where(
      and(
        eq(bundleJobsTable.userId, userId),
        inArray(bundleJobsTable.status, ["generating", "completed", "partial", "failed"])
      )
    )
    .orderBy(desc(bundleJobsTable.createdAt))
    .limit(10);

  if (jobs.length === 0) return NextResponse.json({ jobs: [] });

  // Fetch per-product statuses for all active jobs in one query
  const bundleIds = jobs.map((j) => j.id);
  const products = await db
    .select({
      id: productsTable.id,
      bundleId: productsTable.bundleId,
      format: productsTable.format,
      title: productsTable.title,
      status: productsTable.status,
    })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.userId, userId),
        inArray(productsTable.bundleId as Parameters<typeof inArray>[0], bundleIds)
      )
    );

  // Group products by bundleId and enrich jobs
  const productsByBundle = products.reduce<Record<string, typeof products>>((acc, p) => {
    const bid = p.bundleId ?? "";
    if (bid) (acc[bid] = acc[bid] ?? []).push(p);
    return acc;
  }, {});

  const enriched = jobs.map((job) => {
    const prods = productsByBundle[job.id] ?? [];
    return {
      ...job,
      completedCount: prods.filter((p) => p.status === "draft").length,
      failedCount: prods.filter((p) => p.status === "failed").length,
      generatingCount: prods.filter((p) => p.status === "generating").length,
      products: prods,
    };
  });

  return NextResponse.json({ jobs: enriched });
}
