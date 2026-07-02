export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bundleJobsTable } from "@/db/schema/bundle-jobs-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

export async function GET(_req: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bundleId } = await params;
  if (!bundleId) return NextResponse.json({ error: "bundleId required" }, { status: 400 });

  const [job] = await db
    .select()
    .from(bundleJobsTable)
    .where(and(eq(bundleJobsTable.id, bundleId), eq(bundleJobsTable.userId, userId)))
    .limit(1);

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const products = await db
    .select({
      id: productsTable.id,
      format: productsTable.format,
      title: productsTable.title,
      status: productsTable.status,
      generationError: productsTable.generationError,
    })
    .from(productsTable)
    .where(eq(productsTable.bundleId, bundleId));

  // Derive live counts from product statuses
  const completedCount = products.filter((p) => p.status === "draft").length;
  const failedCount = products.filter((p) => p.status === "failed").length;
  const generatingCount = products.filter((p) => p.status === "generating").length;

  return NextResponse.json({
    job: {
      ...job,
      completedCount,
      failedCount,
      generatingCount,
    },
    products,
  });
}
