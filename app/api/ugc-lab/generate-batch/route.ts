import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkVideoCredits, deductVideoCredit } from "@/actions/video-credits-actions";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, asc } from "drizzle-orm";
import { generateScriptVariations } from "@/lib/ugc/generate-script-variations";
import { generateRankingScript } from "@/lib/ugc/generate-ranking-script";
import { UGC_TEMPLATES } from "@/lib/ugc/templates";
import {
  RANKING_TEMPLATES,
  getRankingDurationSeconds,
} from "@/lib/ugc/ranking-templates";

const MIN_PRODUCTS = 1;
const MAX_PRODUCTS = 5;

/** Minimal pipeline: single job only, fixed template, requires face profile. */
const UGC_SINGLE_TEMPLATE_ID = "selfie-talk";

/**
 * POST: Start generation (single job for minimal pipeline).
 * Requires face profile + product context. Uses fixed selfie-talk template.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const { hasCredits, balance } = await checkVideoCredits("avatarVideo");
    if (!hasCredits) {
      return NextResponse.json(
        { error: "You need video credits to generate a video.", code: "NO_VIDEO_CREDITS", balance, redirectTo: "/dashboard/video-credits" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const faceProfileId = (body.faceProfileId as string)?.trim() || undefined;
    const productContext = (body.productContext as string) ?? undefined;

    if (!faceProfileId) {
      return NextResponse.json(
        { error: "Face profile is required. Select or upload a face photo." },
        { status: 400 }
      );
    }

    if (
      !process.env.FACESWAP_API_KEY?.trim() &&
      !process.env.REMAKER_API_KEY?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "FACESWAP_API_KEY or REMAKER_API_KEY is not set. Add it to .env.local for FaceSwap.",
        },
        { status: 503 }
      );
    }
    if (!process.env.FACESWAP_TEMPLATE_VIDEO_URL?.trim()) {
      return NextResponse.json(
        {
          error:
            "FACESWAP_TEMPLATE_VIDEO_URL is not set. Add template video URL in .env.local for FaceSwap.",
        },
        { status: 503 }
      );
    }

    // Minimal pipeline: single job, fixed template
    const templateId = UGC_SINGLE_TEMPLATE_ID;
    const campaignId = undefined;
    const variationCount = 1;
    const hookStyle = (body.hookStyle as string)?.trim() || undefined;
    const tone = (body.tone as string)?.trim() || undefined;
    const formatIdOverride = (body.formatId as string)?.trim() || undefined;

    let productCount = 1;
    let campaignProducts: { productName: string; role: "primary" | "comparison"; orderIndex: number }[] = [];

    if (campaignId) {
      const products = await db
        .select()
        .from(ugcCampaignProductsTable)
        .where(eq(ugcCampaignProductsTable.campaignId, campaignId))
        .orderBy(asc(ugcCampaignProductsTable.orderIndex));

      if (products.length < MIN_PRODUCTS) {
        return NextResponse.json(
          { error: `Campaign must have at least ${MIN_PRODUCTS} product` },
          { status: 400 }
        );
      }
      if (products.length > MAX_PRODUCTS) {
        return NextResponse.json(
          { error: `Campaign cannot exceed ${MAX_PRODUCTS} products` },
          { status: 400 }
        );
      }
      const primaryCount = products.filter((p) => p.role === "primary").length;
      if (primaryCount !== 1) {
        return NextResponse.json(
          { error: "Campaign must have exactly one product marked as PRIMARY" },
          { status: 400 }
        );
      }

      productCount = products.length;
      campaignProducts = products.map((p) => ({
        productName: p.productName,
        role: p.role as "primary" | "comparison",
        orderIndex: p.orderIndex,
      }));
    }

    const ugcTemplate = templateId
      ? UGC_TEMPLATES.find((t) => t.id === templateId)
      : UGC_TEMPLATES[0];
    const rankingTemplate = templateId
      ? RANKING_TEMPLATES.find((t) => t.id === templateId)
      : undefined;
    const durationSeconds = rankingTemplate
      ? getRankingDurationSeconds(rankingTemplate, productCount)
      : (ugcTemplate?.duration ?? 30);

    const isRankingMode = Boolean(rankingTemplate && campaignProducts.length >= 2);
    const rankingConfirmed = Boolean(body.rankingConfirmed);

    if (isRankingMode && !rankingConfirmed) {
      return NextResponse.json(
        { error: "Confirm ranking order before generating" },
        { status: 400 }
      );
    }

    let variations: { fullScript: string; hookPreview: string; angle?: { angle_type: string } }[];

    if (isRankingMode) {
      const formatId = formatIdOverride ?? rankingTemplate?.formatId;
      const { fullScript, hookPreview } = generateRankingScript(
        campaignProducts.map((p) => ({ productName: p.productName, role: p.role, orderIndex: p.orderIndex })),
        durationSeconds,
        formatId
      );
      variations = [{ fullScript, hookPreview, angle: { angle_type: "ranking" } }];
    } else {
      const hookOptions = (hookStyle || tone) ? { hookStyle, tone } : undefined;
      const scriptOptions =
        campaignProducts.length > 0
          ? { products: campaignProducts, durationSeconds }
          : { durationSeconds };
      variations = generateScriptVariations(
        productContext,
        variationCount,
        productCount,
        hookOptions,
        scriptOptions
      );
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const jobs = await db
      .insert(videoJobsTable)
      .values(
        variations.map((v) => ({
          userId,
          campaignId: campaignId ?? null,
          batchId,
          templateId,
          formatId: isRankingMode ? (formatIdOverride ?? rankingTemplate?.formatId ?? null) : null,
          faceProfileId,
          provider: "faceswap",
          angleType: v.angle?.angle_type ?? null,
          scriptId: crypto.randomUUID(),
          fullScript: v.fullScript,
          hookPreview: v.hookPreview,
          status: "pending",
          progress: "0",
        }))
      )
      .returning({ id: videoJobsTable.id });

    const jobIds = jobs.map((j) => j.id).filter(Boolean);

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const processUrl = `${base}/api/ugc-lab/process-job`;
    for (const id of jobIds) {
      fetch(processUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, userId }),
      }).catch((e) => console.error("[generate-batch] process-job trigger failed:", id, e));
    }

    await deductVideoCredit("avatarVideo").catch((e) => console.error("[generate-batch] credit deduction failed:", e));
    return NextResponse.json({ batchId, jobIds });
  } catch (err) {
    console.error("[generate-batch] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch generation failed" },
      { status: 500 }
    );
  }
}
