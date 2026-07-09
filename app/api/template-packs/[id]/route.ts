export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { templatePacksTable } from "@/db/schema/template-packs-schema";
import { eq, and } from "drizzle-orm";

function isMissingTemplatePacksTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "42P01";
}

/**
 * GET: Fetch a single template pack by id (full data including slides_json and captions_json).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing pack id" }, { status: 400 });
    }

    const [row] = await db
      .select()
      .from(templatePacksTable)
      .where(
        and(
          eq(templatePacksTable.id, id),
          eq(templatePacksTable.userId, userId)
        )
      );

    if (!row) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      packName: row.packName,
      templateType: row.templateType,
      niche: row.niche ?? undefined,
      brandColourPrimary: row.brandColourPrimary ?? undefined,
      brandColourSecondary: row.brandColourSecondary ?? undefined,
      fontStyle: row.fontStyle ?? undefined,
      slidesJson: row.slidesJson ?? [],
      captionsJson: row.captionsJson ?? [],
      status: row.status,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    if (isMissingTemplatePacksTable(e)) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }
    console.error("[template-packs] GET [id] error:", e);
    return NextResponse.json(
      { error: "Failed to load pack" },
      { status: 500 }
    );
  }
}
