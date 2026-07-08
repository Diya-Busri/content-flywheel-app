/**
 * Launch Pipeline — Product Agent (Phase 1.3)
 * ─────────────────────────────────────────────
 * Calls /api/launch/product in streaming mode and maps NDJSON events to
 * live AgentStep updates in the execution dashboard.
 *
 * The user sees exactly what is being written, section by section —
 * reading research → choosing product → generating chapters → saving.
 *
 * On completion: saves stageResults.product.{productId, productName}
 * and advances currentStage → "design" at 40% overall progress.
 */

import type { ExecutionContext, AgentStep } from "./types";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import { validateProduct } from "@/lib/launch-validator";

/* ─── Fixed steps (before outline is known) ──────────────────────────────────── */

const FIXED_STEPS_BEFORE  = ["read-research", "select-product", "outline"] as const;
const FIXED_STEPS_AFTER   = ["pricing", "saving"] as const;

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "read-research",  label: "Reading market research...",    status: "running"  },
    { id: "select-product", label: "Selecting product type...",     status: "pending"  },
    { id: "outline",        label: "Generating outline...",         status: "pending"  },
    // Section steps are inserted here dynamically when outline arrives
    { id: "pricing",        label: "Pricing recommendation",        status: "pending"  },
    { id: "saving",         label: "Saving to Digital Products",    status: "pending"  },
  ];
}

/* ─── Step list manipulation ─────────────────────────────────────────────────── */

function injectSectionSteps(
  current: AgentStep[],
  sections: Array<{ id: string; title: string }>,
): AgentStep[] {
  // Insert section steps between "outline" and "pricing"
  const outlineIdx = current.findIndex(s => s.id === "outline");
  const pricingIdx = current.findIndex(s => s.id === "pricing");

  if (outlineIdx === -1 || pricingIdx === -1) return current;

  const sectionSteps: AgentStep[] = sections.map(s => ({
    id:     `section:${s.id}`,
    label:  s.title,
    status: "pending",
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

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchProductAgent(ctx: ExecutionContext): Promise<void> {
  const { goal, stageResults, callbacks, saveProgress } = ctx;

  /* Extract research context from previous stage */
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

  let productId:   string | null = null;
  let productName: string | null = null;
  let format:      string | null = null;
  let pricePoint:  string | null = null;
  let sectionsGenerated = 0;

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
          // Update the select-product label to show the thinking text
          steps = updateStep(steps, "select-product", "running", event.label as string);
          callbacks.onStep([...steps]);
          break;
        }

        case "decision": {
          productName = event.productName as string;
          format      = event.format      as string;
          pricePoint  = event.pricePoint  as string;
          // Show the chosen product in the step label
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
          steps = injectSectionSteps(steps, sections);
          // Mark outline done + add count label
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
          const sectionId = `section:${(event as Record<string, unknown> & { index: number; title: string }).title}`;
          // Find by title match (since we don't have the section id directly)
          const title = event.title as string;
          const matchId = steps.find(s => s.label === title && s.id.startsWith("section:"))?.id ?? `section:${title}`;
          setStep(matchId, "running", title);
          break;
        }

        case "section-done": {
          const title = event.title as string;
          const matchId = steps.find(s => s.label === title && s.id.startsWith("section:"))?.id
            ?? steps.find(s => s.id.startsWith("section:") && s.status === "running")?.id
            ?? `section:${title}`;
          setStep(matchId, "done");
          sectionsGenerated++;
          break;
        }

        /* ── Done ── */
        case "done": {
          productId         = event.productId as string;
          productName       = event.productName as string ?? productName;
          format            = event.format as string ?? format;
          pricePoint        = event.pricePoint as string ?? pricePoint;
          sectionsGenerated = event.sectionsGenerated as number ?? sectionsGenerated;

          callbacks.onProgress(98, "Saving research results...");

          const productResult = {
            productId:   productId,
            productName: productName ?? goal,
            completedAt: new Date().toISOString(),
          };

          const validation = validateProduct(productResult);

          const stageResultsPatch: Partial<LaunchStageResults> = {
            product: { ...productResult, validation },
          };

          await saveProgress({
            currentStage:  "design",
            progress:      40,
            stageResults:  stageResultsPatch,
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
