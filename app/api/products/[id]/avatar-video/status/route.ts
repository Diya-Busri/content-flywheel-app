export const dynamic = "force-dynamic";
/**
 * Avatar Promo Video — Poll Status
 * GET /api/products/[id]/avatar-video/status?videoId=xxx&provider=falai|did|heygen
 *
 * Routes to the correct provider status check.
 * When complete, saves videoUrl to product.marketingAssets.promoVideoUrl.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkFalStatus } from "@/lib/avatar-video/fal-provider";
import { checkDIDStatus } from "@/lib/avatar-video/did-provider";
import type { AvatarVideoProvider } from "@/lib/avatar-video/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const HEYGEN_BASE = "https://api.heygen.com";

async function checkHeyGenStatus(videoId: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const apiKey = process.env.HEYGEN_API_KEY?.trim();
  if (!apiKey) return { status: "failed", error: "HEYGEN_API_KEY not set" };

  const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
    headers: { "X-Api-Key": apiKey },
  });
  if (!res.ok) return { status: "processing" };

  const raw = (await res.json()) as Record<string, unknown>;
  const dataObj = (raw.data ?? raw) as Record<string, unknown>;
  const inner = (dataObj?.data ?? dataObj) as Record<string, unknown>;
  const status = String(inner?.status ?? dataObj?.status ?? "processing");

  if (status === "completed") {
    const url = (inner?.video_url ?? dataObj?.video_url) as string | undefined;
    if (url) return { status: "completed", videoUrl: url };
  }
  if (status === "failed") {
    const errVal = inner?.error ?? dataObj?.error;
    const msg = errVal && typeof errVal === "object" && "message" in errVal
      ? (errVal as { message?: string }).message
      : typeof errVal === "string" ? errVal : "HeyGen generation failed";
    return { status: "failed", error: msg };
  }
  return { status: "processing" };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: productId } = await params;
    const videoId = request.nextUrl.searchParams.get("videoId")?.trim();
    const providerParam = (request.nextUrl.searchParams.get("provider") ?? "heygen") as AvatarVideoProvider;

    if (!productId || !videoId) {
      return NextResponse.json({ error: "productId and videoId required" }, { status: 400 });
    }

    // Verify ownership
    const [product] = await db
      .select({ id: productsTable.id, marketingAssets: productsTable.marketingAssets })
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Route to correct provider
    let result: { status: string; videoUrl?: string; error?: string };

    if (providerParam === "falai") {
      const r = await checkFalStatus(videoId);
      result = r.status === "completed"
        ? { status: "completed", videoUrl: r.videoUrl }
        : r.status === "failed"
        ? { status: "failed", error: r.error }
        : { status: "processing" };
    } else if (providerParam === "did") {
      const r = await checkDIDStatus(videoId);
      result = r.status === "completed"
        ? { status: "completed", videoUrl: r.videoUrl }
        : r.status === "failed"
        ? { status: "failed", error: r.error }
        : { status: "processing" };
    } else {
      result = await checkHeyGenStatus(videoId);
    }

    // Persist completed video URL
    if (result.status === "completed" && result.videoUrl) {
      const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
      await db.update(productsTable).set({
        marketingAssets: {
          ...currentAssets,
          promoVideoUrl: result.videoUrl,
          promoVideoId: videoId,
          promoVideoStatus: "completed",
        },
        updatedAt: new Date(),
      }).where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

      return NextResponse.json({ status: "completed", videoUrl: result.videoUrl });
    }

    if (result.status === "failed") {
      const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
      await db.update(productsTable).set({
        marketingAssets: { ...currentAssets, promoVideoStatus: "failed" },
        updatedAt: new Date(),
      }).where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)));

      return NextResponse.json({ status: "failed", error: result.error });
    }

    return NextResponse.json({ status: "processing" });
  } catch (err) {
    console.error("[avatar-video/status]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Status check failed" }, { status: 500 });
  }
}
