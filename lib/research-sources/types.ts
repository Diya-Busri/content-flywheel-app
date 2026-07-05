/**
 * lib/research-sources/types.ts
 *
 * Canonical types for the Content Flywheel Research Engine source system.
 * Shared between the API route and the UI component.
 *
 * Architecture:
 *   - Every source exposes the same SourceDef interface
 *   - Sources that are "connected" have a real run() function
 *   - Sources that are "not-connected" require an API key not yet configured
 *   - Sources that are "coming-soon" are listed but have no runner yet
 *   - The pipeline runs all connected sources in parallel; others are skipped
 */

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * Reflects the current integration state of a research source.
 *
 * connected     — live API, returns real data
 * not-connected — integration built but needs an API key / OAuth setup
 * coming-soon   — integration planned; code not yet written
 * error         — was connected but is currently failing
 */
export type SourceStatus = "connected" | "not-connected" | "coming-soon" | "error";

// ─── Category ────────────────────────────────────────────────────────────────

/** Top-level category that groups related research sources */
export type SourceCategory =
  | "web"
  | "social"
  | "communities"
  | "marketplaces"
  | "seo"
  | "advertising"
  | "reviews"
  | "competitors"
  | "content"
  | "ai-intelligence";

// ─── Citation ────────────────────────────────────────────────────────────────

/** A single traceable reference returned by a live source connector */
export interface SourceCitation {
  /** Human-readable title of the referenced page / post / article */
  title: string;
  /** Direct URL to the source */
  url: string;
  /** Which connector produced this citation, e.g. "Wikipedia", "Hacker News", "Reddit" */
  source: string;
}

// ─── Run Result ──────────────────────────────────────────────────────────────

/** The result returned when a source's run() function is called */
export interface SourceRunResult {
  id:           string;
  name:         string;
  category:     SourceCategory;
  /** "success" = ran OK; "error" = runner threw; "skipped" = not connected */
  status:       "success" | "error" | "skipped";
  /** Arbitrary structured data passed to the AI synthesiser */
  data:         Record<string, unknown>;
  /** One-line human-readable summary for the streaming progress panel */
  summary:      string;
  /** true if the data came from a real external API; false if AI-simulated */
  isLiveData:   boolean;
  /** 0–1 confidence weight used in synthesis context ordering */
  confidence:   number;
  /** Traceable citations from this source run */
  citations:    SourceCitation[];
  usedFallback?: boolean;
  durationMs?:  number;
  error?:       string;
}

// ─── Source Definition ───────────────────────────────────────────────────────

/**
 * The interface every research source must satisfy.
 *
 * Adding a new provider is as simple as adding one SourceDef object to the
 * registry — no other code changes needed.
 */
export interface SourceDef {
  id:          string;
  name:        string;
  category:    SourceCategory;
  status:      SourceStatus;
  /** Emoji used in the UI status grid */
  emoji:       string;
  description: string;
  /** Human-readable provider attribution, e.g. "reddit-api", "openai", "wikipedia-api" */
  provider?:   string;
  /**
   * Run the source against a query.
   * Only present when status === "connected".
   * Receives the OpenAI API key so AI-assisted sources can enrich their results.
   */
  run?: (query: string, openAiKey: string) => Promise<SourceRunResult>;
}

// ─── Pipeline Event ───────────────────────────────────────────────────────────

/** Events streamed from the research pipeline to the client */
export type PipelineEvent =
  | { type: "init";            query: string; analysts: Array<{ id: string; displayName: string; emoji: string; description: string }> }
  | { type: "analyst-update"; id: string; status: "working" | "done" | "error"; summary?: string; usedFallback?: boolean; data?: Record<string, unknown>; citations?: SourceCitation[]; duration?: number }
  | { type: "synthesis-start" }
  | { type: "synthesis-done"; report: Record<string, unknown>; citations: SourceCitation[]; providerData: Record<string, Record<string, unknown>>; sourceMeta: Array<{ id: string; displayName: string; usedFallback: boolean; dataPoints: number; liveData: boolean }>; generatedAt: string }
  | { type: "error";           message: string };
