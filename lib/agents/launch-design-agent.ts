/**
 * Launch Pipeline — Design Agent (Phase 1.4)
 * ──────────────────────────────────────────────
 * Calls /api/launch/design in streaming mode and maps NDJSON events to
 * live AgentStep updates in the execution dashboard.
 *
 * The user sees each image appear as it renders:
 *   Reading product details → Generating Product Cover [image appears] →
 *   Generating 3D Mockup [image appears] → Generating Store Thumbnail →
 *   Generating Social Preview → Attaching to Digital Product ✓
 *
 * Steps carry an optional `imageUrl` field — when set, the AgentCard
 * renders the image inline below the step label.
 *
 * On completion: saves stageResults.design.{coverUrl, mockupUrl, …}
 * and advances currentStage → "marketing" at 60% overall progress.
 */

import type { ExecutionContext, AgentStep } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Asset → step mapping ───────────────────────────────────────────────────── */

const ASSET_STEPS: Array<{ assetId: string; label: string }> = [
  { assetId: "cover",     label: "Product Cover"  },
  { assetId: "mockup",    label: "3D Mockup"       },
  { assetId: "thumbnail", label: "Store Thumbnail" },
  { assetId: "social",    label: "Social Preview"  },
];

/* ─── Initial step list ──────────────────────────────────────────────────────── */

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "prep",   label: "Reading product details...", status: "running" },
    ...ASSET_STEPS.map(a => ({
      id:     `asset:${a.assetId}`,
      label:  a.label,
      status: "pending" as const,
    })),
    { id: "saving", label: "Attaching assets to Digital Product", status: "pending" },
  ];
}

/* ─── Step list helpers ──────────────────────────────────────────────────────── */

function updateStep(
  steps:  AgentStep[],
  id:     string,
  status: AgentStep["status"],
  opts?:  { label?: string; imageUrl?: string },
): AgentStep[] {
  return steps.map(s =>
    s.id === id
      ? {
          ...s,
          status,
          ...(opts?.label    !== undefined ? { label:    opts.label }    : {}),
          ...(opts?.imageUrl !== undefined ? { imageUrl: opts.imageUrl } : {}),
        }
      : s,
  );
}

function getProgress(steps: AgentStep[]): { pct: number; label: string } {
  const done    = steps.filter(s => s.status === "done").length;
  const running = steps.find(s => s.status === "running");
  const total   = steps.length;
  const pct     = Math.min(94, Math.round((done / Math.max(total, 1)) * 95) + 2);
  const label   = running?.label ?? `${done} of ${total} tasks complete`;
  return { pct, label };
}

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchDesignAgent(ctx: ExecutionContext): Promise<void> {
  const { stageResults, callbacks, saveProgress } = ctx;

  /* Pull product details from previous stage */
  const product    = stageResults.product;
  const productId  = product?.productId  ?? "";
  const productName = product?.productName ?? ctx.goal;

  /* Pull niche/format from research if available */
  const research   = stageResults.research;
  const niche      = typeof (research as Record<string, unknown> | undefined)?.query === "string"
    ? (research as { query: string }).query
    : ctx.goal;
  const format     = "guide"; // Will be read from product record server-side

  if (!productId) {
    throw new Error("Design Agent: no productId in stageResults — run Product Agent first");
  }

  let steps = buildInitialSteps();
  callbacks.onStep([...steps]);
  callbacks.onProgress(2, "Starting design agent...");

  const setStep = (
    id:     string,
    status: AgentStep["status"],
    opts?:  { label?: string; imageUrl?: string },
  ): void => {
    steps = updateStep(steps, id, status, opts);
    callbacks.onStep([...steps]);
    const { pct, label } = getProgress(steps);
    callbacks.onProgress(pct, label);
  };

  /* ── Call streaming design API ── */
  const res = await fetch("/api/launch/design", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ productId, productName, niche, format }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Design API returned ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const generatedAssets: Record<string, string> = {};
  let assetsCount = 0;

  streamLoop: while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed) as Record<string, unknown>;
      } catch { continue; }

      switch (event.type as string) {

        /* ── Standard step lifecycle ── */
        case "step": {
          setStep(event.id as string, "running", { label: event.label as string | undefined });
          break;
        }

        case "step-done": {
          setStep(event.id as string, "done");
          break;
        }

        /* ── Asset generation started ── */
        case "asset-generating": {
          const assetId = event.assetId as string;
          setStep(`asset:${assetId}`, "running", {
            label: `Generating ${event.label as string}...`,
          });
          break;
        }

        /* ── Asset ready — show image immediately ── */
        case "asset-done": {
          const assetId = event.assetId as string;
          const url     = event.url as string;
          generatedAssets[assetId] = url;
          setStep(`asset:${assetId}`, "done", {
            label:    event.label as string,
            imageUrl: url,
          });
          break;
        }

        /* ── Asset failed (non-fatal) ── */
        case "asset-error": {
          const assetId = event.assetId as string;
          setStep(`asset:${assetId}`, "error", {
            label: `${event.label as string} — failed`,
          });
          break;
        }

        /* ── All done ── */
        case "done": {
          assetsCount = event.assetsCount as number ?? Object.keys(generatedAssets).length;

          callbacks.onProgress(98, "Saving design results...");

          const stageResultsPatch: Partial<LaunchStageResults> = {
            design: {
              coverUrl:     generatedAssets.cover,
              mockupUrl:    generatedAssets.mockup,
              thumbnailUrl: generatedAssets.thumbnail,
              socialUrl:    generatedAssets.social,
              assetsCount,
            },
          };

          await saveProgress({
            currentStage: "marketing",
            progress:     60,
            stageResults: stageResultsPatch,
          });

          callbacks.onProgress(100, "Design assets created ✓");
          break streamLoop;
        }

        case "error": {
          throw new Error(
            `Design error: ${typeof event.message === "string" ? event.message : "Unknown"}`
          );
        }
      }
    }
  }

  if (assetsCount === 0 && Object.keys(generatedAssets).length === 0) {
    throw new Error("Design stream ended without generating any assets");
  }
}
