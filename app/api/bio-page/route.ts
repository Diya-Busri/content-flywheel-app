import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bioPagesTable } from "@/db/schema/bio-page-schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function validateSlug(slug: string): string | null {
  if (!slug || slug.length < 3 || slug.length > 30) return "Slug must be 3–30 characters";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Slug can only contain lowercase letters, numbers, and hyphens";
  return null;
}

/** GET /api/bio-page — fetch authenticated user's bio page */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [row] = await db.select().from(bioPagesTable).where(eq(bioPagesTable.userId, userId));
    return NextResponse.json(row ?? null);
  } catch (e) {
    console.error("[bio-page] GET error:", e);
    return NextResponse.json({ error: "Failed to load bio page" }, { status: 500 });
  }
}

/** POST /api/bio-page — create or update bio page */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      slug?: string;
      title?: string;
      bio?: string;
      avatarUrl?: string;
      primaryColor?: string;
      links?: { label: string; url: string }[];
      showWaitlist?: boolean;
      waitlistCta?: string;
      isPublished?: boolean;
    };

    const slug = (body.slug ?? "").toLowerCase().trim();
    const slugError = validateSlug(slug);
    if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });

    // Check slug uniqueness (allow same user to keep their slug)
    const [existing] = await db.select({ userId: bioPagesTable.userId }).from(bioPagesTable).where(eq(bioPagesTable.slug, slug));
    if (existing && existing.userId !== userId) {
      return NextResponse.json({ error: "This slug is already taken. Try a different one." }, { status: 409 });
    }

    const values = {
      userId,
      slug,
      title: (body.title ?? "").trim(),
      bio: (body.bio ?? "").trim(),
      avatarUrl: body.avatarUrl?.trim() || null,
      primaryColor: body.primaryColor?.trim() || "#f97316",
      links: JSON.stringify(Array.isArray(body.links) ? body.links.slice(0, 6) : []),
      showWaitlist: body.showWaitlist ?? true,
      waitlistCta: (body.waitlistCta ?? "Be first to know when we drop").trim(),
      isPublished: body.isPublished ?? false,
      updatedAt: new Date(),
    };

    const [row] = await db
      .insert(bioPagesTable)
      .values(values)
      .onConflictDoUpdate({ target: bioPagesTable.userId, set: values })
      .returning();

    return NextResponse.json(row);
  } catch (e) {
    console.error("[bio-page] POST error:", e);
    return NextResponse.json({ error: "Failed to save bio page" }, { status: 500 });
  }
}
