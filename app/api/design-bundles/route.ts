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

  // Insert slides in batches of 10
  for (let i = 0; i < slides.length; i += 10) {
    await Promise.all(
      slides.slice(i, i + 10).map((slide, offset) =>
        db.insert(designsTable).values({
          userId,
          title: slide.title,
          data: slide.data,
          bundleId: bundle.id,
          slideIndex: i + offset,
        })
      )
    );
  }

  return NextResponse.json({ bundle }, { status: 201 });
}
