import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { ugcCampaignProductsTable } from "@/db/schema/ugc-campaigns-schema";
import { eq, and, asc } from "drizzle-orm";
import { generateScriptForAngle } from "@/lib/ugc/generate-script-variations";
import { generateRankingScript } from "@/lib/ugc/generate-ranking-script";
import { selectDistinctAngles } from "@/lib/ugc/angle-engine";
import { isRankingTemplate } from "@/lib/ugc/ranking-templates";
import { UGC_TEMPLATES } from "@/lib/ugc/templates";
import { RANKING_TEMPLATES, getRankingDurationSeconds } from "@/lib/ugc/ranking-templates";

export type RegenerateMode = "video_only" | "script" | "angle_and_script";

/**
 * POST: Regenerate a variation. Creates a NEW job—never overwrites.
 * Body: { mode: "video_only" | "script" | "angle_and_script", productContext?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: parentId } = await params;

    const [parent] = await db
      .select()
      .from(videoJobsTable)
      .where(
        and(
          eq(videoJobsTable.id, parentId),
          eq(videoJobsTable.userId, userId)
        )
      )
      .limit(1);

    if (!parent) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const mode = (body.mode as RegenerateMode) ?? "video_only";
    const productContext = (body.productContext as string) ?? undefined;

    let productCount = 1;
    let campaignProducts: { productName: string; role: "primary" | "comparison"; orderIndex: number }[] = [];
    if (parent.campaignId) {
      const products = await db
        .select()
        .from(ugcCampaignProductsTable)
        .where(eq(ugcCampaignProductsTable.campaignId, parent.campaignId))
        .orderBy(asc(ugcCampaignProductsTable.orderIndex));
      productCount = Math.max(1, products.length);
      campaignProducts = products.map((p) => ({
        productName: p.productName,
        role: p.role as "primary" | "comparison",
        orderIndex: p.orderIndex,
      }));
    }

    const ugcTemplate = parent.templateId
      ? UGC_TEMPLATES.find((t) => t.id === parent.templateId)
      : UGC_TEMPLATES[0];
    const rankingTemplate = parent.templateId
      ? RANKING_TEMPLATES.find((t) => t.id === parent.templateId)
      : undefined;
    const durationSeconds = rankingTemplate
      ? getRankingDurationSeconds(rankingTemplate, productCount)
      : (ugcTemplate?.duration ?? 30);
    const scriptOptions =
      campaignProducts.length > 0
        ? { products: campaignProducts, durationSeconds }
        : { durationSeconds };

    const validModes: RegenerateMode[] = ["video_only", "script", "angle_and_script"];
    if (!validModes.includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    let fullScript: string;
    let hookPreview: string;
    let angleType: string | null;
    let scriptId: string;

    if (mode === "video_only") {
      fullScript = parent.fullScript;
      hookPreview = parent.hookPreview;
      angleType = parent.angleType;
      scriptId = parent.scriptId ?? crypto.randomUUID(); // same script
    } else if (mode === "script") {
      scriptId = crypto.randomUUID();
      const angle = parent.angleType ?? "pain_focused";
      if (isRankingTemplate(parent.templateId) && campaignProducts.length >= 2) {
        const formatId = (parent as { formatId?: string }).formatId ?? rankingTemplate?.formatId;
        const script = generateRankingScript(campaignProducts, durationSeconds, formatId);
        fullScript = script.fullScript;
        hookPreview = script.hookPreview;
        angleType = "ranking";
      } else {
        const script = generateScriptForAngle(angle, productContext, scriptOptions);
        fullScript = script.fullScript;
        hookPreview = script.hookPreview;
        angleType = angle;
      }
    } else {
      scriptId = crypto.randomUUID();
      if (isRankingTemplate(parent.templateId) && campaignProducts.length >= 2) {
        const formatId = (parent as { formatId?: string }).formatId ?? rankingTemplate?.formatId;
        const script = generateRankingScript(campaignProducts, durationSeconds, formatId);
        fullScript = script.fullScript;
        hookPreview = script.hookPreview;
        angleType = "ranking";
      } else {
        const [newAngle] = selectDistinctAngles(1, productCount);
        const script = generateScriptForAngle(newAngle.angle_type, productContext, scriptOptions);
        fullScript = script.fullScript;
        hookPreview = script.hookPreview;
        angleType = newAngle.angle_type;
      }
    }

    const [newJob] = await db
      .insert(videoJobsTable)
      .values({
        userId,
        campaignId: parent.campaignId ?? null,
        batchId: parent.batchId,
        parentJobId: parentId,
        templateId: parent.templateId,
        formatId: (parent as { formatId?: string }).formatId ?? undefined,
        faceProfileId: parent.faceProfileId,
        angleType,
        scriptId,
        fullScript,
        hookPreview,
        status: "pending",
        progress: "0",
      })
      .returning({ id: videoJobsTable.id });

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    fetch(`${base}/api/ugc-lab/process-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: newJob.id, userId }),
    }).catch((e) => console.error("[regenerate] process-job trigger failed:", e));

    return NextResponse.json({ jobId: newJob.id, batchId: parent.batchId });
  } catch (err) {
    console.error("[video-jobs/:id/regenerate] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regenerate failed" },
      { status: 500 }
    );
  }
}
