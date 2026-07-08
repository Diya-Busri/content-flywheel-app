/**
 * Launch Pipeline — Product Agent (Phase 1.3 + content validation)
 * ─────────────────────────────────────────────────────────────────
 * Calls /api/launch/product in streaming mode and maps NDJSON events to
 * live AgentStep updates in the execution dashboard.
 *
 * Generation phase:
 *   Reading research → Choosing product → Generating outline →
 *   Writing N sections (parallel batches) → Pricing → Saving to library
 *
 * Validation phase (after saving):
 *   ✓ Product created in library
 *   ✓ N/N sections generated
 *   ✓ All sections have content
 *   ✓ Saved to database
 *
 * On completion: saves stageResults.product.{productId, productName,
 * sectionsGenerated, totalSections, emptySections, savedToDb}
 * and advances currentStage → "design" at 40% overall progress.
 *
 * Failure handling:
 *   • section-failed events mark that section step as "error" with reason
 *   • Remaining sections continue generating (no abort on partial failure)
 *   • validateProduct checks empty sections → needs_attention if any failed
 */

import type { ExecutionContext, AgentStep } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { validateProduct } from "@/lib/launch-validator";

/* ─── Fixed steps (before outline is known) ──────────────────────────────────── */

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "read-research",    label: "Reading market research...",    status: "running"  },
    { id: "select-product",   label: "Selecting product type...",     status: "pending"  },
    { id: "outline",          label: "Generating outline...",         status: "pending"  },
    // Section steps are inserted here dynamically when outline arrives
    { id: "pricing",          label: "Pricing recommendation",        status: "pending"  },
    { id: "saving",           label: "Saving to Digital Products",    status: "pending"  },
    { id: "validate-content", label: "Validating content...",         status: "pending"  },
    { id: "validate-save",    label: "Verifying saved correctly",     status: "pending"  },
  ];
}

/* ─── Step list manipulation ─────────────────────────────────────────────────── */

function injectSectionSteps(
  current: AgentStep[],
  sections: Array<{ id: string; title: string }>,
): AgentStep[] {
  const outlineIdx = current.findIndex(s => s.id === "outline");
  const pricingIdx = current.findIndex(s => s.id === "pricing");

  if (outlineIdx === -1 || pricingIdx === -1) return current;

  const sectionSteps: AgentStep[] = sections.map(s => ({
    id:     `section:${s.id}`,
    label:  s.title,
    status: "pending" as const,
  }));

  return [
    ...current.slice(0, outlineIdx + 1),
    ...sectionSteps,
    ...current.slice(pricingIdx),
  ];
}

function updateStep(
  steps:  AgentStep[],
  id:     string,
  status: AgentStep["status"],
  label?: string,
): AgentStep[] {
  return steps.map(s =>
    s.id === id ? { ...s, status, ...(label !== undefined ? { label } : {}) } : s
  );
}

/* ─── Progress from step list ────────────────────────────────────────────────── */

function getProgress(steps: AgentStep[]): { pct: number; label: string } {
  const done    = steps.filter(s => s.status === "done").length;
  const running = steps.filter(s => s.status === "running");
  const total   = steps.length;

  const pct   = Math.min(94, Math.round((done / Math.max(total, 1)) * 95) + 2);
  const label = running[0]?.label ?? `${done} of ${total} tasks complete`;
  return { pct, label };
}

/* ─── Section step lookup helpers ───────────────────────────────────────────── */

function findSectionStep(steps: AgentStep[], title: string): string {
  return (
    steps.find(s => s.label === title && s.id.startsWith("section:"))?.id ??
    steps.find(s => s.id.startsWith("section:") && s.status === "pending")?.id ??
    `section:${title}`
  );
}

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchProductAgent(ctx: ExecutionContext): Promise<void> {
  const { goal, stageResults, callbacks, saveProgress } = ctx;

  const research = stageResults.research ?? {};

  let steps = buildInitialSteps();
  callbacks.onStep([...steps]);
  callbacks.onProgress(2, "Starting product agent...");

  const setStep = (id: string, status: AgentStep["status"], label?: string): void => {
    steps = updateStep(steps, id, status, label);
    callbacks.onStep([...steps]);
    const { pct, label: progressLabel } = getProgress(steps);
    callbacks.onProgress(pct, progressLabel);
  };

  /* ── Call streaming product API ── */
  const res = await fetch("/api/launch/product", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ goal, research }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Product API returned ${res.status}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  let productId:          string | null = null;
  let productName:        string | null = null;
  let format:             string | null = null;
  let pricePoint:         string | null = null;
  let sectionsGenerated   = 0;
  let totalSections       = 0;
  let emptySections       = 0;
  let savedToDb           = false;
  let sectionsFailedCount = 0;

  /* ── Stream events ── */
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

        /* ── Fixed step lifecycle ── */
        case "step": {
          const id    = event.id as string;
          const label = event.label as string | undefined;
          setStep(id, "running", label);
          break;
        }

        case "step-done": {
          const id = event.id as string;
          setStep(id, "done");
          break;
        }

        /* ── Product selected ── */
        case "thinking": {
          steps = updateStep(steps, "select-product", "running", event.label as string);
          callbacks.onStep([...steps]);
          break;
        }

        case "decision": {
          productName = event.productName as string;
          format      = event.format      as string;
          pricePoint  = event.pricePoint  as string;
          steps = updateStep(
            steps,
            "select-product",
            "running",
            `Chose: "${productName}" (${format})`,
          );
          callbacks.onStep([...steps]);
          break;
        }

        /* ── Outline arrived — rebuild steps with section entries ── */
        case "outline-ready": {
          const sections = event.sections as Array<{ id: string; title: string }>;
          totalSections  = sections.length;
          steps = injectSectionSteps(steps, sections);
          steps = updateStep(
            steps,
            "outline",
            "done",
            `Outline ready — ${sections.length} sections`,
          );
          callbacks.onStep([...steps]);
          const { pct, label } = getProgress(steps);
          callbacks.onProgress(pct, label);
          break;
        }

        /* ── Section lifecycle ── */
        case "writing-section": {
          const title   = event.title as string;
          const matchId = findSectionStep(steps, title);
          setStep(matchId, "running", title);
          break;
        }

        case "section-done": {
          const title   = event.title as string;
          const matchId =
            steps.find(s => s.label === title && s.id.startsWith("section:"))?.id ??
            steps.find(s => s.id.startsWith("section:") && s.status === "running")?.id ??
            `section:${title}`;
          setStep(matchId, "done");
          sectionsGenerated++;
          break;
        }

        /* ── Section failed (non-fatal — generation continues) ── */
        case "section-failed": {
          const title   = event.title  as string;
          const reason  = event.reason as string | undefined;
          const matchId = findSectionStep(steps, title);
          setStep(matchId, "error", `${title} — ${reason ?? "failed"}`);
          sectionsFailedCount++;
          break;
        }

        /* ── Validation phase ── */
        case "validation-start": {
          setStep("validate-content", "running", "Validating content quality...");
          break;
        }

        case "validation-check": {
          const id     = event.id     as string;
          const label  = event.label  as string;
          const passed = event.passed as boolean;
          const reason = event.reason as string | undefined;

          if (id === "product-id" || id === "saved-to-db") {
            // Route to the validate-save step
            setStep(
              "validate-save",
              passed ? "done" : "error",
              passed ? label : `${label} — ${reason ?? "failed"}`,
            );
          } else {
            // Route to validate-content; only mark error on failure, keep running on pass
            // (may have multiple checks passing through the same step)
            if (!passed) {
              setStep("validate-content", "error", `${label} — ${reason ?? "failed"}`);
            } else {
              setStep("validate-content", "running", label);
            }
          }
          break;
        }

        case "validation-done": {
          const passed = event.passed as boolean;
          // Settle any validation steps still in "running" state
          steps = steps.map(s => {
            if (
              (s.id === "validate-content" || s.id === "validate-save") &&
              s.status === "running"
            ) {
              return { ...s, status: (passed ? "done" : "error") as AgentStep["status"] };
            }
            return s;
          });
          callbacks.onStep([...steps]);
          break;
        }

        /* ── Done ── */
        case "done": {
          productId         = event.productId   as string;
          productName       = (event.productName as string | undefined) ?? productName;
          format            = (event.format      as string | undefined) ?? format;
          pricePoint        = (event.pricePoint  as string | undefined) ?? pricePoint;
          sectionsGenerated = (event.sectionsGenerated as number | undefined) ?? sectionsGenerated;
          totalSections     = (event.totalSections     as number | undefined) ?? totalSections;
          emptySections     = (event.emptySections     as number | undefined) ?? sectionsFailedCount;
          savedToDb         = (event.savedToDb         as boolean | undefined) ?? true;

          callbacks.onProgress(98, "Saving product results...");

          const productResult = {
            productId:        productId,
            productName:      productName ?? goal,
            sectionsGenerated,
            totalSections,
            emptySections,
            savedToDb,
            completedAt:      new Date().toISOString(),
          };

          const validation = validateProduct(productResult);

          const stageResultsPatch: Partial<LaunchStageResults> = {
            product: { ...productResult, validation },
          };

          await saveProgress({
            currentStage: "design",
            progress:     40,
            stageResults: stageResultsPatch,
          });

          callbacks.onProgress(100, "Product created ✓");
          break streamLoop;
        }

        case "error": {
          throw new Error(
            `Product error: ${typeof event.message === "string" ? event.message : "Unknown"}`
          );
        }
      }
    }
  }

  if (!productId) {
    throw new Error("Product stream ended without completing");
  }
}
