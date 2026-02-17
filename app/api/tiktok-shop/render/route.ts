import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";
import { getShotstackApiKey } from "@/lib/shotstack-edit";

/**
 * POST: Create async render job. Returns jobId immediately; processing runs in background.
 * Uses Shotstack Edit API for TikTok-style videos.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hasShotstack = !!getShotstackApiKey();
    if (!hasShotstack) {
      return NextResponse.json(
        { error: "SHOTSTACK_API_KEY_SANDBOX is required. Add it to .env." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!body.productDescription?.trim()) {
      return NextResponse.json(
        { error: "productDescription is required." },
        { status: 400 }
      );
    }
    if (!body.productLink?.trim()) {
      body.productLink = "https://tiktok-shop.local/product";
    }

    const [job] = await db
      .insert(renderJobsTable)
      .values({
        userId,
        status: "processing",
        payload: body as Record<string, unknown>,
      })
      .returning({ id: renderJobsTable.id });

    if (!job?.id) {
      return NextResponse.json({ error: "Failed to create render job" }, { status: 500 });
    }

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    fetch(`${base}/api/tiktok-shop/process-render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, userId, ...body }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          console.error("[render] process-render failed", r.status, txt.slice(0, 500));
        }
      })
      .catch((e) => {
        console.error("[render] Failed to trigger process-render:", e);
      });

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    console.error("[render] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create render job" },
      { status: 500 }
    );
  }
}
