/**
 * Launch Pipeline — Store Agent (Phase 1.6)
 * ─────────────────────────────────────────────
 * Calls /api/launch/store in streaming NDJSON mode and maps events to:
 *   - Live AgentStep updates (checklist items in the agent card)
 *   - ValidationCheck callbacks (Store Readiness panel, live score)
 *
 * Flow the user sees:
 *   Loading product details →
 *   Attaching design assets →
 *   Populating store listing →
 *   Validating store readiness [13 checks appear live] →
 *   Auto-fixing issues →
 *   Saving to store →
 *   Store ready ✓
 *
 * On completion: saves stageResults.store, advances to "complete" at 100%,
 * marks overall status as "completed".
 */

import type { ExecutionContext, AgentStep, ValidationCheck } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Step definition ────────────────────────────────────────────────────────── */

const STORE_STEPS: Array<{ id: string; label: string }> = [
  { id: "load-product",    label: "Loading product details..."   },
  { id: "attach-assets",   label: "Attaching design assets..."    },
  { id: "populate-listing",label: "Populating store listing..."   },
  { id: "validate",        label: "Validating store readiness..."  },
  { id: "fix-issues",      label: "Auto-fixing issues..."          },
  { id: "save",            label: "Saving to store..."             },
  { id: "ready",           label: "Store ready ✓"                  },
];

function buildInitialSteps(): AgentStep[] {
  return STORE_STEPS.map((s, i) => ({
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
  opts?:  { label?: string },
): AgentStep[] {
  return steps.map(s =>
    s.id === id
      ? { ...s, status, ...(opts?.label !== undefined ? { label: opts.label } : {}) }
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

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchStoreAgent(ctx: ExecutionContext): Promise<void> {
  const { stageResults, callbacks, saveProgress } = ctx;

  /* ── Extract context from previous stages ── */
  const product     = stageResults.product;
  const productId   = product?.productId   ?? "";
  const productName = product?.productName ?? ctx.goal;

  if (!productId) {
    throw new Error("Store Agent: no productId in stageResults — run Product Agent first");
  }

  /* ── Initialise steps ── */
  let steps = buildInitialSteps();
  callbacks.onStep([...steps]);
  callbacks.onProgress(2, "Starting store agent...");

  const setStep = (
    id:     string,
    status: AgentStep["status"],
    opts?:  { label?: string },
  ): void => {
    steps = updateStep(steps, id, status, opts);
    callbacks.onStep([...steps]);
    const { pct, label } = getProgress(steps);
    callbacks.onProgress(pct, label);
  };

  /* ── Call streaming store API ── */
  const res = await fetch("/api/launch/store", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      productId,
      productName,
      stageResults,   // pass full pipeline context for design + marketing data
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Store API returned ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  let finalStoreUrl  = "";
  let finalScore     = 0;
  let finalChecks:   ValidationCheck[] = [];

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
          const id    = event.id    as string;
          const label = event.label as string | undefined;
          setStep(id, "running", label ? { label } : undefined);
          break;
        }

        case "step-done": {
          setStep(event.id as string, "done");
          break;
        }

        /* ── Individual validation check ── */
        case "validation-item": {
          const check: ValidationCheck = {
            id:      event.id     as string,
            label:   event.label  as string,
            status:  event.status as "ok" | "fixed" | "warning" | "missing",
            detail:  event.detail as string | undefined,
          };
          callbacks.onValidationCheck?.(check);
          break;
        }

        /* ── Final score (after all checks) ── */
        case "readiness-score": {
          finalScore  = event.score   as number;
          finalChecks = event.checks  as ValidationCheck[];
          callbacks.onReadinessScore?.(finalScore, finalChecks);
          break;
        }

        /* ── All done ── */
        case "done": {
          finalStoreUrl = event.storeUrl as string ?? "";
          finalScore    = typeof event.score === "number" ? event.score : finalScore;
          if (Array.isArray(event.checks)) finalChecks = event.checks as ValidationCheck[];

          callbacks.onProgress(98, "Saving store results...");

          const stageResultsPatch: Partial<LaunchStageResults> = {
            store: {
              productId,
              storeUrl:        finalStoreUrl,
              readinessScore:  finalScore,
              validationChecks: finalChecks.map(c => ({
                id:      c.id,
                label:   c.label,
                status:  c.status,
                ...(c.detail ? { detail: c.detail } : {}),
              })),
              completedAt: new Date().toISOString(),
            },
          };

          await saveProgress({
            currentStage: "complete",
            progress:     100,
            status:       "completed",
            stageResults: stageResultsPatch,
          });

          callbacks.onProgress(100, "Your business is ready to launch ✓");
          break streamLoop;
        }

        case "error": {
          throw new Error(
            `Store error: ${typeof event.message === "string" ? event.message : "Unknown"}`
          );
        }
      }
    }
  }
}
