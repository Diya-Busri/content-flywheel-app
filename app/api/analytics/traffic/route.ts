export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productViewsTable } from "@/db/schema/product-views-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, gte, inArray, sql } from "drizzle-orm";

// Map a referrer URL to a human-readable source label
function classifyReferrer(referrer: string | null): string {
  if (!referrer || referrer.trim() === "") return "Direct / Unknown";
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "");
    if (host.includes("tiktok.com") || host.includes("vm.tiktok") || host.includes("vt.tiktok")) return "TikTok";
    if (host.includes("youtube.com") || host === "youtu.be" || host === "m.youtube.com") return "YouTube";
    if (host.includes("instagram.com")) return "Instagram";
    if (host === "t.co" || host.includes("twitter.com") || host.includes("x.com")) return "Twitter / X";
    if (host.includes("facebook.com") || host.includes("fb.com") || host === "fb.me") return "Facebook";
    if (host.includes("linkedin.com")) return "LinkedIn";
    if (host.includes("pinterest.com") || host.includes("pin.it")) return "Pinterest";
    if (host.includes("threads.net")) return "Threads";
    if (host.includes("snapchat.com")) return "Snapchat";
    if (host.includes("reddit.com")) return "Reddit";
    if (host.includes("beacons.ai") || host.includes("linktr.ee") || host.includes("bio.link")) return "Link in Bio";
    if (host.includes("google.")) return "Google";
    if (host.includes("bing.com")) return "Bing";
    // Use the full domain as fallback
    return host;
  } catch {
    return "Direct / Unknown";
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const periodParam = req.nextUrl.searchParams.get("period") ?? "30";
  const periodDays = periodParam === "all" ? null : parseInt(periodParam, 10) || 30;
  const periodStart = periodDays ? daysAgo(periodDays) : null;

  try {
    // Get all published products for this creator
    const creatorProducts = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(eq(productsTable.userId, userId), eq(productsTable.status, "published")));

    if (creatorProducts.length === 0) {
      return NextResponse.json({ sources: [] });
    }

    const productIds = creatorProducts.map((p) => p.id);

    // Fetch referrers for the period
    const viewsQuery = db
      .select({ referrer: productViewsTable.referrer, cnt: sql<number>`count(*)::int` })
      .from(productViewsTable)
      .where(
        periodStart
          ? and(inArray(productViewsTable.productId, productIds), gte(productViewsTable.viewedAt, periodStart))
          : inArray(productViewsTable.productId, productIds)
      )
      .groupBy(productViewsTable.referrer);

    const rows = await viewsQuery;

    // Aggregate by classified source
    const sourceMap = new Map<string, number>();
    let totalViews = 0;
    for (const row of rows) {
      const source = classifyReferrer(row.referrer);
      sourceMap.set(source, (sourceMap.get(source) ?? 0) + Number(row.cnt));
      totalViews += Number(row.cnt);
    }

    const sources = Array.from(sourceMap.entries())
      .map(([name, views]) => ({ name, views, pct: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return NextResponse.json({ sources, totalViews });
  } catch (err) {
    console.error("[analytics/traffic] GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
