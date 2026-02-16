import type { CreatomatePayload } from "./types";

const CREATOMATE_BASE = process.env.CREATOMATE_API_BASE ?? "https://api.creatomate.com/v2";

function getApiKey(): string {
  const key = process.env.CREATOMATE_API_KEY;
  if (!key?.trim()) {
    throw new Error("CREATOMATE_API_KEY is not set. Add it to your environment.");
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
      console.error("[video-pipeline] Creatomate poll failed:", statusRes.status, errBody);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`Creatomate status check failed: ${statusRes.status}`);
    }

    const data = (await statusRes.json()) as {
      status?: string;
      url?: string;
      error_message?: string;
    };

    console.log("[video-pipeline] Render poll", attempt + 1, "status:", data.status);

    if (data.status === "succeeded") {
      if (data.url) {
        console.log("[video-pipeline] Render done, url:", data.url);
        return data.url;
      }
      throw new Error("Creatomate succeeded but no URL returned");
    }

    if (data.status === "failed") {
      const msg = data.error_message ?? "Unknown error";
      console.error("[video-pipeline] Creatomate render failed:", msg);
      throw new Error(`Creatomate render failed: ${msg}`);
    }
  }

  throw new Error("Creatomate render timed out after polling");
}

/**
 * Call Creatomate render API, poll until complete, return final video URL.
 */
export async function renderWithCreatomate(payload: CreatomatePayload): Promise<string> {
  const apiKey = getApiKey();

  if (!payload.template_id?.trim()) {
    throw new Error("Creatomate payload missing template_id");
  }

  console.log("[video-pipeline] Creatomate create, template_id:", payload.template_id);

  const createRes = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      template_id: payload.template_id,
      modifications: payload.modifications,
      output_format: "mp4",
    }),
  });

  const responseBody = await createRes.text();

  if (!createRes.ok) {
    console.error("[video-pipeline] Creatomate create error:", createRes.status, responseBody);
    let detail = responseBody.slice(0, 300);
    try {
      const err = JSON.parse(responseBody) as { message?: string; error?: string };
      detail = err.message ?? err.error ?? detail;
    } catch {
      // use raw slice
    }
    throw new Error(`Creatomate create failed (${createRes.status}): ${detail}`);
  }

  let data: { id?: string };
  try {
    data = JSON.parse(responseBody);
  } catch {
    throw new Error("Creatomate returned invalid JSON");
  }

  const renderId = data.id;
  if (!renderId) {
    console.error("[video-pipeline] No render id:", responseBody);
    throw new Error("Creatomate did not return render id");
  }

  console.log("[video-pipeline] Render created, id:", renderId);

  return pollRenderStatus(renderId, apiKey);
}
