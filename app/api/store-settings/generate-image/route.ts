import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { upload } from "@/lib/storage";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROMPTS: Record<string, (hint: string) => string> = {
  banner: (hint) =>
    `Professional store banner image for a digital creator. ${hint ? `Brand context: ${hint}. ` : ""}Wide panoramic composition, elegant and modern, soft gradient lighting, clean background suitable for overlaying text. No text, no logos, no watermarks. High quality, photorealistic or beautifully illustrated.`,
  profile: (hint) =>
    `Professional profile avatar / logo mark for a digital creator brand. ${hint ? `Brand context: ${hint}. ` : ""}Clean, modern, distinctive, works well as a small circular icon. Bold colours, minimal detail clutter. No text, no letters, no watermarks. Square composition.`,
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const type: "banner" | "profile" = body.type === "profile" ? "profile" : "banner";
    const hint: string = typeof body.hint === "string" ? body.hint.trim().slice(0, 200) : "";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });

    const prompt = PROMPTS[type](hint);
    const size = type === "banner" ? "1536x1024" : "1024x1024";

    const openai = new OpenAI({ apiKey });
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size,
      quality: "medium",
    });

    const b64 = (response.data?.[0] as { b64_json?: string })?.b64_json;
    if (!b64) return NextResponse.json({ error: "No image returned" }, { status: 500 });

    // Upload to storage so it's a durable public URL (not base64 in DB)
    const buffer = Buffer.from(b64, "base64");
    const filename = `store/${userId}/ai-${type}-${Date.now()}.png`;
    const blob = await upload(filename, buffer, { access: "public", contentType: "image/png" });

    return NextResponse.json({ url: blob.url, type });
  } catch (err) {
    console.error("[store-settings/generate-image]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
