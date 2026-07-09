import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { brandCalendarTable } from "@/db/schema/brand-calendar-schema";
import type { BrandCalendarDay } from "@/db/schema/brand-calendar-schema";

export const dynamic = "force-dynamic";

function normalizeDays(arr: unknown): BrandCalendarDay[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 7).map((item: unknown, i) => {
    const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      day: typeof o.day === "number" ? o.day : i + 1,
      post_type: typeof o.post_type === "string" ? o.post_type : "",
      concept: typeof o.concept === "string" ? o.concept : "",
      text_overlay: typeof o.text_overlay === "string" ? o.text_overlay : "",
      hook: typeof o.hook === "string" ? o.hook : "",
    };
  });
}

/**
 * POST: Save a week to brand_calendar.
 * Body: { brandName, weekNumber, daysJson }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    if (!brandName) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }
    const weekNumber = Math.min(4, Math.max(1, Number(body.weekNumber) || 1));
    const daysJson = normalizeDays(body.daysJson ?? []);

    const [row] = await db
      .insert(brandCalendarTable)
      .values({
        userId,
        brandName,
        weekNumber,
        daysJson,
      })
      .returning();

    return NextResponse.json({
      id: row.id,
      brandName: row.brandName,
      weekNumber: row.weekNumber,
      createdAt: row.createdAt?.toISOString(),
    });
  } catch (e) {
    console.error("[brand-builder/calendar/save]", e);
    return NextResponse.json({ error: "Failed to save week." }, { status: 500 });
  }
}
