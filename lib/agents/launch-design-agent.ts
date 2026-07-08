/**
 * Launch Pipeline — Design Agent (Phase 1.4b)
 * ──────────────────────────────────────────────
 * Calls /api/launch/design in streaming mode and maps NDJSON events to
 * live AgentStep updates in the execution dashboard.
 *
 * Phase 1: 3 cover concepts generated in parallel (Minimal, Bold, Dark)
 * Phase 2: Mockup, Thumbnail, Social — sequential
 * Phase 3: Instagram carousel auto-created in Design Studio
 *
 * On completion: saves stageResults.design with concepts[], carouselBundleId,
 * and advances currentStage → "marketing" at 60%.
 */

import type { ExecutionContext, AgentStep } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Initial step list ──────────────────────────────────────────────────────── */

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "prep",      label: "Reading product details...",        status: "running" },
    { id: "concepts",  label: "Product Cover — 3 styles",          status: "pending" },
    { id: "asset:mockup",    label: "3D Mockup",                   status: "pending" },
    { id: "asset:thumbnail", label: "Store Thumbnail",             status: "pending" },
    { id: "asset:social",    label: "Social Preview",              status: "pending" },
    { id: "carousel",        label: "Instagram Carousel",          status: "pending" },
    { id: "saving",          label: "Attaching assets to product", status: "pending" },
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
  const product     = stageResults.product;
  const productId   = product?.productId  ?? "";
  const productName = product?.productName ?? ctx.goal;

  /* Pull niche/format from research if available */
  const research = stageResults.research;
  const niche    = typeof (research as Record<string, unknown> | undefined)?.query === "string"
    ? (research as { query: string }).query
    : ctx.goal;
  const format   = "guide";

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
  const concepts: Array<{ style: string; label: string; url: string }> = [];
  let assetsCount     = 0;
  let carouselBundleId: string | undefined;

  /** Map cover concept imageUrl to the "concepts" step, using last received URL */
  let latestConceptUrl: string | undefined;

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
      try { event = JSON.parse(trimmed) as Record<string, unknown>; }
      catch { continue; }

      switch (event.type as string) {

        /* ── Standard step lifecycle ── */
        case "step": {
          const stepId = event.id as string;
          const label  = event.label as string | undefined;
          setStep(stepId, "running", { label });
          break;
        }

        case "step-done": {
          const stepId = event.id as string;
          if (stepId === "carousel" && event.bundleId) {
            carouselBundleId = event.bundleId as string;
            setStep("carousel", "done", { label: "Instagram Carousel ✓" });
          } else {
            setStep(stepId, "done");
          }
          break;
        }

        /* ── Asset generating ── */
        case "asset-generating": {
          const assetId = event.assetId as string;

          if (assetId.startsWith("cover:")) {
            // Already in "running" from the "concepts" step event
          } else {
            setStep(`asset:${assetId}`, "running", {
              label: `Generating ${event.label as string}...`,
            });
          }
          break;
        }

        /* ── Asset ready ── */
        case "asset-done": {
          const assetId     = event.assetId as string;
          const url         = event.url as string;

          if (assetId.startsWith("cover:")) {
            // Accumulate concepts; update the concepts step with latest image
            latestConceptUrl = url;
            concepts.push({
              style: (event.conceptStyle as string) ?? assetId.split(":")[1],
              label: event.label as string,
              url,
            });
            generatedAssets[assetId] = url;
            // Update concepts step image with the first concept that arrives
            if (concepts.length === 1) {
              setStep("concepts", "running", { imageUrl: url, label: "Product Cover — 3 styles" });
            } else {
              // Update imageUrl to latest
              setStep("concepts", "running", { imageUrl: url });
            }
          } else {
            generatedAssets[assetId] = url;
            setStep(`asset:${assetId}`, "done", {
              label:    event.label as string,
              imageUrl: url,
            });
          }
          break;
        }

        /* ── Asset failed (non-fatal) ── */
        case "asset-error": {
          const assetId = event.assetId as string;
          if (assetId.startsWith("cover:")) {
            // Non-fatal — other concepts may succeed
          } else {
            setStep(`asset:${assetId}`, "error", {
              label: `${event.label as string} — failed`,
            });
          }
          break;
        }

        /* ── All done ── */
        case "done": {
          assetsCount      = (event.assetsCount as number) ?? Object.keys(generatedAssets).length;
          carouselBundleId = carouselBundleId ?? (event.carouselBundleId as string | undefined);

          const eventConcepts = event.concepts as Array<{ style: string; label: string; url: string }> | undefined;
          if (Array.isArray(eventConcepts)) {
            // Use the server's authoritative list
            concepts.length = 0;
            concepts.push(...eventConcepts);
          }

          // Mark concepts step done with last concept image
          if (latestConceptUrl) {
            setStep("concepts", "done", { imageUrl: latestConceptUrl });
          } else {
            setStep("concepts", "done");
          }

          callbacks.onProgress(98, "Saving design results...");

          const firstConceptUrl = concepts[0]?.url;

          const stageResultsPatch: Partial<LaunchStageResults> = {
            design: {
              coverUrl:         firstConceptUrl,
              mockupUrl:        generatedAssets.mockup,
              thumbnailUrl:     generatedAssets.thumbnail,
              socialUrl:        generatedAssets.social,
              assetsCount,
              completedAt:      new Date().toISOString(),
              concepts:         concepts.length > 0 ? concepts : undefined,
              selectedConceptUrl: firstConceptUrl,
              carouselBundleId: carouselBundleId,
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
