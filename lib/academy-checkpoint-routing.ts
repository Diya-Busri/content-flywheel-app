/**
 * Central "Help me apply this" → destination-tool mapping.
 *
 * Only destinations with a stable, verified route are wired up here. Two
 * tiers exist:
 *  - Prefilled: the destination has a verified, safe query-param prefill
 *    mechanism (see DiscoverPageClient's `?topic=` and CreateFlow's `?topic=`
 *    handling) — the CTA carries the exercise result over as a seed value.
 *  - Plain navigation: the destination's route is stable and genuinely
 *    relevant, but it has NO query-param prefill support today (checked: AI
 *    Coach, Design Studio, Content Calendar, My Store, and Caption Library
 *    do not read any prefill param as of this writing). Rather than bolt
 *    prefill support onto those unrelated pages — out of scope for this
 *    feature and risky to their own behaviour — these just link straight to
 *    the tool with no promptSeed used. Still never a broken link; just a
 *    plainer CTA.
 *
 * Every other `apply_tool_key` value — including unknown/future keys —
 * resolves to `undefined`, and callers must render the generated output
 * without a CTA rather than a broken link. Nothing here is hardcoded into
 * components: admins pick a key on the lesson (academy_lessons.apply_tool_key),
 * this map is the single place that turns a key into a real destination.
 *
 * This is separate from — and does not replace — the lesson's existing
 * plain `ctaLabel`/`ctaRoute` fields, which keep working exactly as before.
 */

export type ApplyToolKey =
  | "niche_discovery"
  | "product_creator"
  | "ai_coach"
  | "design_studio"
  | "content_calendar";

export const APPLY_TOOL_KEYS: ApplyToolKey[] = [
  "niche_discovery",
  "product_creator",
  "ai_coach",
  "design_studio",
  "content_calendar",
];

export const APPLY_TOOL_LABELS: Record<ApplyToolKey, string> = {
  niche_discovery: "Niche Discovery — compare niche options",
  product_creator: "Product Creator — turn this into a product",
  ai_coach: "AI Coach — get more open-ended help",
  design_studio: "Design Studio — turn this into a visual",
  content_calendar: "Content Calendar — schedule this",
};

/** Minimal, non-sensitive context passed to the destination tool. Never full user records. */
export interface ApplicationOutputContext {
  /** Short (<200 char) seed used to prefill the destination tool's query param. */
  promptSeed?: string;
}

interface ApplyToolConfig {
  route: string;
  label: string;
  buildHref: (ctx: ApplicationOutputContext) => string;
}

const APPLY_TOOL_MAP: Record<ApplyToolKey, ApplyToolConfig> = {
  niche_discovery: {
    route: "/dashboard/digital-products/discover",
    label: "Compare niche options",
    buildHref: (ctx) => {
      const params = new URLSearchParams();
      if (ctx.promptSeed) params.set("topic", ctx.promptSeed.slice(0, 200));
      const qs = params.toString();
      return qs ? `/dashboard/digital-products/discover?${qs}` : "/dashboard/digital-products/discover";
    },
  },
  product_creator: {
    route: "/dashboard/digital-products/create",
    label: "Create this product",
    buildHref: (ctx) => {
      const params = new URLSearchParams();
      if (ctx.promptSeed) params.set("topic", ctx.promptSeed.slice(0, 200));
      const qs = params.toString();
      return qs ? `/dashboard/digital-products/create?${qs}` : "/dashboard/digital-products/create";
    },
  },
  // No prefill param exists on these pages today (verified) — plain navigation only.
  ai_coach: {
    route: "/dashboard/ai-coach",
    label: "Open AI Coach",
    buildHref: () => "/dashboard/ai-coach",
  },
  design_studio: {
    route: "/dashboard/design-studio",
    label: "Open Design Studio",
    buildHref: () => "/dashboard/design-studio",
  },
  content_calendar: {
    route: "/dashboard/content-calendar",
    label: "Open Content Calendar",
    buildHref: () => "/dashboard/content-calendar",
  },
};

/**
 * Resolve a lesson's `apply_tool_key` into a CTA the checkpoint can render.
 * Returns null for unknown/unset keys — callers must treat that as "no CTA",
 * never a broken link.
 */
export function resolveApplyToolCta(
  applyToolKey: string | null | undefined,
  ctx: ApplicationOutputContext
): { href: string; label: string } | null {
  if (!applyToolKey) return null;
  const config = APPLY_TOOL_MAP[applyToolKey as ApplyToolKey];
  if (!config) return null;
  return { href: config.buildHref(ctx), label: config.label };
}
