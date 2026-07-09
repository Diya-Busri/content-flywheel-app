import type { VideoStyle, ScriptScenes } from "./types";
import { PLATFORM_ASPECT_RATIOS } from "./types";
import { buildProductRenderScript } from "./build-renderscript";

const CREATOMATE_BASE = process.env.CREATOMATE_API_BASE ?? "https://api.creatomate.com/v2";

/** Options for the product-driven TikTok Shop pipeline (4 or 5 scenes). Product image required. */
export type RenderProductVideoOptions = {
  scriptScenes: ScriptScenes;
  productImageUrl: string;
  voiceoverUrl: string;
  platform: string;
  /** Optional: full script (voiceover). When set, on-screen text is derived from it so the video reflects the script. */
  fullScript?: string;
  /** Optional: full script length for scene duration estimate. */
  fullScriptLength?: number;
  /** Optional: target duration in seconds (15–60). Overrides estimate when set. */
  targetDurationSec?: number;
  /** Optional: URL for punch/slam sound at CTA scene start. */
  punchSoundUrl?: string;
  /** Optional: Pexels B-roll video URL for Solution scene (e.g. someone applying product). */
  bRollVideoUrl?: string;
};

/** Legacy options for style-based single-template render (e.g. unboxing/demo/before-after). */
export type RenderVideoOptions = {
  videoStyle: VideoStyle;
  platform: string;
  productImageUrl?: string;
  voiceoverUrl: string;
  script: string;
};

function getTemplateId(videoStyle: VideoStyle): string {
  const ids: Record<VideoStyle, string | undefined> = {
    unboxing: process.env.CREATOMATE_TEMPLATE_UNBOXING,
    demo: process.env.CREATOMATE_TEMPLATE_DEMO,
    "before-after": process.env.CREATOMATE_TEMPLATE_BEFORE_AFTER,
  };
  const id = ids[videoStyle];
  if (!id || !id.trim()) {
    throw new Error(
      `CREATOMATE_TEMPLATE_${videoStyle.toUpperCase().replace("-", "_")} is not set. ` +
        `Add your Creatomate template ID for "${videoStyle}" style to .env.local`
    );
  }
  return id.trim();
}

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "CREATOMATE_API_KEY is not set. Add your Creatomate API key to .env.local (never expose it client-side)."
    );
  }
  return key.trim();
}

async function pollRenderStatus(
  renderId: string,
  apiKey: string,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const statusRes = await fetch(`${CREATOMATE_BASE}/renders/${renderId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) {
      const errBody = await statusRes.text();
      console.error("[render-video] Poll status failed:", statusRes.status, errBody);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`Creatomate status check failed: ${statusRes.status}`);
    }

    const data = (await statusRes.json()) as {
      status?: string;
      url?: string;
      error_message?: string;
    };

    console.log("[render-video] Poll", attempt + 1, "status:", data.status);

    if (data.status === "succeeded") {
      if (data.url) {
        console.log("[render-video] Done, url:", data.url);
        return data.url;
      }
      throw new Error("Creatomate succeeded but no URL returned");
    }

    if (data.status === "failed") {
      const msg = data.error_message ?? "Unknown error";
      console.error("[render-video] Creatomate render failed:", msg);
      throw new Error(`Creatomate render failed: ${msg}`);
    }
  }

  throw new Error("Creatomate render timed out after polling");
}

/**
 * Product-driven 4-scene TikTok Shop render via RenderScript (no template).
 * Product image in every scene; voiceover attached; no stock or scenic fallback.
 */
export async function renderProductVideo(options: RenderProductVideoOptions): Promise<string> {
  const apiKey = getApiKey();
  const renderScript = buildProductRenderScript({
    scriptScenes: options.scriptScenes,
    productImageUrl: options.productImageUrl,
    voiceoverUrl: options.voiceoverUrl,
    platform: options.platform,
    fullScript: options.fullScript,
    fullScriptLength: options.fullScriptLength,
    targetDurationSec: options.targetDurationSec,
    punchSoundUrl: options.punchSoundUrl,
    bRollVideoUrl: options.bRollVideoUrl,
  });

  let imageHost = "unknown";
  try {
    if (options.productImageUrl) imageHost = new URL(options.productImageUrl).hostname;
  } catch {
    // ignore
  }
  const sceneCount = (options.scriptScenes.proof_points?.length ?? 0) > 0 ? 5 : 4;
  console.log("[render-video] Product pipeline (RenderScript, no template):", {
    platform: options.platform,
    productImageHost: imageHost,
    sceneCount,
  });

  const createRes = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(renderScript),
  });

  const responseBody = await createRes.text();

  if (!createRes.ok) {
    console.error("[render-video] Creatomate create error:", createRes.status, responseBody);
    let detail = "";
    try {
      const err = JSON.parse(responseBody) as { message?: string; error?: string };
      detail = err.message ?? err.error ?? responseBody.slice(0, 300);
    } catch {
      detail = responseBody.slice(0, 300);
    }
    throw new Error(`Creatomate create failed (${createRes.status}): ${detail}`);
  }

  let createData: { id?: string };
  try {
    createData = JSON.parse(responseBody);
  } catch {
    throw new Error("Creatomate returned invalid JSON");
  }

  const renderId = createData.id;
  if (!renderId) {
    console.error("[render-video] No render id in response:", responseBody);
    throw new Error("Creatomate did not return render id");
  }

  console.log("[render-video] Render created, id:", renderId);
  return pollRenderStatus(renderId, apiKey);
}

/**
 * Legacy style-based render (single template with Product-Image, Voiceover, Script-Text).
 * Prefer renderProductVideo for the product-driven 4-scene pipeline.
 */
export async function renderVideo(options: RenderVideoOptions): Promise<string> {
  const apiKey = getApiKey();
  const { videoStyle, platform, productImageUrl, voiceoverUrl, script } = options;
  const templateId = getTemplateId(videoStyle);
  const aspect = PLATFORM_ASPECT_RATIOS[platform] ?? PLATFORM_ASPECT_RATIOS.tiktok;

  const imageKey = process.env.CREATOMATE_ELEMENT_IMAGE ?? "Product-Image";
  const voiceoverKey = process.env.CREATOMATE_ELEMENT_VOICEOVER ?? "Voiceover";
  const scriptKey = process.env.CREATOMATE_ELEMENT_SCRIPT ?? "Script-Text";

  console.log("[render-video] Legacy pipeline:", { videoStyle, platform, templateId });

  const modifications: Record<string, string | number> = {
    [voiceoverKey]: voiceoverUrl,
    [scriptKey]: script.slice(0, 500),
    width: aspect.width,
    height: aspect.height,
  };
  if (productImageUrl) {
    modifications[imageKey] = productImageUrl;
  }

  const body = {
    template_id: templateId,
    modifications,
    output_format: "mp4",
  };

  const createRes = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const responseBody = await createRes.text();

  if (!createRes.ok) {
    console.error("[render-video] Creatomate create error:", createRes.status, responseBody);
    let detail = "";
    try {
      const err = JSON.parse(responseBody) as { message?: string; error?: string };
      detail = err.message ?? err.error ?? responseBody.slice(0, 300);
    } catch {
      detail = responseBody.slice(0, 300);
    }
    throw new Error(
      `Creatomate create failed (${createRes.status}): ${detail}. ` +
        `Check template_id and that modification keys (${imageKey}, ${voiceoverKey}, ${scriptKey}) match your template layer names.`
    );
  }

  let createData: { id?: string };
  try {
    createData = JSON.parse(responseBody);
  } catch {
    throw new Error("Creatomate returned invalid JSON");
  }

  const renderId = createData.id;
  if (!renderId) {
    console.error("[render-video] No render id in response:", responseBody);
    throw new Error("Creatomate did not return render id");
  }

  console.log("[render-video] Render created, id:", renderId);
  return pollRenderStatus(renderId, apiKey);
}
