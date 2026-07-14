import { describe, it, expect } from "vitest";
import { resolveApplyToolCta } from "@/lib/academy-checkpoint-routing";

describe("resolveApplyToolCta", () => {
  it("returns null for a null/unset key — no CTA, never a broken link", () => {
    expect(resolveApplyToolCta(null, {})).toBeNull();
    expect(resolveApplyToolCta(undefined, {})).toBeNull();
  });

  it("returns null for an unknown/future key instead of throwing", () => {
    expect(resolveApplyToolCta("some_future_tool_key", {})).toBeNull();
  });

  it("builds a prefilled niche discovery link from the promptSeed", () => {
    const cta = resolveApplyToolCta("niche_discovery", { promptSeed: "dog training" });
    expect(cta).not.toBeNull();
    expect(cta!.href).toBe("/dashboard/digital-products/discover?topic=dog+training");
    expect(cta!.label).toBeTruthy();
  });

  it("builds a prefilled product creator link from the promptSeed", () => {
    const cta = resolveApplyToolCta("product_creator", { promptSeed: "budgeting template" });
    expect(cta!.href).toBe("/dashboard/digital-products/create?topic=budgeting+template");
  });

  it("falls back to a bare route (no query string) when no promptSeed is available", () => {
    const cta = resolveApplyToolCta("niche_discovery", {});
    expect(cta!.href).toBe("/dashboard/digital-products/discover");
  });

  it("caps an overly long promptSeed instead of passing it through raw", () => {
    const long = "x".repeat(500);
    const cta = resolveApplyToolCta("niche_discovery", { promptSeed: long });
    const topic = new URL(`https://x${cta!.href}`).searchParams.get("topic");
    expect(topic!.length).toBeLessThanOrEqual(200);
  });

  it("plain-navigation destinations (no verified prefill) always return the bare route, ignoring promptSeed", () => {
    expect(resolveApplyToolCta("ai_coach", { promptSeed: "anything" })!.href).toBe("/dashboard/ai-coach");
    expect(resolveApplyToolCta("design_studio", { promptSeed: "anything" })!.href).toBe("/dashboard/design-studio");
    expect(resolveApplyToolCta("content_calendar", { promptSeed: "anything" })!.href).toBe("/dashboard/content-calendar");
  });
});
