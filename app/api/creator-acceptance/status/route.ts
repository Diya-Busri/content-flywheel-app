/**
 * GET /api/creator-acceptance/status?email=...
 * Returns the application status for a given email (public — no auth needed).
 * Used on the /apply page to let applicants check their status.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { creatorApplicationsTable } from "@/db/schema/creator-applications-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) return NextResponse.json({ found: false });

  try {
    const [row] = await db
      .select({
        id: creatorApplicationsTable.id,
        status: creatorApplicationsTable.status,
        name: creatorApplicationsTable.name,
      })
      .from(creatorApplicationsTable)
      .where(eq(creatorApplicationsTable.email, email))
      .limit(1);

    if (!row) return NextResponse.json({ found: false });
    return NextResponse.json({ found: true, status: row.status, name: row.name });
  } catch (err) {
    console.error("[creator-acceptance/status]", err);
    return NextResponse.json({ found: false });
  }
}
