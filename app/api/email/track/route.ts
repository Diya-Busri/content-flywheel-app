import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { emailCampaignsTable } from "@/db/schema/email-marketing-schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// 1×1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("c");

  if (campaignId) {
    // Increment open count — fire-and-forget, don't await for speed
    db.update(emailCampaignsTable)
      .set({ openCount: sql`${emailCampaignsTable.openCount} + 1` })
      .where(eq(emailCampaignsTable.id, campaignId))
      .catch(() => {});
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
