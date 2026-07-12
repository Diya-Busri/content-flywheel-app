import type { JarvisToolName, ExecutionStepStatus } from "@/db/schema/jarvis-schema";
import type { JarvisStepDTO } from "@/hooks/useJarvisRun";

/** The 5 tool-backed stages shown in the live execution panel, in order. */
export type ExecutionStageKey =
  | "reading_memory"
  | "analysing_product"
  | "creating_strategy"
  | "generating_assets"
  | "saving";

export const EXECUTION_STAGES: Array<{ key: ExecutionStageKey; label: string; tools: JarvisToolName[] }> = [
  {
    key: "reading_memory",
    label: "Reading business memory",
    tools: ["get_business_profile", "get_brand_memory", "get_existing_content"],
  },
  {
    key: "analysing_product",
    label: "Analysing product",
    tools: ["get_product_details", "analyse_offer"],
  },
  {
    key: "creating_strategy",
    label: "Creating strategy",
    tools: ["create_content_strategy"],
  },
  {
    key: "generating_assets",
    label: "Generating assets",
    tools: ["generate_video_scripts", "generate_carousel_copy", "generate_email_campaign"],
  },
  {
    key: "saving",
    label: "Saving",
    tools: ["save_content_campaign"],
  },
];

export type StageStatus = "pending" | "running" | "completed" | "failed";

/** Latest step per tool name (steps are append-only, so the last one wins —
 * this is what makes a retry show its new attempt instead of the stale one). */
export function latestStepByTool(steps: JarvisStepDTO[]): Map<JarvisToolName, JarvisStepDTO> {
  const map = new Map<JarvisToolName, JarvisStepDTO>();
  for (const step of steps) {
    const existing = map.get(step.toolName);
    if (!existing || new Date(step.createdAt) >= new Date(existing.createdAt)) {
      map.set(step.toolName, step);
    }
  }
  return map;
}

export function stageStatus(tools: JarvisToolName[], latest: Map<JarvisToolName, JarvisStepDTO>): StageStatus {
  const relevant = tools.map((t) => latest.get(t)).filter((s): s is JarvisStepDTO => Boolean(s));
  if (relevant.length === 0) return "pending";
  const statuses = relevant.map((s) => s.status);
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.every((s: ExecutionStepStatus) => s === "completed" || s === "skipped")) return "completed";
  return "running";
}

export function formatToolLabel(tool: JarvisToolName): string {
  return tool
    .split("_")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diffMs / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
