export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";
import { db } from "@/db/db";
import { challengeSubmissionsTable } from "@/db/schema/challenge-submissions-schema";
import { eq } from "drizzle-orm";
import { getSignedDownloadUrl } from "@/lib/storage";

/**
 * GET /api/admin/challenge-submissions/[id]/files
 * Admin-only. Generates short-lived (5 min) signed download URLs for the
 * submission's privately-stored uploads. Never returns a public URL, and
 * these URLs are not persisted anywhere — regenerated fresh on each request.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const [row] = await db
    .select({ uploadedFiles: challengeSubmissionsTable.uploadedFiles })
    .from(challengeSubmissionsTable)
    .where(eq(challengeSubmissionsTable.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await Promise.all(
    (row.uploadedFiles ?? []).map(async (f) => ({
      ...f,
      signedUrl: await getSignedDownloadUrl(f.key, 300).catch(() => null),
    }))
  );

  return NextResponse.json({ files });
}
