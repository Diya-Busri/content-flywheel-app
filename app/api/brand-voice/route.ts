export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";

/**
 * GET: Return the current user's brand voice settings or 404.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId));

    if (!row) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      brandName: row.brandName ?? undefined,
      tone: row.tone ?? undefined,
      targetAudience: row.targetAudience ?? undefined,
      writingStyle: row.writingStyle ?? undefined,
      examplePhrases: row.examplePhrases ?? undefined,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error("[brand-voice] GET error:", e);
    return NextResponse.json(
      { error: "Failed to load brand voice" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or upsert brand voice. Body: brandName, tone, targetAudience, writingStyle, examplePhrases.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const brandName = (body.brandName as string)?.trim() || null;
    const tone = (body.tone as string)?.trim() || null;
    const targetAudience = (body.targetAudience as string)?.trim() || null;
    const writingStyle = (body.writingStyle as string)?.trim() || null;
    const examplePhrases = (body.examplePhrases as string)?.trim() || null;
    const platformFocus = (body.platformFocus as string)?.trim() || null;
    const postingFrequency = (body.postingFrequency as string)?.trim() || null;
    const audienceSize = (body.audienceSize as string)?.trim() || null;

    await db
      .insert(brandVoiceTable)
      .values({
        userId,
        brandName,
        tone,
        targetAudience,
        writingStyle,
        examplePhrases,
        platformFocus,
        postingFrequency,
        audienceSize,
      })
      .onConflictDoUpdate({
        target: brandVoiceTable.userId,
        set: {
          brandName,
          tone,
          targetAudience,
          writingStyle,
          examplePhrases,
          ...(platformFocus !== null ? { platformFocus } : {}),
          ...(postingFrequency !== null ? { postingFrequency } : {}),
          ...(audienceSize !== null ? { audienceSize } : {}),
          updatedAt: new Date(),
        },
      });

    const [row] = await db
      .select()
      .from(brandVoiceTable)
      .where(eq(brandVoiceTable.userId, userId));

    return NextResponse.json({
      id: row?.id,
      brandName: row?.brandName ?? undefined,
      tone: row?.tone ?? undefined,
      targetAudience: row?.targetAudience ?? undefined,
      writingStyle: row?.writingStyle ?? undefined,
      examplePhrases: row?.examplePhrases ?? undefined,
      platformFocus: row?.platformFocus ?? undefined,
      postingFrequency: row?.postingFrequency ?? undefined,
      audienceSize: row?.audienceSize ?? undefined,
      createdAt: row?.createdAt?.toISOString(),
      updatedAt: row?.updatedAt?.toISOString(),
    });
  } catch (e) {
    console.error("[brand-voice] POST error:", e);
    return NextResponse.json(
      { error: "Failed to save brand voice" },
      { status: 500 }
    );
  }
}
