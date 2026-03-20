import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Submit only; no long wait

const FAL_QUEUE_URL = "https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video";

/**
 * POST: Submit animation job to Fal Kling. Returns immediately with request_id.
 * Client polls GET /api/content-studio/ai-story/animate/status?requestId=... every 5s.
 * Body: { imageUrl: string, motionPrompt: string }
 * Returns: { requestId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured. Add it to .env.local or Vercel." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    const motionPrompt = typeof body.motionPrompt === "string" ? body.motionPrompt.trim() : "";

    if (!imageUrl || !motionPrompt) {
      return NextResponse.json(
        { error: "imageUrl and motionPrompt are required" },
        { status: 400 }
      );
    }

    const initRes = await fetch(FAL_QUEUE_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: motionPrompt,
        duration: "5",
        aspect_ratio: "9:16",
      }),
    });

    const responseText = await initRes.text();
    console.log("[animate] Fal submit response status:", initRes.status, "body length:", responseText.length);
    let initData: Record<string, unknown>;
    try {
      initData = JSON.parse(responseText) as Record<string, unknown>;
    } catch (e) {
      return NextResponse.json(
        { error: "Fal API error: " + responseText.slice(0, 200) },
        { status: 500 }
      );
    }
    console.log("[animate] Fal submit full response:", JSON.stringify(initData, null, 2));

    if (!initRes.ok) {
      const errMsg =
        (initData as { detail?: string })?.detail ??
        (initData as { message?: string })?.message ??
        initRes.statusText;
      return NextResponse.json(
        { error: errMsg || "Fal API request failed" },
        { status: initRes.status >= 500 ? 502 : initRes.status }
      );
    }

    const requestId = (initData.request_id ?? initData.requestId) as string | undefined;
    if (requestId) {
      console.log("[animate] Returning requestId to client:", requestId);
      return NextResponse.json({ requestId });
    }

    // Synchronous response (no queue): return video URL if present
    const videoUrl =
      (initData as { video?: { url?: string } })?.video?.url ??
      (initData as { video_url?: string })?.video_url ??
      (initData as { url?: string })?.url;
    if (videoUrl && typeof videoUrl === "string") {
      return NextResponse.json({ videoUrl });
    }

    return NextResponse.json(
      { error: "No request_id or video URL in Fal response" },
      { status: 502 }
    );
  } catch (e) {
    console.error("[content-studio/ai-story/animate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Animation failed" },
      { status: 500 }
    );
  }
}
