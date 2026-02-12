import type { VideoStyle } from "./types";
import { PLATFORM_ASPECT_RATIOS } from "./types";

export type RenderVideoOptions = {
  videoStyle: VideoStyle;
  platform: string;
  productImageUrl?: string;
  voiceoverUrl: string;
  script: string;
};

/**
 * Creatomate template IDs - replace with your actual template IDs from Creatomate dashboard.
 * Templates should have elements: Image/Video slot, Audio slot, Text overlay.
 */
const STYLE_TEMPLATE_IDS: Record<VideoStyle, string> = {
  unboxing: process.env.CREATOMATE_TEMPLATE_UNBOXING ?? "unboxing-template-id",
  demo: process.env.CREATOMATE_TEMPLATE_DEMO ?? "demo-template-id",
  "before-after": process.env.CREATOMATE_TEMPLATE_BEFORE_AFTER ?? "before-after-template-id",
};

/**
 * Create a render on Creatomate and poll until complete; return output URL.
 */
export async function renderVideo(options: RenderVideoOptions): Promise<string> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    throw new Error("CREATOMATE_API_KEY is not set");
  }

  const { videoStyle, platform, productImageUrl, voiceoverUrl, script } = options;
  const templateId = STYLE_TEMPLATE_IDS[videoStyle];
  const aspect = PLATFORM_ASPECT_RATIOS[platform] ?? PLATFORM_ASPECT_RATIOS.tiktok;

  console.log("[render-video] Starting render:", { videoStyle, platform, templateId });

  const modifications: Record<string, string> = {};
  if (productImageUrl) modifications["Product-Image"] = productImageUrl;
  modifications["Voiceover"] = voiceoverUrl;
  modifications["Script-Text"] = script.slice(0, 500);

  const createRes = await fetch("https://api.creatomate.com/v2/renders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications,
      output_format: "mp4",
      width: aspect.width,
      height: aspect.height,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("[render-video] Creatomate create error:", createRes.status, err);
    throw new Error(`Creatomate create failed: ${createRes.status}`);
  }

  const createData = (await createRes.json()) as { id?: string; status?: string; url?: string };
  const renderId = createData.id;
  if (!renderId) {
    throw new Error("Creatomate did not return render id");
  }

  console.log("[render-video] Render created:", renderId);

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch("https://api.creatomate.com/v2/renders/" + renderId, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) {
      console.error("[render-video] Status check failed:", statusRes.status);
      continue;
    }
    const statusData = (await statusRes.json()) as { status?: string; url?: string };
    if (statusData.status === "succeeded" && statusData.url) {
      console.log("[render-video] Done, url:", statusData.url);
      return statusData.url;
    }
    if (statusData.status === "failed") {
      throw new Error("Creatomate render failed");
    }
    console.log("[render-video] Status:", statusData.status, "poll", i + 1);
  }

  throw new Error("Creatomate render timed out");
}
