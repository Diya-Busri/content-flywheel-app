/**
 * PATCH /api/jarvis/runs/[runId]/assets/[assetId] — edit a generated asset's
 * content before approving it. Only allowed while the run is sitting at the
 * asset_review gate (status "awaiting_approval", current_gate "asset_review")
 * — editing after approval/save is rejected, not silently ignored.
 *
 * Body: { patch: { ...only the fields relevant to this asset's type } }
 * Unknown fields are rejected (strict schema); fields that don't apply to
 * this asset's type are ignored rather than erroring, so the client can
 * always send the same shape without checking type first.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { getRunForUser, updateAssetsIfInAssetReview } from "@/lib/jarvis/run-store";
import type { ProposedAsset } from "@/db/schema/jarvis-schema";

const patchSchema = z
  .object({
    // video_script
    title: z.string().min(1).max(200).optional(),
    hook: z.string().min(1).max(400).optional(),
    script: z.string().min(1).max(4000).optional(),
    cta: z.string().min(1).max(300).optional(),
    // carousel
    slides: z.array(z.string().min(1).max(300)).min(1).max(10).optional(),
    caption: z.string().min(1).max(1000).optional(),
    hashtags: z.array(z.string().min(1).max(40)).max(15).optional(),
    // email
    name: z.string().min(1).max(200).optional(),
    subject: z.string().min(1).max(200).optional(),
    previewText: z.string().min(1).max(200).optional(),
    bodyHtml: z.string().min(1).max(8000).optional(),
  })
  .strict();

const bodySchema = z.object({ patch: patchSchema }).strict();

function applyPatch(asset: ProposedAsset, patch: z.infer<typeof patchSchema>): ProposedAsset {
  if (asset.type === "video_script") {
    return {
      ...asset,
      title: patch.title ?? asset.title,
      hook: patch.hook ?? asset.hook,
      script: patch.script ?? asset.script,
      cta: patch.cta ?? asset.cta,
      edited: true,
    };
  }
  if (asset.type === "carousel") {
    return {
      ...asset,
      title: patch.title ?? asset.title,
      slides: patch.slides ?? asset.slides,
      caption: patch.caption ?? asset.caption,
      hashtags: patch.hashtags ?? asset.hashtags,
      edited: true,
    };
  }
  return {
    ...asset,
    name: patch.name ?? asset.name,
    subject: patch.subject ?? asset.subject,
    previewText: patch.previewText ?? asset.previewText,
    bodyHtml: patch.bodyHtml ?? asset.bodyHtml,
    edited: true,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; assetId: string }> },
) {
  try {
    const [userId, unauthorized] = await requireAuth();
    if (unauthorized) return unauthorized;

    const { runId, assetId } = await params;

    const run = await getRunForUser(userId, runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    if (run.status !== "awaiting_approval" || run.currentGate !== "asset_review") {
      return NextResponse.json(
        { error: "This run's assets can only be edited while awaiting approval." },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: `Invalid edit: ${parsed.error.message}` }, { status: 400 });
    }

    const assets = run.assets;
    const index = assets.findIndex((a) => a.id === assetId);
    if (index === -1) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    if (assets[index]!.status === "saved") {
      return NextResponse.json({ error: "This asset has already been saved and can no longer be edited." }, { status: 409 });
    }

    const updatedAssets = [...assets];
    updatedAssets[index] = applyPatch(assets[index]!, parsed.data.patch);

    const updated = await updateAssetsIfInAssetReview(userId, runId, updatedAssets);
    if (!updated) {
      return NextResponse.json(
        { error: "This run moved past asset review while editing — refresh and try again." },
        { status: 409 },
      );
    }

    return NextResponse.json({ run: updated });
  } catch (err) {
    console.error("[jarvis/runs/:id/assets/:assetId PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
