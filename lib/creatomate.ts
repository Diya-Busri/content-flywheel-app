/**
 * Creatomate video rendering via RenderScript API.
 * Uses CREATOMATE_API_KEY from env.
 */

export type CreatomateStyle = "unboxing" | "demo" | "before-after";

export type RenderVideoOptions = {
  productImage: string;
  productName: string;
  features: string[];
  voiceoverUrl: string;
  style: CreatomateStyle;
  platform: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;

/** Aspect ratio 9:16 for tiktok, instagram, youtube (Shorts). */
const ASPECT = { width: WIDTH, height: HEIGHT };

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 2 * 60 * 1000; // 2 minutes

type RenderScriptElement = Record<string, unknown>;

/**
 * Build RenderScript JSON for Creatomate based on style.
 */
function buildRenderScript(options: RenderVideoOptions): Record<string, unknown> {
  const { productImage, productName, features, voiceoverUrl, style } = options;
  const elements: RenderScriptElement[] = [];

  // Voiceover as audio track (full length)
  elements.push({
    type: "audio",
    track: 1,
    time: 0,
    duration: "media",
    source: voiceoverUrl,
  });

  if (style === "unboxing") {
    // Scene 1: Product image (2 sec)
    elements.push({
      type: "image",
      track: 2,
      time: 0,
      duration: 2,
      source: productImage,
      width: "100%",
      height: "100%",
      fit: "contain",
    });
    // Scene 2: Product reveal with zoom (3 sec)
    elements.push({
      type: "image",
      track: 2,
      time: 2,
      duration: 3,
      source: productImage,
      width: "100%",
      height: "100%",
      fit: "contain",
      animations: [{ time: 0, duration: 3, type: "scale", start_scale: "100%", end_scale: "120%", easing: "linear" }],
    });
    // Scene 3–5: Feature callouts (3 sec each)
    const featureSlots = features.slice(0, 3);
    featureSlots.forEach((text, i) => {
      elements.push({
        type: "text",
        track: 2,
        time: 5 + i * 3,
        duration: 3,
        text: text,
        y: "70%",
        width: "90%",
        fill_color: "#ffffff",
        font_size: "5vmin",
        background_color: "rgba(0,0,0,0.6)",
        background_y_padding: "2%",
      });
    });
    // Scene 6: CTA (2 sec)
    const ctaTime = 5 + featureSlots.length * 3;
    elements.push({
      type: "text",
      track: 2,
      time: ctaTime,
      duration: 2,
      text: "Shop Now",
      y: "85%",
      width: "80%",
      fill_color: "#ffffff",
      font_size: "7vmin",
      font_weight: "800",
      background_color: "#ff0050",
      background_y_padding: "3%",
    });
    // Title overlay
    elements.push({
      type: "text",
      track: 2,
      time: 0,
      duration: 5,
      text: productName,
      y: "15%",
      width: "90%",
      fill_color: "#ffffff",
      font_size: "6vmin",
      font_weight: "700",
    });
  } else if (style === "demo") {
    // Product center, features appear sequentially
    elements.push({
      type: "image",
      track: 2,
      time: 0,
      duration: "media",
      source: productImage,
      width: "100%",
      height: "100%",
      fit: "contain",
    });
    elements.push({
      type: "text",
      track: 2,
      time: 0,
      duration: 4,
      text: productName,
      y: "12%",
      width: "90%",
      fill_color: "#ffffff",
      font_size: "5.5vmin",
      font_weight: "700",
    });
    const featDuration = 4;
    features.slice(0, 4).forEach((text, i) => {
      elements.push({
        type: "text",
        track: 2,
        time: 4 + i * featDuration,
        duration: featDuration,
        text: "• " + text,
        y: `${25 + i * 15}%`,
        width: "85%",
        fill_color: "#ffffff",
        font_size: "4vmin",
      });
    });
    const totalFeat = Math.min(features.length, 4) * featDuration;
    elements.push({
      type: "text",
      track: 2,
      time: 4 + totalFeat,
      duration: 3,
      text: "Shop Now",
      y: "88%",
      width: "80%",
      fill_color: "#ffffff",
      font_size: "6vmin",
      font_weight: "800",
      background_color: "#ff0050",
      background_y_padding: "3%",
    });
  } else {
    // before-after: split screen, problem → solution, CTA
    elements.push({
      type: "image",
      track: 2,
      time: 0,
      duration: 4,
      source: productImage,
      width: "50%",
      x: "25%",
      height: "50%",
      y: "30%",
      fit: "contain",
    });
    elements.push({
      type: "text",
      track: 2,
      time: 0,
      duration: 4,
      text: "Before",
      y: "15%",
      width: "100%",
      fill_color: "#ffffff",
      font_size: "5vmin",
    });
    elements.push({
      type: "text",
      track: 2,
      time: 4,
      duration: 4,
      text: "After",
      y: "15%",
      width: "100%",
      fill_color: "#ffffff",
      font_size: "5vmin",
    });
    elements.push({
      type: "image",
      track: 2,
      time: 4,
      duration: 4,
      source: productImage,
      width: "80%",
      height: "45%",
      y: "35%",
      fit: "contain",
    });
    elements.push({
      type: "text",
      track: 2,
      time: 4,
      duration: 4,
      text: productName,
      y: "82%",
      width: "90%",
      fill_color: "#ffffff",
      font_size: "4vmin",
    });
    elements.push({
      type: "text",
      track: 2,
      time: 8,
      duration: 3,
      text: "Shop Now",
      y: "88%",
      width: "80%",
      fill_color: "#ffffff",
      font_size: "6vmin",
      font_weight: "800",
      background_color: "#ff0050",
      background_y_padding: "3%",
    });
  }

  return {
    output_format: "mp4",
    width: ASPECT.width,
    height: ASPECT.height,
    elements,
  };
}

/**
 * Create a render and return its ID.
 */
async function createRender(apiKey: string, script: Record<string, unknown>): Promise<string> {
  const url = "https://api.creatomate.com/v2/renders";
  console.log("[creatomate] Creating render, elements:", (script.elements as unknown[])?.length);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(script),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[creatomate] Create failed:", res.status, err);
    throw new Error(`Creatomate create failed: ${res.status} - ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    console.error("[creatomate] No render id in response:", data);
    throw new Error("Creatomate did not return render id");
  }

  return data.id;
}

/**
 * Poll render status until succeeded or failed/timeout. Returns output URL.
 */
async function pollUntilComplete(apiKey: string, renderId: string): Promise<string> {
  const url = `https://api.creatomate.com/v2/renders/${renderId}`;
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.error("[creatomate] Status check failed:", res.status);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const data = (await res.json()) as { status?: string; url?: string; error_message?: string };
    console.log("[creatomate] Poll status:", data.status);

    if (data.status === "succeeded" && data.url) {
      return data.url;
    }
    if (data.status === "failed") {
      const msg = data.error_message ?? "Render failed";
      console.error("[creatomate] Render failed:", msg);
      throw new Error("Creatomate render failed: " + msg);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error("Creatomate render timed out after 2 minutes");
}

/**
 * Render a product video with Creatomate: build template from style, submit render, poll until done, return video URL.
 */
export async function renderVideo(options: RenderVideoOptions): Promise<string> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    throw new Error("CREATOMATE_API_KEY is not set");
  }

  const { style, platform, productName } = options;
  console.log("[creatomate] renderVideo:", { style, platform, productName: productName.slice(0, 40) });

  const script = buildRenderScript(options);
  const renderId = await createRender(apiKey, script);
  console.log("[creatomate] Render created:", renderId);

  const videoUrl = await pollUntilComplete(apiKey, renderId);
  console.log("[creatomate] Done, url:", videoUrl);
  return videoUrl;
}
