export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { challengeSubmissionsTable } from "@/db/schema/challenge-submissions-schema";
import { desc, asc, eq, ilike, or, and, sql } from "drizzle-orm";

/**
 * GET /api/admin/challenge-submissions
 * Admin-only: list 100 Product Challenge submissions.
 *
 * Query params:
 *   q            – search reference / full name / email / product name
 *   featureType  – all | public | anonymous
 *   status       – all | <one of the 14 workflow statuses>
 *   sort         – newest (default) | oldest
 *   page, pageSize
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const featureType = sp.get("featureType") ?? "all";
  const status = sp.get("status") ?? "all";
  const sort = sp.get("sort") ?? "newest";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") ?? "30") || 30));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (featureType === "public" || featureType === "anonymous") {
    conditions.push(eq(challengeSubmissionsTable.featureType, featureType));
  }
  if (status !== "all") {
    conditions.push(eq(challengeSubmissionsTable.status, status as never));
  }
  if (q) {
    conditions.push(
      or(
        ilike(challengeSubmissionsTable.reference, `%${q}%`),
        ilike(challengeSubmissionsTable.fullName, `%${q}%`),
        ilike(challengeSubmissionsTable.email, `%${q}%`),
        ilike(challengeSubmissionsTable.productName, `%${q}%`)
      )
    );
  }

  const orderClause = sort === "oldest" ? asc(challengeSubmissionsTable.createdAt) : desc(challengeSubmissionsTable.createdAt);

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select({
        id: challengeSubmissionsTable.id,
        reference: challengeSubmissionsTable.reference,
        fullName: challengeSubmissionsTable.fullName,
        email: challengeSubmissionsTable.email,
        productName: challengeSubmissionsTable.productName,
        productType: challengeSubmissionsTable.productType,
        featureType: challengeSubmissionsTable.featureType,
        status: challengeSubmissionsTable.status,
        storeUrl: challengeSubmissionsTable.storeUrl,
        storeLinkVerified: challengeSubmissionsTable.storeLinkVerified,
        episodeNumber: challengeSubmissionsTable.episodeNumber,
        createdAt: challengeSubmissionsTable.createdAt,
        updatedAt: challengeSubmissionsTable.updatedAt,
      })
      .from(challengeSubmissionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderClause)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(challengeSubmissionsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  return NextResponse.json({
    submissions: rows,
    total: totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
}
