/**
 * POST /api/video/generate
 * Accepts: { hook, body, cta, productImageUrl?, productId? }
 * Builds Shotstack edit and returns render ID for polling.
 * Uses SHOTSTACK_API_KEY (production) or SHOTSTACK_API_KEY_SANDBOX (stage).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

const SHOTSTACK_STAGE = "https://api.shotstack.io/edit/stage";
const SHOTSTACK_PROD = "https://api.shotstack.io/edit/v1";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&fit=crop";

function getApiKey(): string | null {
  const stage = process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() || process.env.SHOTSTACK_SANDBOX_API_KEY?.trim();
  const prod = process.env.SHOTSTACK_API_KEY?.trim();
  return stage || prod || null;
}

function getBaseUrl(): string {
  return process.env.SHOTSTACK_API_KEY?.trim() && !process.env.SHOTSTACK_API_KEY_SANDBOX?.trim() && !process.env.SHOTSTACK_SANDBOX_API_KEY?.trim()
    ? SHOTSTACK_PROD
    : SHOTSTACK_STAGE;
}

function buildShotstackEdit(
  hook: string,
  body: string,
  cta: string,
  productImageUrl: string
): Record<string, unknown> {
  const h = (hook || "").slice(0, 200).trim() || "Your hook";
  const b = (body || "").slice(0, 500).trim() || "Your message";
  const c = (cta || "").slice(0, 150).trim() || "Link in bio";

  return {
    timeline: {
      background: "#000000",
      tracks: [
        {
          clips: [
            {
              asset: { type: "image", src: productImageUrl },
              start: 0,
              length: 30,
              fit: "cover",
            },
          ],
        },
        {
          clips: [
            {
              asset: {
                type: "shape",
                shape: "rectangle",
                fill: { color: "#000000", opacity: 0.5 },
                rectangle: { width: 1080, height: 1920 },
              },
              start: 0,
              length: 30,
            },
          ],
        },
        {
          clips: [
            {
              asset: {
                type: "title",
                text: h,
                style: "blockbuster",
                color: "#ffffff",
                size: "large",
                position: "center",
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
                text: b,
                style: "skinny",
                color: "#ffffff",
                size: "medium",
                position: "center",
              },
              start: 5,
              length: 15,
              transition: { in: "fade" },
            },
          ],
        },
        {
          clips: [
            {
              asset: {
                type: "title",
                text: c,
                style: "blockbuster",
                color: "#FFD700",
                size: "large",
                position: "center",
              },
              start: 20,
              length: 10,
              transition: { in: "fade" },
            },
          ],
        },
      ],
    },
    output: {
      format: "mp4",
      fps: 25,
      size: { width: 1080, height: 1920 },
    },
  };
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "SHOTSTACK_API_KEY or SHOTSTACK_API_KEY_SANDBOX is not configured." },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { hook, body: bodyText, cta, productImageUrl: providedImageUrl, productId } = body as {
      hook?: string;
      body?: string;
      cta?: string;
      productImageUrl?: string;
      productId?: string;
    };

    let imageUrl: string =
      typeof providedImageUrl === "string" && providedImageUrl.trim()
        ? providedImageUrl.trim()
        : "";

    if (!imageUrl && productId && userId) {
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

    if (!imageUrl || !imageUrl.startsWith("https://") || imageUrl.includes("localhost")) {
      imageUrl = FALLBACK_IMAGE;
    }

    const edit = buildShotstackEdit(
      hook || "",
      bodyText || "",
      cta || "",
      imageUrl
    );

    const base = getBaseUrl();
    const createRes = await fetch(`${base}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(edit),
    });

    const resBody = await createRes.text();
    let data: { success?: boolean; response?: { id?: string; message?: string } };
    try {
      data = JSON.parse(resBody);
    } catch {
      return NextResponse.json(
        { error: `Shotstack returned invalid JSON: ${resBody.slice(0, 200)}` },
        { status: 500 }
      );
    }

    if (!createRes.ok) {
      const msg = data.response?.message || resBody.slice(0, 300);
      return NextResponse.json(
        { error: `Shotstack error: ${msg}` },
        { status: createRes.status }
      );
    }

    const renderId = data.response?.id;
    if (!renderId) {
      return NextResponse.json(
        { error: "Shotstack did not return render ID" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      renderId,
      status: "queued",
      message: "Render started. Poll /api/video/status/[id] for progress.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[video/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
