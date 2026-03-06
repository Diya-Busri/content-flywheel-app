import { NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { z } from "zod";
import { generateTikTokShopVideo } from "@/lib/video/tiktokshop/generate";

const ProductDataSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    description: z.string().optional(),
    keyBenefits: z.array(z.string()).default([]),
    price: z.string().optional(),
    claim: z.string().optional(),
    ctaText: z.string().optional(),
    productImageUrl: z.string().url().optional().or(z.literal("")),
    beforeImageUrl: z.string().url().optional().or(z.literal("")),
    afterImageUrl: z.string().url().optional().or(z.literal("")),
    demoClipUrls: z.array(z.string().url()).default([]),
    videoSourceMode: z.enum(["user_clips", "ai_generated", "hybrid"]).optional(),
    inputVideoUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const mode = data.videoSourceMode ?? "user_clips";
      if (mode === "user_clips" || mode === "hybrid") return data.demoClipUrls.length >= 1;
      return true;
    },
    { message: "demoClipUrls must have at least one URL when videoSourceMode is user_clips or hybrid", path: ["demoClipUrls"] }
  );

export async function POST(request: Request) {
  try {
    // Temporary debug: list env keys that might affect this API (no values, safe for logs)
    const envKeys = Object.keys(process.env).filter((k) =>
      /ELEVENLABS|OPENAI|CREATOMATE|SUPABASE/.test(k)
    );
    console.log("[api/video/tiktokshop] Env keys present:", envKeys.sort().join(", ") || "(none)");

    const body = await request.json().catch(() => ({}));
    const parsed = ProductDataSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors;
      const first = Object.values(msg).flat()[0];
      return NextResponse.json(
        { error: first ?? "Validation failed" },
        { status: 400 }
      );
    }

    const productData = parsed.data;
    const url = await generateTikTokShopVideo(productData);

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    if (!message.includes("API") && !message.includes("KEY")) {
      console.error("[api/video/tiktokshop] Error:", message);
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
