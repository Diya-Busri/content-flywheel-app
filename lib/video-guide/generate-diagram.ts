/**
 * Generate a diagram image for a Dark Infographic slide using Napkin AI.
 *
 * Flow:
 *   1. POST /v1/visual → get request_id
 *   2. Poll /v1/visual/{id}/status every 3 s (max 30 s / 10 attempts)
 *   3. Download the PNG using the auth header (Napkin URLs are private)
 *   4. Upload to Supabase "diagrams" bucket
 *   5. Return public URL, or null on any failure (never throws)
 *
 * Requires env var: NAPKIN_API_TOKEN
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

const BUCKET = "diagrams";
const NAPKIN_BASE = "https://api.napkin.ai/v1";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10; // 30 s total

export async function generateDiagramForScene({
  userId,
  slideType,
  slideTitle,
  slidePoints,
  sceneContext,
}: {
  userId: string;
  slideType: string;
  slideTitle: string;
  slidePoints: string[];
  sceneContext?: string;
}): Promise<string | null> {
  try {
    const token = process.env.NAPKIN_API_TOKEN?.trim();
    if (!token) {
      console.warn("[generate-diagram] NAPKIN_API_TOKEN not set — skipping diagram generation");
      return null;
    }
    console.log("[generate-diagram] Token present, calling Napkin API for slideType:", slideType);

    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    // ── 1. Request visual ────────────────────────────────────────────────────
    const textPayload = [
      slideTitle,
      ...slidePoints,
      ...(sceneContext ? [sceneContext] : []),
    ]
      .filter(Boolean)
      .join("\n");

    console.log("[generate-diagram] POST", `${NAPKIN_BASE}/visual`, "payload length:", textPayload.length);
    const createRes = await fetch(`${NAPKIN_BASE}/visual`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textPayload,
        style: "monochrome", // dark-aesthetic compatible
        format: "png",
        variations: 1,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const createBody = await createRes.text().catch(() => "");
    console.log("[generate-diagram] Napkin create response:", createRes.status, createBody.slice(0, 500));

    if (!createRes.ok) {
      console.error("[generate-diagram] Napkin create failed:", createRes.status, createBody);
      return null;
    }

    let createData: { request_id?: string } = {};
    try { createData = JSON.parse(createBody); } catch { /* non-JSON */ }
    const requestId = createData.request_id;
    if (!requestId) {
      console.error("[generate-diagram] No request_id in Napkin response. Full body:", createBody.slice(0, 1000));
      return null;
    }

    // ── 2. Poll until complete ───────────────────────────────────────────────
    let diagramUrl: string | null = null;

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const statusRes = await fetch(`${NAPKIN_BASE}/visual/${requestId}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!statusRes.ok) continue;

      const statusData = (await statusRes.json()) as {
        status?: string;
        generated_files?: Array<{ url?: string }>;
      };

      if (statusData.status === "completed") {
        diagramUrl = statusData.generated_files?.[0]?.url ?? null;
        break;
      }

      if (statusData.status === "failed") {
        console.error("[generate-diagram] Napkin job failed for request", requestId);
        return null;
      }
    }

    if (!diagramUrl) {
      console.warn("[generate-diagram] Napkin timed out for request", requestId);
      return null;
    }

    // ── 3. Download PNG (Napkin URLs require auth) ───────────────────────────
    const imgRes = await fetch(diagramUrl, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (!imgRes.ok) {
      console.error("[generate-diagram] PNG download failed:", imgRes.status);
      return null;
    }

    const arrayBuf = await imgRes.arrayBuffer();
    const pngBuffer = Buffer.from(arrayBuf);

    // ── 4. Upload to Supabase ────────────────────────────────────────────────
    const storagePath = `${userId}/diagrams/${randomUUID()}/diagram-${Date.now()}.png`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });

    if (error) {
      console.error("[generate-diagram] Supabase upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    console.error("[generate-diagram] Unexpected error:", err);
    return null;
  }
}
