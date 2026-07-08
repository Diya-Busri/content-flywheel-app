/**
 * BehindTheBuildSection
 * ─────────────────────────────────────────────────────────────
 * Optional post-pipeline content pack for the Execution Workspace.
 *
 * Helps creators tell the authentic story of how they built their product.
 * NOT an advertisement — CF may appear naturally as a tool in the story,
 * but the content is always the creator's own voice and journey.
 *
 * Three states:
 *   TEASER   — project complete, pack not yet generated. Shows a gentle
 *              invitation to create the content pack.
 *   BUILDING — streaming live as GPT generates each of the 5 pieces.
 *              Items appear one by one for a satisfying experience.
 *   COMPLETE — all 5 items shown in expandable panels with copy buttons.
 *              User can use, edit, or ignore entirely.
 *
 * Usage: <BehindTheBuildSection launchId={id} goal={goal} existing={results.behindTheBuild} />
 */
"use client";

import { useState, useCallback } from "react";
import {
  BookOpen, Loader2, CheckCircle2, Copy, Check,
  ChevronDown, ChevronUp, Sparkles, RefreshCw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface ContentItem {
  id:      string;
  label:   string;
  emoji:   string;
  content: string;
}

interface BehindTheBuildData {
  items:       ContentItem[];
  generatedAt: string;
}

interface BehindTheBuildSectionProps {
  launchId: string;
  goal:     string;
  /** Pre-existing pack from stageResults.behindTheBuild (if already generated) */
  existing?: BehindTheBuildData;
}

/* ─── Copy button ────────────────────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 text-[10px] font-semibold text-muted-foreground/70 hover:text-foreground/70 transition-colors"
      title="Copy to clipboard"
    >
      {copied
        ? <><Check className="w-3 h-3 text-green-500" />Copied</>
        : <><Copy className="w-3 h-3" />Copy</>}
    </button>
  );
}

/* ─── Single content item (expandable) ───────────────────────────────────────── */

function ContentItemPanel({ item, defaultOpen }: { item: ContentItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border-b border-border/30 last:border-0">
      {/* Header row */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <span className="text-base shrink-0">{item.emoji}</span>
        <span className="flex-1 text-[12px] font-semibold text-foreground/80">{item.label}</span>
        {/* Preview snippet when closed */}
        {!open && (
          <span className="hidden sm:block text-[10px] text-muted-foreground/50 truncate max-w-[200px] shrink-0">
            {item.content.slice(0, 60)}…
          </span>
        )}
        <CopyButton text={item.content} />
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 ml-1" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 ml-1" />}
      </button>

      {/* Full content */}
      {open && (
        <div className="px-4 pb-4">
          <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
            <pre className="text-[12px] text-foreground/80 whitespace-pre-wrap leading-relaxed font-sans">
              {item.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Streaming item row (shown while generating) ────────────────────────────── */

function StreamingItemRow({
  item,
  isActive,
}: {
  item?: Partial<ContentItem>;
  isActive: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border/30 last:border-0">
      {isActive ? (
        <Loader2 className="w-3.5 h-3.5 text-orange-500 animate-spin shrink-0" />
      ) : item?.emoji ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/20 bg-muted/20 shrink-0" />
      )}

      <span className={[
        "text-[12px]",
        item?.label ? "font-semibold text-foreground/80" : "text-muted-foreground/30",
      ].join(" ")}>
        {item?.label ?? "Waiting..."}
      </span>

      {item?.content && !isActive && (
        <span className="flex-1 text-[10px] text-muted-foreground/50 truncate text-right">
          {item.content.slice(0, 50)}…
        </span>
      )}
    </div>
  );
}

/* ─── Teaser state ───────────────────────────────────────────────────────────── */

const PIECE_LABELS = [
  { emoji: "🎬", label: "TikTok Script"          },
  { emoji: "📸", label: "Instagram Caption"       },
  { emoji: "💼", label: "LinkedIn Post"           },
  { emoji: "🐦", label: "X Post"                 },
  { emoji: "📖", label: "Behind-the-Scenes Story" },
];

/* ─── Main component ─────────────────────────────────────────────────────────── */

export function BehindTheBuildSection({
  launchId,
  goal,
  existing,
}: BehindTheBuildSectionProps) {
  const [phase, setPhase] = useState<"teaser" | "building" | "complete">(
    existing ? "complete" : "teaser"
  );
  const [items,         setItems]         = useState<ContentItem[]>(existing?.items ?? []);
  const [error,         setError]         = useState<string | null>(null);
  const [savedToLib,    setSavedToLib]    = useState(false);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const generate = useCallback(async () => {
    setPhase("building");
    setItems([]);
    setError(null);
    setSavedToLib(false);
    setGeneratedCount(0);

    console.log("[BehindTheBuild] Starting generation", { launchId });

    try {
      console.log("[BehindTheBuild] Calling API…");
      const res = await fetch(`/api/launch/${launchId}/behind-the-build`, {
        method: "POST",
      });

      if (!res.ok || !res.body) {
        const statusText = res.status === 401 ? "Unauthorized — please refresh the page"
          : res.status === 404 ? "Workspace not found in database"
          : res.status === 429 ? "Too many requests — please wait a moment and try again"
          : res.status >= 500  ? "Server error — please try again"
          : `API returned ${res.status}`;
        console.error("[BehindTheBuild] HTTP error", { status: res.status });
        throw new Error(statusText);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let localItems: ContentItem[] = [];

      while (true) {
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

          console.log("[BehindTheBuild] Event:", event.type, event.type === "item" ? (event.label as string) : "");

          switch (event.type as string) {
            case "start":
              console.log("[BehindTheBuild] Generation started");
              setActiveId(PIECE_LABELS[0]?.label ?? null);
              break;

            case "item": {
              const item: ContentItem = {
                id:      event.id      as string,
                label:   event.label   as string,
                emoji:   event.emoji   as string,
                content: event.content as string,
              };
              localItems = [...localItems, item];
              setItems(localItems);
              setGeneratedCount(localItems.length);
              // Advance the active indicator to the next piece
              const idx = PIECE_LABELS.findIndex(p => p.label === item.label);
              const next = PIECE_LABELS[idx + 1];
              setActiveId(next?.label ?? null);
              console.log("[BehindTheBuild] Item received:", item.label);
              break;
            }

            case "done": {
              const count = event.count as number | undefined;
              console.log("[BehindTheBuild] Done — saved to DB", {
                count,
                projectId: event.projectId,
                localItemCount: localItems.length,
              });
              setActiveId(null);
              setSavedToLib(true);
              setPhase("complete");
              break;
            }

            case "error": {
              const reason   = (event.reason ?? event.message) as string | undefined;
              const hadItems = (event.contentGenerated as boolean | undefined) ?? false;
              const itemCount = (event.itemCount as number | undefined) ?? 0;
              console.error("[BehindTheBuild] Server error", { reason, hadItems, itemCount });
              if (hadItems && localItems.length > 0) {
                // Content was generated but save failed — show what we have with a warning
                setItems(localItems);
                setPhase("complete");
                setError(`Content generated but couldn't save to database. ${reason ?? ""} — copy your content now before leaving this page.`);
              } else {
                throw new Error(reason ?? "Generation failed");
              }
              break;
            }
          }
        }
      }

      // If stream ended without a "done" event but we have items, treat as success
      if (localItems.length > 0 && phase !== "complete") {
        console.warn("[BehindTheBuild] Stream ended without done event — treating as complete");
        setItems(localItems);
        setPhase("complete");
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      console.error("[BehindTheBuild] Error:", message);
      setError(message);
      setPhase("teaser");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchId]);

  /* ── Teaser ── */
  if (phase === "teaser") {
    return (
      <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-foreground">📖 Behind the Build</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Optional · Never auto-published</p>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-semibold text-muted-foreground/60">
            Optional
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-[13px] font-medium text-foreground mb-1">
            Your audience would love to see how you built this.
          </p>
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed mb-4">
            I&apos;ve created a behind-the-scenes content pack to help you tell your story authentically.
            Use it, edit it, or ignore it — it&apos;s completely up to you.
          </p>

          {/* What's included */}
          <div className="flex flex-wrap gap-2 mb-5">
            {PIECE_LABELS.map(p => (
              <span key={p.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-[11px] font-medium text-muted-foreground/70">
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </span>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-3">
              <p className="text-[11px] text-red-400 font-medium leading-snug">{error}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                Your content was saved if generation completed. Access from{" "}
                <a href="/dashboard/workspace" className="text-orange-500 hover:underline">My Workspace</a>.
              </p>
            </div>
          )}

          <button
            onClick={() => void generate()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground hover:bg-foreground/90 text-[13px] font-bold text-background transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Behind the Build
          </button>

          <p className="text-[10px] text-muted-foreground/40 mt-3">
            Takes about 15 seconds · Powered by AI · You review before sharing
          </p>
        </div>
      </div>
    );
  }

  /* ── Building (streaming) ── */
  if (phase === "building") {
    return (
      <div className="mt-6 rounded-2xl border border-orange-500/20 bg-orange-500/[0.02] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-orange-500/10 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-orange-500 animate-spin shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-foreground">📖 Behind the Build</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Writing your story...
            </p>
          </div>
        </div>

        {/* Streaming items */}
        <div className="divide-y divide-border/30">
          {PIECE_LABELS.map(piece => {
            const done      = items.find(it => it.label === piece.label);
            const isActive  = activeId === piece.label;
            return (
              <StreamingItemRow
                key={piece.label}
                item={done ?? { emoji: piece.emoji, label: piece.label }}
                isActive={isActive}
              />
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Complete ── */
  return (
    <div className="mt-6 rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
        <span className="text-base">📖</span>
        <div className="flex-1">
          <p className="text-[13px] font-bold text-foreground">Behind the Build</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {items.length} pieces ready · Edit, copy, or use as inspiration
            {savedToLib && <> · <span className="text-green-500">✓ Saved</span></>}
          </p>
        </div>
        <button
          onClick={() => void generate()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 text-[11px] font-semibold text-muted-foreground/60 hover:text-foreground/70 transition-colors"
          title="Regenerate all pieces"
        >
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </button>
      </div>

      {/* Warning if save failed but content was generated */}
      {error && (
        <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/20">
          <p className="text-[11px] text-amber-500 leading-snug">{error}</p>
        </div>
      )}

      {/* Note */}
      <div className="px-5 py-2.5 bg-muted/10 border-b border-border/30">
        <p className="text-[11px] text-muted-foreground/60">
          These are your stories to tell. Share them anywhere — or don&apos;t. Never published automatically.
        </p>
      </div>

      {/* Content items */}
      <div>
        {items.map((item, i) => (
          <ContentItemPanel key={item.id} item={item} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );
}
