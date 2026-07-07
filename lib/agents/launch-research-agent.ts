/**
 * Launch Pipeline — Research Agent (Phase 1.2)
 * ─────────────────────────────────────────────
 * Streams the existing /api/research/ai endpoint (mode: "stream") and maps
 * each of the 9 parallel analyst updates to a live AgentStep in the execution
 * dashboard. Zero research logic is duplicated — everything reuses the existing
 * research engine.
 *
 * Lifecycle:
 *   1. Call POST /api/research/ai with { query: goal, researchType: "product-ideas", mode: "stream" }
 *   2. Map NDJSON events → AgentStep[] updates via callbacks.onStep
 *   3. On synthesis-done: persist full report + structured fields to DB, advance stage
 */

import type { ExecutionContext, AgentStep } from "./types";

/* ─── Analyst metadata — mirrors RESEARCH_ANALYSTS in /api/research/ai/route.ts */

const ANALYST_META: Record<string, { label: string; emoji: string }> = {
  web:         { label: "Web Intelligence",    emoji: "🌐" },
  news:        { label: "News Analysis",       emoji: "📰" },
  community:   { label: "Community Insights",  emoji: "💬" },
  hackernews:  { label: "Hacker News",         emoji: "🔶" },
  wikipedia:   { label: "Wikipedia",           emoji: "📖" },
  academic:    { label: "Academic Research",   emoji: "🎓" },
  seo:         { label: "SEO & Keywords",      emoji: "🔍" },
  social:      { label: "Social Intelligence", emoji: "📱" },
  marketplace: { label: "Marketplace",         emoji: "🛒" },
};

/* ─── Build the initial step list ──────────────────────────────────────────── */

function buildInitialSteps(): AgentStep[] {
  return [
    { id: "intent", label: "Classifying your goal", status: "running" },
    ...Object.entries(ANALYST_META).map(([id, { label, emoji }]) => ({
      id,
      label: `${emoji} ${label}`,
      status: "pending" as const,
    })),
    { id: "synthesis", label: "Generating executive summary", status: "pending" },
  ];
}

/* ─── Derive agent-internal progress from current step states ───────────────── */

function getProgress(steps: AgentStep[]): { pct: number; label: string } {
  const done    = steps.filter(s => s.status === "done").length;
  const running = steps.filter(s => s.status === "running");
  const total   = steps.length;

  const pct = Math.min(94, Math.round((done / total) * 95) + 3);

  const runningName = running[0]?.label.replace(/^[\S]+\s/, "") ?? "";
  const label =
    done === 0          ? "Starting up..."
    : running.length > 0? `${runningName}...`
    : done >= total - 1 ? "Synthesising results..."
    :                     `${done} of ${total - 1} analysts complete`;

  return { pct, label };
}

/* ─── Main agent ─────────────────────────────────────────────────────────────── */

export async function runLaunchResearchAgent(ctx: ExecutionContext): Promise<void> {
  const { goal, callbacks, saveProgress } = ctx;

  let steps = buildInitialSteps();
  callbacks.onStep([...steps]);
  callbacks.onProgress(3, "Classifying your goal...");

  /* Mutates local steps, pushes updates to the execution page */
  const updateStep = (id: string, status: AgentStep["status"], label?: string): void => {
    steps = steps.map(s =>
      s.id === id ? { ...s, status, ...(label !== undefined ? { label } : {}) } : s
    );
    callbacks.onStep([...steps]);
    const { pct, label: progressLabel } = getProgress(steps);
    callbacks.onProgress(pct, progressLabel);
  };

  /* ── Stream from existing research engine ── */
  const res = await fetch("/api/research/ai", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      query:        goal,
      researchType: "product-ideas",
      mode:         "stream",
    }),
  });

  if (!res.ok || !res.body) {
    // Extract a human-readable error from the response body
    let errMsg = `Research service error (${res.status})`;
    try {
      const errText = await res.text();
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) errMsg = parsed.error;
    } catch { /* use default */ }

    // Map common HTTP codes to actionable messages
    if (res.status === 429) errMsg = errMsg.includes("Daily") || errMsg.includes("daily")
      ? errMsg
      : `Rate limit reached — please wait a moment and try again`;
    if (res.status === 401) errMsg = "Authentication error — please refresh the page";
    if (res.status === 503) errMsg = "AI service not available — check that OPENAI_API_KEY is set";

    throw new Error(errMsg);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf              = "";
  let report: Record<string, unknown> | null = null;
  let synthesisStarted = false;

  /* ── Read NDJSON stream ── */
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
      } catch {
        continue;
      }

      switch (event.type as string) {

        case "intent-classified": {
          const intentLabel = typeof event.intentLabel === "string"
            ? event.intentLabel : "Intent classified";
          updateStep("intent", "done", `Intent: ${intentLabel}`);
          callbacks.onProgress(8, "Launching 9 research analysts...");
          break;
        }

        case "init": {
          callbacks.onProgress(10, "Analysts starting...");
          break;
        }

        case "analyst-update": {
          const id = event.id as string;
          if (!ANALYST_META[id]) break;

          if (event.status === "working") {
            updateStep(id, "running");
          } else if (event.status === "done") {
            const summary = typeof event.summary === "string" ? event.summary : "Complete";
            const { emoji, label } = ANALYST_META[id]!;
            updateStep(id, "done", `${emoji} ${label} — ${summary}`);
          } else if (event.status === "error") {
            updateStep(id, "error");
          }
          break;
        }

        case "synthesis-start": {
          synthesisStarted = true;
          updateStep("synthesis", "running", "Generating executive summary...");
          callbacks.onProgress(83, "Synthesising all research data...");
          break;
        }

        case "synthesis-done": {
          report = event.report as Record<string, unknown>;
          updateStep("synthesis", "done", "Executive summary ready");
          callbacks.onProgress(96, "Saving research to pipeline...");

          /* Typed helpers for casting the report fields */
          type PO = { title: string; description: string; type: string; priceRange: string };
          type KW = { term: string; intent: string; opportunity: string; note: string };
          type AP = { step: number; action: string; detail: string; cta?: string };
          type CI = { name: string; strength: string; gap: string };

          await saveProgress({
            currentStage: "product",
            progress:     20,
            stageResults: {
              research: {
                query:                goal,
                insights:             Array.isArray(report.insights)
                                        ? (report.insights as unknown[]).map(String)
                                        : [],
                reportSummary:        typeof report.summary === "string"
                                        ? report.summary : "",
                productOpportunities: Array.isArray(report.productOpportunities)
                                        ? (report.productOpportunities as PO[]) : [],
                keywords:             Array.isArray(report.keywords)
                                        ? (report.keywords as KW[]) : [],
                actionPlan:           Array.isArray(report.actionPlan)
                                        ? (report.actionPlan as AP[]) : [],
                competitorInsights:   Array.isArray(report.competitorInsights)
                                        ? (report.competitorInsights as CI[]) : [],
                fullReport:           report,
                completedAt:          new Date().toISOString(),
              },
            },
          });

          callbacks.onProgress(100, "Research complete ✓");
          break streamLoop;
        }

        case "error": {
          throw new Error(
            `Research error: ${typeof event.message === "string" ? event.message : "Unknown"}`
          );
        }
      }
    }
  }

  if (!report) {
    if (synthesisStarted) {
      throw new Error("Research synthesis timed out — the AI is taking longer than expected. Please retry.");
    }
    throw new Error("Research interrupted before synthesis could start. Please retry.");
  }
}
