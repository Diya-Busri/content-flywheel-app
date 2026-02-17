/**
 * Shared Shotstack Edit API utilities.
 * Used by /api/generate-video and /api/tiktok-shop/*.
 */
const SHOTSTACK_BASE = "https://api.shotstack.io/edit/stage";

export type ShotstackScript = {
  hook: string;
  body: string;
  cta: string;
};

export function getShotstackApiKey(): string | null {
  return (
    process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() ||
    process.env.SHOTSTACK_SANDBOX_API_KEY?.trim() ||
    process.env.SHOTSTACK_API_KEY?.trim() ||
    null
  );
}

export function buildShotstackEdit(
  script: ShotstackScript,
  productImageUrl: string | null | undefined
): Record<string, unknown> {
  const hook = (script.hook || "").slice(0, 200).trim() || "Your hook";
  const body = (script.body || "").slice(0, 300).trim() || "Your message";
  const cta = (script.cta || "").slice(0, 150).trim() || "Link in bio";

  const tracks: Record<string, unknown>[] = [
    {
      clips: [
        {
          asset: {
            type: "title",
            text: hook,
            style: "blockbuster",
            color: "#ffffff",
            size: "large",
            position: "center",
            offset: { y: -0.1 },
          },
          start: 0,
          length: 5,
          transition: { in: "fade" },
        },
      ],
    },
    {
      clips: [
        {
          asset: {
            type: "title",
            text: body,
            style: "skinny",
            color: "#e0e0e0",
            size: "medium",
            position: "center",
          },
          start: 5,
          length: 8,
          transition: { in: "slideUp" },
        },
      ],
    },
    {
      clips: [
        {
          asset: {
            type: "title",
            text: cta,
            style: "blockbuster",
            color: "#FFD700",
            size: "large",
            position: "center",
          },
          start: 13,
          length: 4,
          transition: { in: "zoom" },
        },
      ],
    },
  ];

  // Only add image track if we have a valid public URL. Never send undefined as src.
  const validImageUrl =
    productImageUrl &&
    typeof productImageUrl === "string" &&
    productImageUrl.trim().startsWith("https://");
  if (validImageUrl) {
    tracks.push({
      clips: [
        {
          asset: { type: "image", src: productImageUrl.trim() },
          start: 5,
          length: 8,
          fit: "contain",
          position: "center",
          offset: { y: 0.2 },
        },
      ],
    });
  }

  return {
    timeline: { background: "#000000", tracks },
    output: {
      format: "mp4",
      fps: 30,
      size: { width: 1080, height: 1920 },
    },
  };
}

export async function pollShotstackStatus(
  renderId: string,
  apiKey: string,
  intervalMs = 3000,
  maxAttempts = 60
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(`${SHOTSTACK_BASE}/render/${renderId}`, {
      headers: { "x-api-key": apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[shotstack] Poll failed:", res.status, err);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`Shotstack status check failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      success?: boolean;
      response?: { status?: string; url?: string; error?: string };
    };

    const resp = data.response;
    if (!resp) throw new Error("Shotstack returned no response");

    if (attempt === 0 || resp.status === "failed") {
      console.log("[shotstack] Poll response:", JSON.stringify(data, null, 2));
    }
    if (resp.status === "done" && resp.url) return resp.url;
    if (resp.status === "failed") {
      throw new Error(resp.error ?? "Shotstack render failed");
    }
  }
  throw new Error("Shotstack render timed out");
}

export async function renderShotstack(
  script: ShotstackScript,
  productImageUrl: string | null | undefined,
  apiKey: string
): Promise<string> {
  const edit = buildShotstackEdit(script, productImageUrl);
  console.log("[shotstack] Shotstack payload:", JSON.stringify(edit, null, 2));

  const createRes = await fetch(`${SHOTSTACK_BASE}/render`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(edit),
  });

  const body = await createRes.text();
  console.log("[shotstack] Shotstack response status:", createRes.status);
  let responseData: unknown;
  try {
    responseData = JSON.parse(body);
  } catch {
    responseData = body;
  }
  console.log("[shotstack] Shotstack response body:", JSON.stringify(responseData, null, 2));

  if (!createRes.ok) {
    let detail = body.slice(0, 300);
    try {
      const err = JSON.parse(body) as { message?: string; error?: string };
      detail = err.message ?? err.error ?? detail;
    } catch {
      // use raw
    }
    throw new Error(`Shotstack failed: ${detail}`);
  }

  let parsed: { success?: boolean; response?: { id?: string } };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Shotstack returned invalid JSON");
  }

  const renderId = parsed.response?.id;
  if (!renderId) throw new Error("Shotstack did not return render id");

  return pollShotstackStatus(renderId, apiKey);
}
