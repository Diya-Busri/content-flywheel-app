"use client";

/**
 * MarketingDepartment.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Marketing command-centre UI. Shows all 7 AI managers with:
 *   - Live status + running animation
 *   - Output count + last run
 *   - Per-manager output viewer
 *   - Suggestions panel
 *   - Run individual or Run All
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  MarketingManager,
  MarketingManagerId,
  ManagerOutput,
  ManagerSuggestion,
} from "@/db/schema/launch-schema";

/* ─── Static config (mirrors lib/marketing-managers.ts without importing server code) ── */

const MANAGER_CONFIGS: Record<MarketingManagerId, { label: string; emoji: string; description: string; steps: string[] }> = {
  tiktok:    { label: "TikTok Manager",    emoji: "🎵", description: "Hooks, scripts, and trending content",          steps: ["Researching trends", "Writing hooks", "Generating script", "Crafting CTA", "Saving outputs"] },
  instagram: { label: "Instagram Manager", emoji: "📸", description: "Captions, carousels, and hashtag strategy",     steps: ["Analysing content gaps", "Writing captions", "Building carousel", "Selecting hashtags", "Saving outputs"] },
  youtube:   { label: "YouTube Manager",   emoji: "▶️",  description: "Titles, descriptions, and script outlines",     steps: ["Researching search demand", "Writing titles", "Drafting description", "Building script outline", "Saving"] },
  x:         { label: "X Manager",         emoji: "✖",  description: "Tweet threads and viral posts",                 steps: ["Finding angles", "Writing thread", "Crafting viral posts", "Optimising hooks", "Saving outputs"] },
  linkedin:  { label: "LinkedIn Manager",  emoji: "💼", description: "Professional posts and thought leadership",      steps: ["Identifying angle", "Writing post", "Crafting hook", "Finalising tone", "Saving outputs"] },
  email:     { label: "Email Manager",     emoji: "📧", description: "Subject lines, campaigns, and sequences",       steps: ["Analysing audience", "Writing subjects", "Drafting email", "Optimising preview", "Saving outputs"] },
  seo:       { label: "SEO Manager",       emoji: "🔍", description: "Keywords, meta descriptions, and blog strategy", steps: ["Analysing keyword gaps", "Writing meta", "Building clusters", "Drafting blog outline", "Saving"] },
};

const ALL_MANAGERS: MarketingManagerId[] = ["tiktok", "instagram", "youtube", "x", "linkedin", "email", "seo"];

/* ─── Output renderer ────────────────────────────────────────────────────────── */

function OutputCard({ output }: { output: ManagerOutput }) {
  const [expanded, setExpanded] = useState(false);
  const isComplex = ["video_script", "carousel", "tweet_thread", "script_outline", "keyword_cluster", "blog_outline", "email"].includes(output.type);

  const typeLabel: Record<string, string> = {
    hook:              "Hook",
    video_script:      "Video Script",
    caption:           "Caption",
    carousel:          "Carousel",
    video_title:       "YouTube Title",
    video_description: "Description",
    script_outline:    "Script Outline",
    thumbnail_concept: "Thumbnail Concept",
    tweet_thread:      "Tweet Thread",
    standalone_tweet:  "Tweet",
    linkedin_post:     "LinkedIn Post",
    linkedin_hook:     "LinkedIn Hook",
    linkedin_micro:    "Micro-insight",
    email_subject:     "Email Subject",
    email:             "Email",
    meta_description:  "Meta Description",
    keyword_cluster:   "Keyword Cluster",
    blog_outline:      "Blog Outline",
  };

  let displayContent: string;
  if (isComplex) {
    try {
      const parsed = JSON.parse(output.content);
      displayContent = expanded
        ? JSON.stringify(parsed, null, 2)
        : output.type === "tweet_thread"
          ? (parsed.tweets as string[])[0] + " …"
          : output.type === "email"
            ? `${parsed.subject}\n\n${parsed.body?.slice(0, 140)}…`
            : output.type === "carousel"
              ? parsed.hook
              : output.type === "keyword_cluster"
                ? `Primary: ${parsed.primary} • Secondary: ${(parsed.secondary as string[]).join(", ")}`
                : output.type === "blog_outline"
                  ? `${parsed.title}`
                  : output.type === "script_outline"
                    ? parsed.intro
                    : output.content.slice(0, 140);
    } catch {
      displayContent = output.content.slice(0, 200);
    }
  } else {
    displayContent = output.content;
  }

  return (
    <div className="group rounded-lg border border-border/60 bg-card/40 p-3 text-[12px] hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted/60 text-muted-foreground uppercase tracking-wide">
          {typeLabel[output.type] ?? output.type}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {output.angle && (
            <span className="text-[10px] text-muted-foreground/50 italic">{output.angle}</span>
          )}
          {isComplex && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-primary/60 hover:text-primary transition-colors"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          )}
        </div>
      </div>
      <p className={`text-foreground/80 leading-relaxed ${isComplex && expanded ? "whitespace-pre-wrap font-mono text-[11px]" : "line-clamp-4"}`}>
        {displayContent}
      </p>
    </div>
  );
}

/* ─── Suggestion card ────────────────────────────────────────────────────────── */

function SuggestionCard({ s }: { s: ManagerSuggestion }) {
  const priorityStyle = {
    high:   "bg-red-500/10 text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low:    "bg-green-500/10 text-green-400 border-green-500/20",
  }[s.priority];

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/40 bg-card/30">
      <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${priorityStyle}`}>
        {s.priority}
      </span>
      <div>
        <p className="text-[12px] font-medium text-foreground/90">{s.label}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{s.reason}</p>
      </div>
    </div>
  );
}

/* ─── Manager card ───────────────────────────────────────────────────────────── */

function ManagerCard({
  managerId,
  manager,
  onRun,
  isRunningAll,
}: {
  managerId: MarketingManagerId;
  manager:   MarketingManager | undefined;
  onRun:     (id: MarketingManagerId) => void;
  isRunningAll: boolean;
}) {
  const cfg      = MANAGER_CONFIGS[managerId];
  const isRunning = manager?.status === "running";
  const isPaused  = manager?.status === "paused";

  const [stepIdx, setStepIdx]     = useState(0);
  const [expanded, setExpanded]   = useState(false);
  const [outputTab, setOutputTab] = useState<"outputs" | "history" | "suggestions">("outputs");

  /* Cycle through steps while running */
  useEffect(() => {
    if (!isRunning) { setStepIdx(0); return; }
    const interval = setInterval(() => {
      setStepIdx(i => (i + 1) % cfg.steps.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isRunning, cfg.steps.length]);

  const outputCount  = manager?.outputs?.length ?? 0;
  const historyCount = manager?.history?.length ?? 0;
  const suggCount    = manager?.suggestions?.length ?? 0;

  const lastRun = manager?.lastRunAt
    ? new Date(manager.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  return (
    <div className={`rounded-xl border transition-all duration-200 ${isRunning ? "border-primary/40 bg-primary/[0.03]" : "border-border/60 bg-card/30"}`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 p-3.5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${isRunning ? "bg-primary/10" : "bg-muted/40"}`}>
          {cfg.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-foreground truncate">{cfg.label}</p>
            {isPaused && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">Paused</span>
            )}
          </div>

          {isRunning ? (
            <p className="text-[11px] text-primary/70 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
              {cfg.steps[stepIdx]}…
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{cfg.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {outputCount > 0 && (
            <span className="text-[11px] text-muted-foreground/60">{outputCount} outputs</span>
          )}
          {lastRun && (
            <span className="text-[10px] text-muted-foreground/40">{lastRun}</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); if (!isRunning && !isRunningAll && !isPaused) onRun(managerId); }}
            disabled={isRunning || isRunningAll || isPaused}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/40 px-3.5 pb-3.5 pt-3">
          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            {(["outputs", "history", "suggestions"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setOutputTab(tab)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${outputTab === tab ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab}
                <span className="ml-1 text-[10px] opacity-60">
                  {tab === "outputs" ? outputCount : tab === "history" ? historyCount : suggCount}
                </span>
              </button>
            ))}
          </div>

          {/* Outputs tab */}
          {outputTab === "outputs" && (
            <div className="space-y-2">
              {(manager?.outputs?.slice(-12) ?? []).length === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">No outputs yet — click Run to generate content</p>
              ) : (
                [...(manager?.outputs?.slice(-12) ?? [])].reverse().map(o => (
                  <OutputCard key={o.id} output={o} />
                ))
              )}
            </div>
          )}

          {/* History tab */}
          {outputTab === "history" && (
            <div className="space-y-1.5">
              {(manager?.history ?? []).length === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">No runs yet</p>
              ) : (
                (manager?.history ?? []).map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-[11px] py-1.5 border-b border-border/30 last:border-0">
                    <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${h.status === "done" ? "bg-green-500" : h.status === "failed" ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/80 truncate">{h.label}</p>
                      {h.instruction && (
                        <p className="text-muted-foreground/50 text-[10px] truncate">MC: {h.instruction}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-muted-foreground/40">
                      {h.completedAt ? new Date(h.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Suggestions tab */}
          {outputTab === "suggestions" && (
            <div className="space-y-2">
              {(manager?.suggestions ?? []).length === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">Run the manager to get AI suggestions</p>
              ) : (
                (manager?.suggestions ?? []).map(s => (
                  <SuggestionCard key={s.id} s={s} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function MarketingDepartment({ launchId }: { launchId: string }) {
  const [managers, setManagers]       = useState<Partial<Record<MarketingManagerId, MarketingManager>>>({});
  const [loading, setLoading]         = useState(true);
  const [runningAll, setRunningAll]   = useState(false);
  const [runAllStatus, setRunAllStatus] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch dept state ── */
  const fetchDept = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${launchId}/marketing-dept`);
      if (!res.ok) return;
      const data = await res.json() as { marketingDept: { managers: Partial<Record<MarketingManagerId, MarketingManager>> } };
      setManagers(data.marketingDept?.managers ?? {});
    } catch { /* ignore */ }
  }, [launchId]);

  useEffect(() => {
    fetchDept().finally(() => setLoading(false));
  }, [fetchDept]);

  /* ── Poll while any manager is running ── */
  const anyRunning = Object.values(managers).some(m => m?.status === "running");

  useEffect(() => {
    if (anyRunning) {
      pollRef.current = setInterval(fetchDept, 2500);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [anyRunning, fetchDept]);

  /* ── Run a single manager ── */
  async function runManager(managerId: MarketingManagerId, instruction?: string) {
    setManagers(prev => ({
      ...prev,
      [managerId]: {
        ...(prev[managerId] ?? { id: managerId, queue: [], history: [], outputs: [], suggestions: [], runCount: 0 }),
        status: "running",
      } as MarketingManager,
    }));

    try {
      const res = await fetch(`/api/projects/${launchId}/marketing-dept/${managerId}/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ instruction }),
      });
      const data = await res.json() as { manager?: MarketingManager };
      if (data.manager) {
        setManagers(prev => ({ ...prev, [managerId]: data.manager! }));
      } else {
        setManagers(prev => ({
          ...prev,
          [managerId]: { ...(prev[managerId]!), status: "error" },
        }));
      }
    } catch {
      setManagers(prev => ({
        ...prev,
        [managerId]: { ...(prev[managerId]!), status: "error" },
      }));
    }
  }

  /* ── Run all managers sequentially ── */
  async function runAll() {
    setRunningAll(true);
    for (const mid of ALL_MANAGERS) {
      const m = managers[mid];
      if (m?.status === "paused") continue;
      setRunAllStatus(`Running ${MANAGER_CONFIGS[mid].label}…`);
      await runManager(mid);
    }
    setRunningAll(false);
    setRunAllStatus("");
    await fetchDept();
  }

  const totalOutputs = Object.values(managers).reduce((n, m) => n + (m?.outputs?.length ?? 0), 0);
  const totalRuns    = Object.values(managers).reduce((n, m) => n + (m?.runCount ?? 0), 0);
  const lastUpdated  = Object.values(managers)
    .map(m => m?.lastRunAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-xl bg-muted/40" />
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-foreground tracking-tight">Marketing Department</h2>
          <p className="text-[12px] text-muted-foreground/50 mt-0.5">
            {totalOutputs > 0
              ? `${totalOutputs} total outputs · ${totalRuns} runs${lastUpdated ? ` · last run ${new Date(lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`
              : "7 AI managers, each owning a marketing channel"}
          </p>
        </div>

        <button
          onClick={runAll}
          disabled={runningAll || anyRunning}
          className="shrink-0 text-[12px] px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {runningAll ? runAllStatus || "Running…" : "Run All Managers"}
        </button>
      </div>

      {/* Briefing line while running all */}
      {runningAll && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-primary/20 bg-primary/[0.03] text-[12px] text-primary/70">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse shrink-0" />
          {runAllStatus}
        </div>
      )}

      {/* Manager cards */}
      <div className="space-y-2">
        {ALL_MANAGERS.map(mid => (
          <ManagerCard
            key={mid}
            managerId={mid}
            manager={managers[mid]}
            onRun={runManager}
            isRunningAll={runningAll}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/30 text-center pt-2">
        All outputs feed into Business Memory · Mission Control can direct each manager's priority
      </p>
    </div>
  );
}
