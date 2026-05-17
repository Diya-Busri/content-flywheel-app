import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "FAL_API_KEY not configured" }, { status: 503 });

    const res = await fetch("https://fal.run/fal-ai/birefnet", {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        model: "General Use (Light)",
        operating_resolution: "1024x1024",
        output_format: "png",
      }),
    });

    if (!res.ok) {
      console.error("[remove-bg] birefnet failed", res.status);
      return NextResponse.json({ error: "Background removal failed" }, { status: 502 });
    }

    const data = await res.json() as { image?: { url: string } };
    const url = data.image?.url;
    if (!url) return NextResponse.json({ error: "No result from background removal" }, { status: 502 });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[remove-bg]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
