/**
 * Generate TikTok-style promotional videos using Shotstack Edit API.
 * POST body: { productId?, scripts: [{ id, title, length, hook, body, cta }] }
 * Uses Shotstack stage (sandbox, free, watermarked) or v1 (production, credits).
 * Route: app/api/generate-video/route.ts (App Router)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { getShotstackApiKey } from "@/lib/shotstack-edit";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1920&fit=crop";

/** Shotstack must fetch images from a public URL. localhost, blob:, data: and private storage URLs will fail. */
function getPublicImageUrl(url: string): string {
  if (!url || typeof url !== "string") return FALLBACK_IMAGE;
  const u = url.trim().toLowerCase();
  if (u.startsWith("blob:") || u.startsWith("data:")) return FALLBACK_IMAGE;
  if (u.includes("localhost") || u.includes("127.0.0.1")) return FALLBACK_IMAGE;
  if (!u.startsWith("https://") && !u.startsWith("http://")) return FALLBACK_IMAGE;
  return url.trim();
}

type ScriptInput = {
  id: string;
  title: string;
  length: number;
  hook: string;
  body: string;
  cta: string;
};

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    console.log("=== GENERATE VIDEO CALLED ===");
    console.log("KEY 1:", !!process.env.SHOTSTACK_API_KEY_SANDBOX);
    console.log("KEY 2:", !!process.env.SHOTSTACK_SANDBOX_API_KEY);

    const body = await request.json().catch((e) => {
      console.error("[generate-video] JSON parse error:", e);
      return {};
    });
    console.log("[generate-video] Body:", JSON.stringify(body));

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = getShotstackApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "SHOTSTACK_API_KEY_SANDBOX is not configured." },
        { status: 503 }
      );
    }

    const filePath = `${process.cwd()}/app/api/generate-video/route.ts`;
    console.log("[generate-video] File path:", filePath);

    const {
      productId,
      scripts,
      imageUrl: providedImageUrl,
    } = body as { productId?: string; scripts?: ScriptInput[]; imageUrl?: string };

    if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
      return NextResponse.json(
        { error: "scripts array is required with at least one script" },
        { status: 400 }
      );
    }

    let imageUrl: string | null =
      typeof providedImageUrl === "string" && providedImageUrl.trim()
        ? providedImageUrl.trim()
        : null;

    let product: { marketingAssets?: unknown } | null = null;
    if (!imageUrl && productId) {
      const [p] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, productId),
            eq(productsTable.userId, userId),
            isNull(productsTable.deletedAt)
          )
        );
      product = p ?? null;
      if (product?.marketingAssets && typeof product.marketingAssets === "object") {
        const ma = product.marketingAssets as { thumbnailUrl?: string };
        imageUrl = ma.thumbnailUrl ?? null;
      }
      if (product) {
        console.log("[generate-video] Product data:", JSON.stringify(product, null, 2));
      }
    }

    // Only use image if we have a valid public HTTPS URL. Never send undefined to Shotstack.
    const resolved = imageUrl ? getPublicImageUrl(imageUrl) : null;
    const finalImageUrl =
      resolved && resolved.startsWith("https://") && resolved !== FALLBACK_IMAGE
        ? resolved
        : imageUrl && imageUrl.trim().toLowerCase().startsWith("https://") && !imageUrl.toLowerCase().includes("localhost")
          ? imageUrl.trim()
          : null;

    console.log("[generate-video] Product thumbnail URL:", imageUrl ?? "(none)");
    console.log("[generate-video] Final image URL sent to Shotstack:", finalImageUrl ?? "(text-only, no image)");

    const testPayload = {
      timeline: {
        background: "#000000",
        tracks: [
          {
            clips: [
              {
                asset: { type: "title", text: "Test Video", style: "blockbuster" },
                start: 0,
                length: 5,
              },
            ],
          },
        ],
      },
      output: { format: "mp4", fps: 25, size: { width: 1080, height: 1920 } },
    };

    console.log("[generate-video] Shotstack minimal test payload:", JSON.stringify(testPayload, null, 2));

    const shotstackRes = await fetch("https://api.shotstack.io/edit/stage/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(testPayload),
    });

    const responseBody = await shotstackRes.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseBody);
    } catch {
      responseData = responseBody;
    }

    console.log("[generate-video] Shotstack response status:", shotstackRes.status);
    console.log("[generate-video] Shotstack full response:", JSON.stringify(responseData, null, 2));

    return NextResponse.json({
      test: true,
      shotstackStatus: shotstackRes.status,
      shotstackResponse: responseData,
      message: shotstackRes.ok
        ? "Minimal test succeeded - API key works. Check terminal for render ID, then poll for video URL."
        : "Minimal test failed - check API key and response above.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    console.error("[generate-video] Video generation error:", message);
    console.error("[generate-video] Stack:", err instanceof Error ? err.stack : "(no stack)");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
