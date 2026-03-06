/**
 * Generate product marketing videos via Creatomate API.
 * Uses scripts (hook, body, cta) and product image. Produces vertical videos (template defines size; use 1080x1920 for TikTok/Reels).
 *
 * Creatomate template must have elements named: Headline, Subheadline, CTA, ProductImage (source = image URL).
 * Set CREATOMATE_TEMPLATE_DIGITAL_PRODUCT in env, or fallback to CREATOMATE_TEMPLATE_PROMO / CREATOMATE_TEMPLATE_DEMO.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

const CREATOMATE_BASE = "https://api.creatomate.com/v1";

// Placeholder image when no product thumbnail (1080x1920 vertical gradient)
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&fit=crop";

type ScriptInput = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

function getApiKey(): string | null {
  return process.env.CREATOMATE_API_KEY?.trim() || null;
}

function getTemplateId(): string | null {
  return (
    process.env.CREATOMATE_TEMPLATE_DIGITAL_PRODUCT?.trim() ||
    process.env.CREATOMATE_TEMPLATE_PROMO?.trim() ||
    process.env.CREATOMATE_TEMPLATE_DEMO?.trim() ||
    null
  );
}

async function pollRenderStatus(
  renderId: string,
  apiKey: string,
  maxAttempts = 90,
  intervalMs = 2000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const statusRes = await fetch(`${CREATOMATE_BASE}/renders/${renderId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) {
      const errBody = await statusRes.text();
      console.error("[digital-products/generate-videos] Poll failed:", statusRes.status, errBody);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`Creatomate status check failed: ${statusRes.status}`);
    }

    const data = (await statusRes.json()) as {
      status?: string;
      url?: string;
      error_message?: string;
    };

    if (data.status === "succeeded" && data.url) {
      return data.url;
    }
    if (data.status === "failed") {
      throw new Error(data.error_message ?? "Creatomate render failed");
    }
  }

  throw new Error("Creatomate render timed out");
}

async function renderOneVideo(
  apiKey: string,
  templateId: string,
  script: ScriptInput,
  imageUrl: string
): Promise<string> {
  const modifications: Record<string, string> = {
    "Headline.text": script.hook.slice(0, 200),
    "Subheadline.text": script.body.slice(0, 500),
    "CTA.text": script.cta.slice(0, 150),
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
    console.error("[digital-products/generate-videos] Creatomate error:", createRes.status, responseBody);
    let detail = responseBody.slice(0, 300);
    try {
      const err = JSON.parse(responseBody) as { message?: string; error?: string };
      detail = err.message ?? err.error ?? detail;
    } catch {
      // use raw
    }
    throw new Error(`Creatomate failed: ${detail}`);
  }

  let createData: { id?: string };
  try {
    createData = JSON.parse(responseBody);
  } catch {
    throw new Error("Creatomate returned invalid JSON");
  }

  const renderId = createData.id;
  if (!renderId) throw new Error("Creatomate did not return render id");

  return pollRenderStatus(renderId, apiKey);
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = getApiKey();
    const templateId = getTemplateId();

    if (!apiKey || !templateId) {
      return NextResponse.json(
        {
          error: "CREATOMATE_API_KEY and CREATOMATE_TEMPLATE_DIGITAL_PRODUCT (or CREATOMATE_TEMPLATE_PROMO) must be configured.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      productId,
      scripts,
      imageUrl: providedImageUrl,
    } = body as {
      productId?: string;
      scripts?: ScriptInput[];
      imageUrl?: string;
    };

    if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
      return NextResponse.json(
        { error: "scripts array is required with at least one script" },
        { status: 400 }
      );
    }

    let imageUrl = providedImageUrl && typeof providedImageUrl === "string" ? providedImageUrl : null;

    if (!imageUrl && productId) {
      const [product] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        );
      if (product?.marketingAssets && typeof product.marketingAssets === "object") {
        const ma = product.marketingAssets as { thumbnailUrl?: string };
        if (ma.thumbnailUrl) imageUrl = ma.thumbnailUrl;
      }
    }

    if (!imageUrl) imageUrl = FALLBACK_IMAGE;

    const scriptsToRender = scripts.slice(0, 3);
    const videos: { id: string; title: string; url: string; duration?: number }[] = [];

    for (const script of scriptsToRender) {
      const url = await renderOneVideo(apiKey, templateId, script, imageUrl);

      const [inserted] = await db
        .insert(videosTable)
        .values({
          userId,
          title: script.title,
          thumbnailUrl: imageUrl,
          platforms: ["tiktok", "instagram"],
          productId: productId || null,
          metadata: { videoUrl: url, duration: script.length, scriptId: script.id },
        })
        .returning();

      if (inserted?.id) {
        videos.push({
          id: inserted.id,
          title: script.title,
          url,
          duration: script.length,
        });
      } else {
        videos.push({ id: script.id, title: script.title, url, duration: script.length });
      }
    }

    return NextResponse.json({ videos });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[digital-products/generate-videos]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
