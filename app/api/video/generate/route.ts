import { NextResponse } from "next/server";

const CREATOMATE_BASE = "https://api.creatomate.com/v1";

type VideoStyle = "unboxing" | "promo" | "demo" | "beforeAfter";

type GenerateBody = {
  script: string;
  videoStyle: VideoStyle;
  imageUrl: string;
};

type Scenes = {
  Headline: string;
  Subheadline: string;
  CTA: string;
};

const STYLE_ENV_KEYS: Record<VideoStyle, string> = {
  unboxing: "CREATOMATE_TEMPLATE_UNBOXING",
  promo: "CREATOMATE_TEMPLATE_PROMO",
  demo: "CREATOMATE_TEMPLATE_DEMO",
  beforeAfter: "CREATOMATE_TEMPLATE_BEFORE_AFTER",
};

function structureScript(script: string): Scenes {
  const lines = (script ?? "")
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    Headline: lines[0] ?? "",
    Subheadline: lines[1] ?? "",
    CTA: "Shop now",
  };
}

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY;
  if (!key || !key.trim()) {
    throw new Error("CREATOMATE_API_KEY is not set. Add it to your environment.");
  }
  return key.trim();
}

function getTemplateId(style: VideoStyle): string {
  const envKey = STYLE_ENV_KEYS[style];
  const id = process.env[envKey];
  if (!id || !String(id).trim()) {
    throw new Error(
      `${envKey} is not set. Add your Creatomate template ID for "${style}" style to .env.local`
    );
  }
  return String(id).trim();
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
      console.error("[video/generate] Poll status failed:", statusRes.status, errBody);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`Creatomate status check failed: ${statusRes.status}`);
    }

    const data = (await statusRes.json()) as {
      status?: string;
      url?: string;
      error_message?: string;
    };

    console.log("[video/generate] Poll", attempt + 1, "status:", data.status);

    if (data.status === "succeeded") {
      if (data.url) {
        console.log("[video/generate] Done, url:", data.url);
        return data.url;
      }
      throw new Error("Creatomate succeeded but no URL returned");
    }

    if (data.status === "failed") {
      const msg = data.error_message ?? "Unknown error";
      console.error("[video/generate] Creatomate render failed:", msg);
      throw new Error(`Creatomate render failed: ${msg}`);
    }
  }

  throw new Error("Creatomate render timed out after polling");
}

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey();

    const body = (await request.json().catch(() => ({}))) as Partial<GenerateBody>;
    const { script, videoStyle, imageUrl } = body;

    if (!script || typeof script !== "string") {
      return NextResponse.json({ error: "script is required (string)" }, { status: 400 });
    }
    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "imageUrl is required (string)" }, { status: 400 });
    }

    const validStyles: VideoStyle[] = ["unboxing", "promo", "demo", "beforeAfter"];
    const style = validStyles.includes(videoStyle as VideoStyle)
      ? (videoStyle as VideoStyle)
      : "demo";

    const templateId = getTemplateId(style);
    console.log("[video/generate] templateId:", templateId, "style:", style);

    const scenes = structureScript(script);

    const modifications: Record<string, string> = {
      "Headline.text": scenes.Headline,
      "Subheadline.text": scenes.Subheadline,
      "CTA.text": scenes.CTA,
      "ProductImage.source": imageUrl,
    };

    const createRes = await fetch(`${CREATOMATE_BASE}/renders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications,
      }),
    });

    const responseBody = await createRes.text();

    if (!createRes.ok) {
      console.error("[video/generate] Creatomate create error:", createRes.status, responseBody);
      let detail = responseBody.slice(0, 300);
      try {
        const err = JSON.parse(responseBody) as { message?: string; error?: string };
        detail = err.message ?? err.error ?? detail;
      } catch {
        // use raw slice
      }
      return NextResponse.json(
        { error: `Creatomate create failed (${createRes.status}): ${detail}` },
        { status: 502 }
      );
    }

    let createData: { id?: string };
    try {
      createData = JSON.parse(responseBody);
    } catch {
      return NextResponse.json(
        { error: "Creatomate returned invalid JSON" },
        { status: 502 }
      );
    }

    const renderId = createData.id;
    if (!renderId) {
      console.error("[video/generate] No render id in response:", responseBody);
      return NextResponse.json(
        { error: "Creatomate did not return render id" },
        { status: 502 }
      );
    }

    console.log("[video/generate] Render created, id:", renderId);

    const videoUrl = await pollRenderStatus(renderId, apiKey);

    if (!videoUrl || !videoUrl.startsWith("http")) {
      return NextResponse.json(
        { error: "Video generation succeeded but no usable URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[video/generate] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
