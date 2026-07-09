"use client";

/**
 * MarketingDepartment.tsx — Phase 4.2
 * ──────────────────────────────────────────────────────────────────────────────
 * Marketing command-centre with publishing.
 *
 * Per-manager tabs: Outputs (with Publish button) | Queue | Published | Suggestions
 * Global: approval mode selector, schedule picker, run/run-all
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type {
  MarketingManager,
  MarketingManagerId,
  ManagerOutput,
  ManagerSuggestion,
  PublishQueueItem,
  PublishedItem,
  ApprovalMode,
  PostAnalytics,
  ScheduleRecommendation,
} from "@/db/schema/launch-schema";
import { ContentTimeline } from "@/components/analytics/ContentTimeline";

/* ─── Static config ──────────────────────────────────────────────────────────── */

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

const APPROVAL_MODES: { value: ApprovalMode; label: string; desc: string }[] = [
  { value: "manual",    label: "Manual",       desc: "AI waits for your approval before publishing" },
  { value: "balanced",  label: "Balanced",     desc: "AI publishes high-confidence content automatically" },
  { value: "autopilot", label: "Full Autopilot", desc: "AI publishes everything automatically" },
];

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function queueStatusColor(status: PublishQueueItem["status"]) {
  const map: Record<string, string> = {
    queued:     "bg-amber-500/20 text-amber-400",
    rendering:  "bg-blue-500/20 text-blue-400",
    uploading:  "bg-purple-500/20 text-purple-400",
    published:  "bg-green-500/20 text-green-400",
    failed:     "bg-red-500/20 text-red-400",
    scheduled:  "bg-sky-500/20 text-sky-400",
  };
  return map[status] ?? "bg-muted/40 text-muted-foreground";
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    hook: "Hook", video_script: "Script", caption: "Caption", carousel: "Carousel",
    video_title: "YT Title", video_description: "YT Desc", script_outline: "Script Outline",
    thumbnail_concept: "Thumbnail", tweet_thread: "Thread", standalone_tweet: "Tweet",
    linkedin_post: "LinkedIn Post", linkedin_hook: "LI Hook", linkedin_micro: "Micro",
    email_subject: "Subject", email: "Email", meta_description: "Meta",
    keyword_cluster: "Keywords", blog_outline: "Blog Outline",
  };
  return map[type] ?? type;
}

function contentPreview(output: ManagerOutput): string {
  const complex = ["video_script", "carousel", "tweet_thread", "script_outline", "keyword_cluster", "blog_outline", "email"];
  if (!complex.includes(output.type)) return output.content.slice(0, 200);
  try {
    const p = JSON.parse(output.content);
    if (output.type === "tweet_thread") return (p.tweets as string[])[0] + " …";
    if (output.type === "email")        return `${p.subject} — ${p.body?.slice(0, 100)}…`;
    if (output.type === "carousel")     return p.hook;
    if (output.type === "keyword_cluster") return `Primary: ${p.primary}`;
    if (output.type === "blog_outline")    return p.title;
    if (output.type === "script_outline")  return p.intro;
  } catch { /* ignore */ }
  return output.content.slice(0, 200);
}

/* ─── Output row with publish button ────────────────────────────────────────── */

function OutputRow({
  output, launchId, managerId, onPublished,
}: {
  output:    ManagerOutput;
  launchId:  string;
  managerId: MarketingManagerId;
  onPublished: () => void;
}) {
  const [publishing,      setPublishing]      = useState(false);
  const [done,            setDone]            = useState(false);
  const [loadingSched,    setLoadingSched]    = useState(false);
  const [schedRec,        setSchedRec]        = useState<ScheduleRecommendation | null>(null);
  const [schedError,      setSchedError]      = useState(false);

  async function handlePublish(scheduledAt?: string) {
    setPublishing(true);
    try {
      await fetch(`/api/projects/${launchId}/marketing-dept/${managerId}/publish`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          outputId:     output.id,
          outputType:   output.type,
          content:      output.content,
          scheduleMode: scheduledAt ? "scheduled" : "immediate",
          scheduledAt,
        }),
      });
      setDone(true);
      setSchedRec(null);
      onPublished();
    } finally { setPublishing(false); }
  }

  async function getScheduleRec() {
    setLoadingSched(true);
    setSchedError(false);
    try {
      const res  = await fetch(`/api/projects/${launchId}/analytics/schedule-recommendation`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ content: output.content, managerId }),
      });
      const json = await res.json() as { recommendation: ScheduleRecommendation };
      setSchedRec(json.recommendation);
    } catch { setSchedError(true); }
    setLoadingSched(false);
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-border/50 bg-card/30 hover:border-border/80 transition-colors">
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground uppercase tracking-wide">
              {typeLabel(output.type)}
            </span>
            {output.angle && (
              <span className="text-[10px] text-muted-foreground/40 italic truncate">{output.angle}</span>
            )}
          </div>
          <p className="text-[12px] text-foreground/80 line-clamp-3 leading-relaxed">
            {contentPreview(output)}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => handlePublish()}
            disabled={publishing || done}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
              done
                ? "bg-green-500/20 text-green-400 cursor-default"
                : "bg-primary/10 text-primary/80 hover:bg-primary/20 disabled:opacity-50"
            }`}
          >
            {publishing ? "…" : done ? "Queued ✓" : "Publish now"}
          </button>
          {!done && (
            <button
              onClick={getScheduleRec}
              disabled={loadingSched || publishing}
              className="text-[10px] px-2.5 py-1 rounded-lg font-medium text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors disabled:opacity-40"
              title="Get AI schedule recommendation"
            >
              {loadingSched ? "…" : schedError ? "Retry AI" : "AI schedule"}
            </button>
          )}
        </div>
      </div>

      {/* AI schedule recommendation */}
      {schedRec && !done && (
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/15 px-3 py-2">
          <p className="text-[10px] font-bold text-orange-400/80 mb-0.5">AI Schedule Recommendation</p>
          <p className="text-[11px] text-foreground/70">
            {schedRec.bestDay} at {schedRec.bestTime} on {schedRec.bestPlatform}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">{schedRec.reasoning}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => handlePublish(schedRec.scheduledAt)}
              disabled={publishing}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 font-semibold disabled:opacity-50 transition-colors"
            >
              Schedule for {schedRec.bestDay} {schedRec.bestTime}
            </button>
            <button
              onClick={() => setSchedRec(null)}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Queue item row ─────────────────────────────────────────────────────────── */

function QueueRow({
  item, launchId, managerId, onApproved,
}: {
  item:       PublishQueueItem;
  launchId:   string;
  managerId:  MarketingManagerId;
  onApproved: () => void;
}) {
  const [approving, setApproving] = useState(false);

  async function handleApprove() {
    setApproving(true);
    try {
      await fetch(`/api/projects/${launchId}/marketing-dept/${managerId}/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ queueItemId: item.id }),
      });
      onApproved();
    } finally { setApproving(false); }
  }

  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/40 bg-card/20">
      <span className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${queueStatusColor(item.status)}`}>
        {item.status}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/80 line-clamp-2">{contentPreview({ content: item.content, type: item.outputType } as ManagerOutput)}</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
          {item.scheduledAt
            ? `Scheduled: ${new Date(item.scheduledAt).toLocaleString("en-GB")}`
            : item.createdAt
              ? new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : ""}
          {item.approvedBy && ` · Approved by ${item.approvedBy}`}
        </p>
        {item.publishedUrl && (
          <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer"
             className="text-[10px] text-primary/60 hover:text-primary transition-colors">
            View post →
          </a>
        )}
        {item.errorMessage && (
          <p className="text-[10px] text-red-400/70 mt-0.5">{item.errorMessage}</p>
        )}
      </div>
      {item.status === "queued" && (
        <button
          onClick={handleApprove}
          disabled={approving}
          className="shrink-0 text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 font-medium disabled:opacity-50 transition-colors"
        >
          {approving ? "…" : "Approve"}
        </button>
      )}
    </div>
  );
}

/* ─── Published item row ─────────────────────────────────────────────────────── */

function PublishedRow({
  item, managerId, postAnalytics, hasLessons, hasMemory,
}: {
  item:          PublishedItem;
  managerId:     MarketingManagerId;
  postAnalytics?: PostAnalytics;
  hasLessons:    boolean;
  hasMemory:     boolean;
}) {
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div className="p-2.5 rounded-lg border border-border/40 bg-card/20 space-y-2">
      {/* Content preview + url */}
      <div className="flex items-start gap-2.5">
        <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-foreground/80 line-clamp-2">
            {item.content.slice(0, 150)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/50">
              {new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
            {item.publishedUrl && (
              <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer"
                 className="text-[10px] text-primary/60 hover:text-primary transition-colors">
                View →
              </a>
            )}
          </div>
          {/* Metrics row */}
          {postAnalytics && (
            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground/50">
              {postAnalytics.metrics.views    ? <span>👁 {postAnalytics.metrics.views.toLocaleString()}</span> : null}
              {postAnalytics.metrics.likes    ? <span>♥ {postAnalytics.metrics.likes.toLocaleString()}</span> : null}
              {postAnalytics.metrics.shares   ? <span>⤴ {postAnalytics.metrics.shares.toLocaleString()}</span> : null}
              {postAnalytics.metrics.retention ? <span>⏱ {postAnalytics.metrics.retention}%</span> : null}
            </div>
          )}
        </div>
        {/* Toggle timeline */}
        <button
          onClick={() => setShowTimeline(p => !p)}
          className="shrink-0 text-[9px] font-semibold px-2 py-1 rounded bg-muted/20 text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground transition-colors"
          title="View content lifecycle"
        >
          {showTimeline ? "Hide" : "Timeline"}
        </button>
      </div>

      {/* Compact timeline pills (always visible) */}
      <ContentTimeline
        publishedItem={item}
        postAnalytics={postAnalytics}
        managerId={managerId}
        hasLessons={hasLessons}
        hasMemoryUpdate={hasMemory}
        compact={!showTimeline}
      />
    </div>
  );
}

/* ─── Manager card ───────────────────────────────────────────────────────────── */

function ManagerCard({
  managerId, manager, launchId, onRun, onRefresh, isRunningAll, analyticsPosts, hasLessons, hasMemory,
}: {
  managerId:     MarketingManagerId;
  manager:       MarketingManager | undefined;
  launchId:      string;
  onRun:         (id: MarketingManagerId) => void;
  onRefresh:     () => void;
  isRunningAll:  boolean;
  analyticsPosts: PostAnalytics[];
  hasLessons:    boolean;
  hasMemory:     boolean;
}) {
  const cfg       = MANAGER_CONFIGS[managerId];
  const isRunning = manager?.status === "running";
  const isPaused  = manager?.status === "paused";
  const isWaiting = manager?.status === "waiting_approval";

  const [stepIdx, setStepIdx]   = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"outputs" | "queue" | "published" | "suggestions">("outputs");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingMode, setSavingMode]     = useState(false);

  /* Cycle steps during run */
  useEffect(() => {
    if (!isRunning) { setStepIdx(0); return; }
    const t = setInterval(() => setStepIdx(i => (i + 1) % cfg.steps.length), 2200);
    return () => clearInterval(t);
  }, [isRunning, cfg.steps.length]);

  const outputCount    = manager?.outputs?.length ?? 0;
  const queueCount     = (manager?.publishQueue ?? []).filter(i => i.status === "queued" || i.status === "rendering" || i.status === "uploading").length;
  const publishedCount = manager?.publishedItems?.length ?? 0;
  const suggCount      = manager?.suggestions?.length ?? 0;
  const approvalMode   = manager?.publishingConfig?.approvalMode ?? "manual";

  const lastRun = manager?.lastRunAt
    ? new Date(manager.lastRunAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : null;

  async function setApprovalMode(mode: ApprovalMode) {
    setSavingMode(true);
    await fetch(`/api/projects/${launchId}/marketing-dept/${managerId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "set_approval_mode", approvalMode: mode }),
    });
    setSavingMode(false);
    onRefresh();
  }

  return (
    <div className={`rounded-xl border transition-all duration-200 ${isRunning ? "border-primary/40 bg-primary/[0.03]" : isWaiting ? "border-amber-500/30 bg-amber-500/[0.03]" : "border-border/60 bg-card/30"}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-3.5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ${isRunning ? "bg-primary/10" : "bg-muted/40"}`}>
          {cfg.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-foreground">{cfg.label}</p>
            {isPaused  && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium">Paused</span>}
            {isWaiting && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">Awaiting Approval</span>}
            {queueCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold">{queueCount} pending</span>}
          </div>
          {isRunning ? (
            <p className="text-[11px] text-primary/70 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
              {cfg.steps[stepIdx]}…
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">{cfg.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {outputCount > 0  && <span className="text-[10px] text-muted-foreground/50">{outputCount}</span>}
          {publishedCount > 0 && <span className="text-[10px] text-green-400/70">{publishedCount} published</span>}
          {lastRun && <span className="text-[9px] text-muted-foreground/30 hidden sm:block">{lastRun}</span>}

          {/* Approval mode badge */}
          <button
            onClick={() => setSettingsOpen(s => !s)}
            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-colors ${
              approvalMode === "autopilot" ? "border-green-500/30 text-green-400 bg-green-500/10"
              : approvalMode === "balanced" ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
              : "border-border/60 text-muted-foreground bg-muted/30"
            }`}
          >
            {approvalMode === "autopilot" ? "Autopilot" : approvalMode === "balanced" ? "Balanced" : "Manual"}
          </button>

          <button
            onClick={() => { if (!isRunning && !isRunningAll && !isPaused) onRun(managerId); }}
            disabled={isRunning || isRunningAll || isPaused}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 disabled:opacity-40 transition-colors font-medium"
          >
            {isRunning ? "Running…" : "Run"}
          </button>
        </div>
      </div>

      {/* Approval mode picker (inline) */}
      {settingsOpen && (
        <div className="px-3.5 pb-3 border-t border-border/30 pt-3">
          <p className="text-[11px] font-semibold text-muted-foreground mb-2">Publishing approval mode</p>
          <div className="flex gap-2">
            {APPROVAL_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => { setApprovalMode(m.value); setSettingsOpen(false); }}
                disabled={savingMode}
                className={`flex-1 text-[10px] px-2 py-1.5 rounded-lg border font-medium transition-colors ${
                  approvalMode === m.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/50 bg-muted/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5">
            {APPROVAL_MODES.find(m => m.value === approvalMode)?.desc}
          </p>
        </div>
      )}

      {/* Expanded tabs */}
      {expanded && (
        <div className="border-t border-border/40 px-3.5 pb-3.5 pt-3">
          <div className="flex gap-1 mb-3">
            {(["outputs", "queue", "published", "suggestions"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors capitalize ${activeTab === tab ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab}
                <span className="ml-1 text-[10px] opacity-60">
                  {tab === "outputs"    ? outputCount
                   : tab === "queue"   ? (manager?.publishQueue?.length ?? 0)
                   : tab === "published" ? publishedCount
                   : suggCount}
                </span>
              </button>
            ))}
          </div>

          {/* Outputs tab */}
          {activeTab === "outputs" && (
            <div className="space-y-2">
              {outputCount === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">No outputs yet — click Run</p>
              ) : (
                [...(manager?.outputs?.slice(-12) ?? [])].reverse().map(o => (
                  <OutputRow key={o.id} output={o} launchId={launchId} managerId={managerId} onPublished={onRefresh} />
                ))
              )}
            </div>
          )}

          {/* Queue tab */}
          {activeTab === "queue" && (
            <div className="space-y-2">
              {(manager?.publishQueue?.length ?? 0) === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">Publishing queue is empty</p>
              ) : (
                [...(manager?.publishQueue ?? [])].reverse().slice(0, 20).map(item => (
                  <QueueRow key={item.id} item={item} launchId={launchId} managerId={managerId} onApproved={onRefresh} />
                ))
              )}
            </div>
          )}

          {/* Published tab */}
          {activeTab === "published" && (
            <div className="space-y-2">
              {publishedCount === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">Nothing published yet</p>
              ) : (
                [...(manager?.publishedItems ?? [])].reverse().slice(0, 20).map(item => {
                  const pa = analyticsPosts.find(p => p.publishedItemId === item.id);
                  return (
                    <PublishedRow
                      key={item.id}
                      item={item}
                      managerId={managerId}
                      postAnalytics={pa}
                      hasLessons={hasLessons}
                      hasMemory={hasMemory}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Suggestions tab */}
          {activeTab === "suggestions" && (
            <div className="space-y-2">
              {suggCount === 0 ? (
                <p className="text-[12px] text-muted-foreground/40 italic">Run the manager to get AI suggestions</p>
              ) : (
                (manager?.suggestions ?? []).map((s: ManagerSuggestion) => (
                  <div key={s.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/40 bg-card/30">
                    <span className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                      s.priority === "high"   ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : s.priority === "medium" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-green-500/10 text-green-400 border-green-500/20"
                    }`}>{s.priority}</span>
                    <div>
                      <p className="text-[12px] font-medium">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">{s.reason}</p>
                    </div>
                  </div>
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
  const [managers,       setManagers]       = useState<Partial<Record<MarketingManagerId, MarketingManager>>>({});
  const [analyticsPosts, setAnalyticsPosts] = useState<PostAnalytics[]>([]);
  const [hasLessons,     setHasLessons]     = useState(false);
  const [hasMemory,      setHasMemory]      = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [runningAll,     setRunningAll]     = useState(false);
  const [runAllStatus,   setRunAllStatus]   = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDept = useCallback(async () => {
    try {
      const [mktRes, anlRes] = await Promise.all([
        fetch(`/api/projects/${launchId}/marketing-dept`),
        fetch(`/api/projects/${launchId}/analytics`),
      ]);
      if (mktRes.ok) {
        const data = await mktRes.json() as { marketingDept: { managers: Partial<Record<MarketingManagerId, MarketingManager>> } };
        setManagers(data.marketingDept?.managers ?? {});
      }
      if (anlRes.ok) {
        const anl = await anlRes.json() as { analyticsDept: { posts: PostAnalytics[]; lessons?: unknown[]; lastLearnedAt?: string } | null };
        setAnalyticsPosts(anl.analyticsDept?.posts ?? []);
        setHasLessons((anl.analyticsDept?.lessons?.length ?? 0) > 0);
        setHasMemory(!!anl.analyticsDept?.lastLearnedAt);
      }
    } catch { /* ignore */ }
  }, [launchId]);

  useEffect(() => { fetchDept().finally(() => setLoading(false)); }, [fetchDept]);

  const anyRunning = Object.values(managers).some(m => m?.status === "running");

  useEffect(() => {
    if (anyRunning) { pollRef.current = setInterval(fetchDept, 2500); }
    else { if (pollRef.current) clearInterval(pollRef.current); }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [anyRunning, fetchDept]);

  async function runManager(managerId: MarketingManagerId, instruction?: string) {
    setManagers(prev => ({
      ...prev,
      [managerId]: {
        ...(prev[managerId] ?? { id: managerId, queue: [], history: [], outputs: [], suggestions: [], runCount: 0 }),
        status: "running",
      } as MarketingManager,
    }));
    try {
      const res  = await fetch(`/api/projects/${launchId}/marketing-dept/${managerId}/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ instruction }),
      });
      const data = await res.json() as { manager?: MarketingManager };
      if (data.manager) setManagers(prev => ({ ...prev, [managerId]: data.manager! }));
      else setManagers(prev => ({ ...prev, [managerId]: { ...(prev[managerId]!), status: "error" } }));
    } catch {
      setManagers(prev => ({ ...prev, [managerId]: { ...(prev[managerId]!), status: "error" } }));
    }
  }

  async function runAll() {
    setRunningAll(true);
    for (const mid of ALL_MANAGERS) {
      if (managers[mid]?.status === "paused") continue;
      setRunAllStatus(`Running ${MANAGER_CONFIGS[mid].label}…`);
      await runManager(mid);
    }
    setRunningAll(false);
    setRunAllStatus("");
    await fetchDept();
  }

  const totalOutputs   = Object.values(managers).reduce((n, m) => n + (m?.outputs?.length ?? 0), 0);
  const totalPublished = Object.values(managers).reduce((n, m) => n + (m?.publishedItems?.length ?? 0), 0);
  const totalPending   = Object.values(managers).reduce((n, m) => n + (m?.publishQueue ?? []).filter(i => i.status === "queued").length, 0);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-xl bg-muted/40" />
        {[...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted/30" />)}
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
              ? `${totalOutputs} outputs · ${totalPublished} published${totalPending > 0 ? ` · ${totalPending} awaiting approval` : ""}`
              : "7 AI managers owning every marketing channel"}
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={runningAll || anyRunning}
          className="shrink-0 text-[12px] px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted/30 disabled:opacity-40 transition-colors font-semibold"
        >
          {runningAll ? runAllStatus || "Running…" : "Run All"}
        </button>
      </div>

      {/* Running all status */}
      {runningAll && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-primary/20 bg-primary/[0.03] text-[12px] text-primary/70">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse shrink-0" />
          {runAllStatus}
        </div>
      )}

      {/* Pending approvals banner */}
      {totalPending > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05]">
          <span className="text-lg">⏳</span>
          <p className="text-[12px] text-amber-400/80 flex-1">
            <span className="font-bold">{totalPending} item{totalPending > 1 ? "s" : ""}</span> awaiting approval — open a manager&apos;s Queue tab to review
          </p>
        </div>
      )}

      {/* Manager cards */}
      <div className="space-y-2">
        {ALL_MANAGERS.map(mid => (
          <ManagerCard
            key={mid}
            managerId={mid}
            manager={managers[mid]}
            launchId={launchId}
            onRun={runManager}
            onRefresh={fetchDept}
            isRunningAll={runningAll}
            analyticsPosts={analyticsPosts.filter(p => p.managerId === mid)}
            hasLessons={hasLessons}
            hasMemory={hasMemory}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/30 text-center pt-2">
        All publications update Business Memory · Mission Control sets priorities
      </p>
    </div>
  );
}
