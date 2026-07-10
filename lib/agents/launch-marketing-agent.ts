/**
 * Launch Pipeline — Marketing Agent (Phase 1.5)
 * ─────────────────────────────────────────────────
 * Calls /api/launch/marketing in streaming NDJSON mode and maps events to:
 *   - Live AgentStep updates (checklist items in the agent card)
 *   - FolderAssetItem callbacks (campaign folder view)
 *
 * The user sees content appearing one by one:
 *   Reading product details → Analysing audience →
 *   Writing launch campaign [9 assets stream in] →
 *   Generating social media [40 posts stream in] →
 *   Drafting email campaigns [5 emails stream in] →
 *   Saving to marketing library ✓
 *
 * On completion: saves stageResults.marketing + advances to "store" at 80%.
 */

import type { ExecutionContext, AgentStep, FolderAssetItem } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { validateMarketing } from "@/lib/launch-validator";

/* ─── Step definition ────────────────────────────────────────────────────────── */

const MARKETING_STEPS: Array<{ id: string; label: string }> = [
  { id: "read-context",    label: "Reading product & research..."      },
  { id: "audience",        label: "Analysing audience & positioning..." },
  { id: "launch-content",  label: "Writing launch campaign..."         },
  { id: "social-content",  label: "Generating social media content..."  },
  { id: "email-content",   label: "Drafting email campaigns..."         },
  { id: "saving",          label: "Saving to marketing library..."      },
];

function buildInitialSteps(): AgentStep[] {
  return MARKETING_STEPS.map((s, i) => ({
    id:     s.id,
    label:  s.label,
    status: i === 0 ? "running" : "pending",
  }));
}

/* ─── Step helpers ───────────────────────────────────────────────────────────── */

function updateStep(
  steps:  AgentStep[],
  id:     string,
  status: AgentStep["status"],
  opts?:  { label?: string; preview?: string },
): AgentStep[] {
  return steps.map(s =>
    s.id === id
      ? {
          ...s,
          status,
          ...(opts?.label   !== undefined ? { label:   opts.label   } : {}),
          ...(opts?.preview !== undefined ? { preview: opts.preview } : {}),
        }
      : s,
  );
}

function getProgress(steps: AgentStep[]): { pct: number; label: string } {
  const done    = steps.filter(s => s.status === "done").length;
  const running = steps.find(s   => s.status === "running");
  const total   = steps.length;
  const pct     = Math.min(95, Math.round((done / Math.max(total, 1)) * 95) + 2);
  const label   = running?.label ?? `${done} of ${total} tasks complete`;
  return { pct, label };
}

/* ─── Category asset counters (for preview labels) ──────────────────────────── */

interface AssetCounts {
  launch: number;
  social: number;
  email:  number;
}

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchMarketingAgent(ctx: ExecutionContext): Promise<void> {
  const { stageResults, callbacks, saveProgress } = ctx;

  /* ── Extract context from previous stages ── */
  const product     = stageResults.product;
  const productId   = product?.productId   ?? "";
  const productName = product?.productName ?? ctx.goal;

  const research = stageResults.research;

  if (!productId) {
    throw new Error("Marketing Agent: no productId in stageResults — run Product Agent first");
  }

  /* ── Initialise steps ── */
  let steps = buildInitialSteps();
  callbacks.onStep([...steps]);
  callbacks.onProgress(2, "Starting marketing agent...");

  const setStep = (
    id:     string,
    status: AgentStep["status"],
    opts?:  { label?: string; preview?: string },
  ): void => {
    steps = updateStep(steps, id, status, opts);
    callbacks.onStep([...steps]);
    const { pct, label } = getProgress(steps);
    callbacks.onProgress(pct, label);
  };

  /* ── Build request body ── */
  // Pick up Business Brain fix instruction if this is an auto-fix re-run
  const fixInstruction = ctx.memory?.fixInstruction as string | undefined;
  const fixStage       = ctx.memory?.fixStage       as string | undefined;
  const additionalContext = (fixStage === "marketing" && fixInstruction) ? fixInstruction : undefined;

  const requestBody: Record<string, unknown> = {
    productId,
    productName,
    niche:       research?.query           ?? ctx.goal,
    format:      product?.format      ?? "guide",
    pricePoint:  product?.pricePoint  ?? "£27",
    goal:        ctx.goal,
    reportSummary:        research?.reportSummary,
    insights:             research?.insights,
    keywords:             research?.keywords,
    competitorInsights:   research?.competitorInsights,
    productOpportunities: research?.productOpportunities,
    actionPlan:           research?.actionPlan,
    // Business Brain improvement instruction (present on auto-fix re-runs only)
    ...(additionalContext ? { additionalContext } : {}),
  };

  /* ── Call streaming marketing API ── */
  const res = await fetch("/api/launch/marketing", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(requestBody),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Marketing API returned ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  // Track accumulated marketing data and per-category asset counts
  let fullMarketing: Record<string, unknown> = {};
  const counts: AssetCounts = { launch: 0, social: 0, email: 0 };

  // Current step's rolling preview (e.g. "9 assets" for launch-content step)
  const stepPreviews: Record<string, string> = {};

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

        /* ── Step lifecycle ── */
        case "step": {
          const id    = event.id    as string;
          const label = event.label as string | undefined;
          setStep(id, "running", { label });
          break;
        }

        case "step-done": {
          const id = event.id as string;
          // Attach the accumulated preview for the step
          const preview = stepPreviews[id];
          setStep(id, "done", preview ? { preview } : undefined);
          break;
        }

        /* ── Folder asset streaming in ── */
        case "folder-asset": {
          const item: FolderAssetItem = {
            category: event.category as "launch" | "social" | "email",
            id:       event.id       as string,
            label:    event.label    as string,
            preview:  event.preview  as string,
          };

          // Notify UI — marketing folder view will show this immediately
          callbacks.onFolderAsset?.(item);

          // Count per-category for step previews
          counts[item.category]++;

          // Update the running step's preview label
          const categoryStepMap: Record<string, string> = {
            launch: "launch-content",
            social: "social-content",
            email:  "email-content",
          };
          const stepId = categoryStepMap[item.category];
          if (stepId) {
            const count      = counts[item.category];
            const labelMap: Record<string, string> = {
              "launch-content": `${count} launch asset${count !== 1 ? "s" : ""} created`,
              "social-content": `${count} social post${count !== 1 ? "s" : ""} generated`,
              "email-content":  `${count} email${count !== 1 ? "s" : ""} drafted`,
            };
            stepPreviews[stepId] = labelMap[stepId] ?? "";
          }
          break;
        }

        /* ── All done ── */
        case "done": {
          fullMarketing = (event.marketing as Record<string, unknown>) ?? {};

          callbacks.onProgress(98, "Saving marketing results...");

          // Compute total asset count across categories
          const totalAssets = counts.launch + counts.social + counts.email;
          console.log(`[marketing-agent] Generated ${totalAssets} assets: ${counts.launch} launch, ${counts.social} social, ${counts.email} emails`);

          const marketingResult = {
            ...(fullMarketing as LaunchStageResults["marketing"]),
            completedAt: new Date().toISOString(),
          } as NonNullable<LaunchStageResults["marketing"]>;

          const validation = validateMarketing(marketingResult);

          const stageResultsPatch: Partial<LaunchStageResults> = {
            marketing: { ...marketingResult, validation },
          };

          await saveProgress({
            currentStage: "store",
            progress:     80,
            stageResults: stageResultsPatch,
          });

          callbacks.onProgress(100, "Marketing campaign ready ✓");
          break streamLoop;
        }

        case "error": {
          throw new Error(
            `Marketing error: ${typeof event.message === "string" ? event.message : "Unknown"}`
          );
        }
      }
    }
  }

  // Validate we got something
  if (Object.keys(fullMarketing).length === 0) {
    throw new Error("Marketing stream ended without any content");
  }
}
