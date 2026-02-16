const CREATOMATE_BASE = process.env.CREATOMATE_API_BASE ?? "https://api.creatomate.com/v2";
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 300000;

export type RenderResult = {
  renderId: string;
  status: string;
  url?: string;
};

export async function renderWithCreatomate(
  templateId: string,
  variables: Record<string, string | number | boolean>
): Promise<RenderResult> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey?.trim()) throw new Error("CREATOMATE_API_KEY is not set");

  const res = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications: variables,
      output_format: "mp4",
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[tiktokshop/creatomate] create error:", res.status, body.slice(0, 300));
    throw new Error("Creatomate create failed: " + res.status);
  }

  let data: { id?: string; status?: string };
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Creatomate returned invalid JSON");
  }

  const renderId = data.id;
  if (!renderId) throw new Error("Creatomate did not return render id");

  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${CREATOMATE_BASE}/renders/${renderId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) continue;

    const statusData = (await statusRes.json()) as { status?: string; url?: string; error_message?: string };
    if (statusData.status === "succeeded" && statusData.url) {
      return { renderId, status: "succeeded", url: statusData.url };
    }
    if (statusData.status === "failed") {
      const msg = statusData.error_message ?? "Unknown error";
      console.error("[tiktokshop/creatomate] render failed:", msg);
      throw new Error("Creatomate render failed: " + msg);
    }
  }

  throw new Error("Creatomate render timed out");
}
