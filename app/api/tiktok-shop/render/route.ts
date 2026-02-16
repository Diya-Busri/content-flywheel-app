import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { renderJobsTable } from "@/db/schema/library-schema";
import { eq } from "drizzle-orm";

const useHeyGen = () => Boolean(process.env.HEYGEN_API_KEY?.trim());

/**
 * POST: Create async render job. Returns jobId immediately; processing runs in background.
 * Body: same as generate-video (productLink, productDescription, script, etc.)
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const heygenMode = useHeyGen();
    console.log("[render] HEYGEN_API_KEY present:", !!process.env.HEYGEN_API_KEY?.trim(), "| heygenMode:", heygenMode);
    if (!heygenMode) {
      if (!process.env.ELEVENLABS_API_KEY?.trim() || !process.env.CREATOMATE_API_KEY?.trim()) {
        return NextResponse.json(
          { error: "ELEVENLABS_API_KEY and CREATOMATE_API_KEY are required for product videos." },
          { status: 503 }
        );
      }
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

    // Fire-and-forget: trigger process-render. Do NOT await.
    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";
    console.log("[render] Triggering process-render at", `${base}/api/tiktok-shop/process-render`, "jobId:", job.id);
    fetch(`${base}/api/tiktok-shop/process-render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, userId, ...body }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          console.error("[render] process-render failed", r.status, r.statusText, "body:", body.slice(0, 500));
        }
      })
      .catch((e) => {
        console.error("[render] Failed to trigger process-render:", e instanceof Error ? e.message : e, e);
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
