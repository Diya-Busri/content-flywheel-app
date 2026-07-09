import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { contentBundlesTable } from "@/db/schema/bundles-schema";
import { designsTable, DesignData } from "@/db/schema/designs-schema";
import { eq, and, isNull, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bundles = await db
    .select()
    .from(contentBundlesTable)
    .where(and(eq(contentBundlesTable.userId, userId), isNull(contentBundlesTable.deletedAt)))
    .orderBy(desc(contentBundlesTable.updatedAt));

  return NextResponse.json({ bundles });
}

type SlideInput = { title: string; data: DesignData };

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as {
      title?: string;
      style?: string;
      slides?: SlideInput[];
    };

    const title = typeof body.title === "string" ? body.title.trim() || "Untitled Bundle" : "Untitled Bundle";
    const style = typeof body.style === "string" ? body.style : "minimal-luxury";
    const slides: SlideInput[] = Array.isArray(body.slides) ? body.slides : [];

    const [bundle] = await db
      .insert(contentBundlesTable)
      .values({ userId, title, style, slideCount: slides.length })
      .returning();

    // Single bulk insert — one query instead of N individual round-trips
    if (slides.length > 0) {
      await db.insert(designsTable).values(
        slides.map((slide, i) => ({
          userId,
          title: slide.title,
          data: slide.data,
          bundleId: bundle.id,
          slideIndex: i,
        }))
      );
    }

    return NextResponse.json({ bundle }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/design-bundles]", err);
    const msg = err instanceof Error ? err.message : "Failed to create bundle";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
