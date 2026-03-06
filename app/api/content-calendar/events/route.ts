import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { brandCampaignsTable } from "@/db/schema/brand-campaigns-schema";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export type CalendarVideoStatus = "draft" | "scheduled" | "published";

export type ScheduleSlot = { platform: string; at: string };

export type CalendarEvent = {
  id: string;
  title: string;
  status: CalendarVideoStatus;
  createdAt: string;
  /** Primary scheduled datetime (ISO); used for calendar placement. */
  scheduledAt: string | null;
  /** Per-platform schedule (e.g. TikTok 9am, Instagram 10am). */
  scheduleSlots: ScheduleSlot[];
  /** Placeholder / future: views count. */
  views: number | null;
  /** Placeholder / future: engagement (e.g. likes + comments). */
  engagement: number | null;
  thumbnailUrl: string | null;
  metadata?: Record<string, unknown>;
};

function getCalendarEventFromRow(row: {
  id: string;
  title: string;
  status: string | null;
  createdAt: Date | null;
  thumbnailUrl: string | null;
  metadata: Record<string, unknown> | null;
}): CalendarEvent {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const scheduledAt =
    typeof meta.scheduledAt === "string" ? meta.scheduledAt : null;
  const scheduleSlots = Array.isArray(meta.scheduleSlots)
    ? (meta.scheduleSlots as ScheduleSlot[]).filter(
        (s): s is ScheduleSlot =>
          s && typeof s.platform === "string" && typeof s.at === "string"
      )
    : [];
  const views =
    typeof meta.views === "number" ? meta.views : typeof meta.views === "string" ? parseInt(meta.views, 10) || null : null;
  const engagement =
    typeof meta.engagement === "number"
      ? meta.engagement
      : typeof meta.engagement === "string"
        ? parseInt(meta.engagement, 10) || null
        : null;

  return {
    id: row.id,
    title: row.title,
    status: (row.status === "scheduled" || row.status === "published" || row.status === "draft"
      ? row.status
      : "draft") as CalendarVideoStatus,
    createdAt: (row.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
    scheduledAt,
    scheduleSlots,
    views: Number.isFinite(views) ? views : null,
    engagement: Number.isFinite(engagement) ? engagement : null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    metadata: meta,
  };
}

/**
 * GET: List timeline videos for the content calendar.
 * Query: ?month=YYYY-MM (optional) to scope by month; otherwise returns all.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM

    const rows = await db
      .select({
        id: videosTable.id,
        title: videosTable.title,
        status: videosTable.status,
        createdAt: videosTable.createdAt,
        thumbnailUrl: videosTable.thumbnailUrl,
        metadata: videosTable.metadata,
        platforms: videosTable.platforms,
      })
      .from(videosTable)
      .where(and(eq(videosTable.userId, userId), isNull(videosTable.deletedAt)))
      .orderBy(desc(videosTable.createdAt));

    const timelineVideos = rows.filter(
      (r) => Array.isArray(r.platforms) && r.platforms.includes("video-timeline")
    );

    let events: CalendarEvent[] = timelineVideos.map((r) =>
      getCalendarEventFromRow(r)
    );

    // Include scheduled brand campaigns so "Schedule Post" shows on calendar
    const campaignRows = await db
      .select({
        id: brandCampaignsTable.id,
        title: brandCampaignsTable.title,
        postConcept: brandCampaignsTable.postConcept,
        status: brandCampaignsTable.status,
        scheduledDate: brandCampaignsTable.scheduledDate,
        createdAt: brandCampaignsTable.createdAt,
      })
      .from(brandCampaignsTable)
      .where(
        and(
          eq(brandCampaignsTable.userId, userId),
          isNotNull(brandCampaignsTable.scheduledDate)
        )
      );
    const campaignEvents: CalendarEvent[] = campaignRows
      .filter((r) => r.scheduledDate != null)
      .map((r) => ({
        id: `campaign-${r.id}`,
        title: (r.title ?? r.postConcept) ?? "Scheduled campaign",
        status: (r.status === "posted"
          ? "published"
          : r.status === "ready"
            ? "scheduled"
            : "draft") as CalendarVideoStatus,
        createdAt: (r.createdAt as Date)?.toISOString?.() ?? new Date().toISOString(),
        scheduledAt: (r.scheduledDate as Date)?.toISOString?.() ?? null,
        scheduleSlots: [],
        views: null,
        engagement: null,
        thumbnailUrl: null,
        metadata: { source: "brand_campaign", campaignId: r.id },
      }));
    events = [...events, ...campaignEvents];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      events = events.filter((e) => {
        const at = e.scheduledAt ? new Date(e.scheduledAt).getTime() : null;
        if (at != null) return at >= start.getTime() && at <= end.getTime();
        return true;
      });
    }

    return NextResponse.json({ events });
  } catch (err) {
    console.error("[content-calendar/events]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch events" },
      { status: 500 }
    );
  }
}
