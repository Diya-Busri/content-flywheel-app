/**
 * POST /api/launch/design
 * ─────────────────────────
 * Streaming image generation for the AI Execution pipeline (Phase 1.4).
 *
 * Generates 4 product marketing assets with gpt-image-1 sequentially,
 * streaming events so the execution dashboard can show images appearing live.
 *
 * Stream event sequence:
 *   step              — a named step is starting
 *   step-done         — a named step completed
 *   asset-generating  — { assetId, label } — image generation started
 *   asset-done        — { assetId, label, url } — image ready (show it)
 *   asset-error       — { assetId, label, message } — image failed (non-fatal)
 *   done              — { assets, assetsCount } — all complete
 *   error             — fatal error
 *
 * Assets generated:
 *   cover     — Portrait product cover (1024×1536)
 *   mockup    — 3D book-on-desk scene (1024×1024)
 *   thumbnail — Store listing thumbnail (1024×1024)
 *   social    — Square social media preview (1024×1024)
 *
 * Saves to productsTable.marketingAssets:
 *   coverThumbnailUrl, bookMockupUrl, thumbnailUrl, socialPreviewUrl
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 300; // Image gen: ~30-45s × 4 images

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { upload } from "@/lib/storage";

/* ─── Asset definitions ──────────────────────────────────────────────────────── */

interface DesignAsset {
  id:    string;
  label: string;
  size:  "1024x1024" | "1024x1536";
}

const DESIGN_ASSETS: DesignAsset[] = [
  { id: "cover",     label: "Product Cover",    size: "1024x1536" },
  { id: "mockup",    label: "3D Mockup",         size: "1024x1024" },
  { id: "thumbnail", label: "Store Thumbnail",   size: "1024x1024" },
  { id: "social",    label: "Social Preview",    size: "1024x1024" },
];

/* ─── Prompt builder ─────────────────────────────────────────────────────────── */

function buildImagePrompt(
  assetId: string,
  productName: string,
  niche:       string,
  format:      string,
): string {
  const name = productName.slice(0, 60);
  const n    = niche.slice(0, 40);
  const fmt  = format || "guide";

  switch (assetId) {
    case "cover":
      return `Professional digital product cover for a ${fmt} titled "${name}". Topic: ${n}. Bold clean typography on a premium gradient background. No people. Modern design aesthetic. Portrait orientation.`;

    case "mockup":
      return `Realistic 3D product mockup: a ${fmt} titled "${name}" on a minimal clean white desk. Soft drop shadow, professional product photography. No people. Clean background.`;

    case "thumbnail":
      return `Digital marketplace listing thumbnail for "${name}" (${n}). Minimalist design, bold title, professional color palette. Square format. Clean premium aesthetic.`;

    case "social":
      return `Eye-catching square social media promotional image for "${name}". ${n} themed. Bold visual hierarchy, shareable design. No real people. Modern clean aesthetic.`;

    default:
      return `Professional marketing image for "${name}" in ${n}`;
  }
}

/* ─── Image generation ───────────────────────────────────────────────────────── */

async function generateAndStoreImage(
  assetId:     string,
  productName: string,
  niche:       string,
  format:      string,
  userId:      string,
  apiKey:      string,
): Promise<string> {
  const asset  = DESIGN_ASSETS.find(a => a.id === assetId)!;
  const prompt = buildImagePrompt(assetId, productName, niche, format);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:   "gpt-image-1",
      prompt,
      n:       1,
      size:    asset.size,
      quality: "auto",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { data?: Array<{ b64_json?: string }> };
  const b64  = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");

  const buffer = Buffer.from(b64, "base64");

  // Upload to Blob if configured, otherwise fall back to data URL
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (useBlob) {
    try {
      const blob = await upload(
        `launch-design/${userId}/${assetId}-${Date.now()}.png`,
        buffer,
        { access: "public", contentType: "image/png", addRandomSuffix: false },
      );
      return blob.url;
    } catch (blobErr) {
      console.warn(`[launch/design] Blob upload failed for ${assetId}, using data URL:`, blobErr);
    }
  }

  return `data:image/png;base64,${b64}`;
}

/* ─── Streaming generator ────────────────────────────────────────────────────── */

function streamDesignGeneration(
  userId:      string,
  productId:   string,
  productName: string,
  niche:       string,
  format:      string,
  apiKey:      string,
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer closed */ }
  };

  void (async () => {
    const generatedUrls: Record<string, string> = {};

    try {
      /* ── Step 0: prep ── */
      await send({ type: "step", id: "prep", label: "Reading product details..." });
      await send({ type: "step-done", id: "prep" });

      /* ── Generate each asset sequentially ── */
      for (const asset of DESIGN_ASSETS) {
        await send({ type: "asset-generating", assetId: asset.id, label: asset.label });

        try {
          const url = await generateAndStoreImage(
            asset.id, productName, niche, format, userId, apiKey,
          );
          generatedUrls[asset.id] = url;
          await send({ type: "asset-done", assetId: asset.id, label: asset.label, url });
        } catch (assetErr) {
          const msg = assetErr instanceof Error ? assetErr.message : String(assetErr);
          console.error(`[launch/design] Asset ${asset.id} failed:`, msg);
          await send({ type: "asset-error", assetId: asset.id, label: asset.label, message: msg });
          // Non-fatal — continue with remaining assets
        }
      }

      /* ── Save to product record ── */
      await send({ type: "step", id: "saving", label: "Attaching assets to Digital Product..." });

      const currentProduct = await db
        .select({ marketingAssets: productsTable.marketingAssets })
        .from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(1);

      if (currentProduct[0]) {
        const existing = (currentProduct[0].marketingAssets ?? {}) as Record<string, unknown>;
        const updated  = {
          ...existing,
          ...(generatedUrls.cover     ? { coverThumbnailUrl: generatedUrls.cover }     : {}),
          ...(generatedUrls.mockup    ? { bookMockupUrl:      generatedUrls.mockup }    : {}),
          ...(generatedUrls.thumbnail ? { thumbnailUrl:       generatedUrls.thumbnail } : {}),
          ...(generatedUrls.social    ? { socialPreviewUrl:   generatedUrls.social }   : {}),
        };

        await db
          .update(productsTable)
          .set({ marketingAssets: updated, updatedAt: new Date() })
          .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
      }

      await send({ type: "step-done", id: "saving" });

      const assetsCount = Object.keys(generatedUrls).length;
      await send({
        type:        "done",
        assets:      generatedUrls,
        assetsCount,
      });

    } catch (err) {
      console.error("[launch/design]", err);
      await send({
        type:    "error",
        message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "application/x-ndjson; charset=utf-8",
      "Cache-Control":     "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
    }

    const body = await request.json().catch(() => ({})) as {
      productId?:   string;
      productName?: string;
      niche?:       string;
      format?:      string;
    };

    const productId   = typeof body.productId   === "string" ? body.productId.trim()   : "";
    const productName = typeof body.productName === "string" ? body.productName.trim() : "My Product";
    const niche       = typeof body.niche       === "string" ? body.niche.trim()       : "digital products";
    const format      = typeof body.format      === "string" ? body.format.trim()      : "guide";

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), { status: 400 });
    }

    return streamDesignGeneration(userId, productId, productName, niche, format, apiKey);

  } catch (err) {
    console.error("[launch/design]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
