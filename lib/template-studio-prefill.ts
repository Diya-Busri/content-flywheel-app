/**
 * Prefill Template Studio with slides and brand colours (e.g. from Campaign Mode carousel).
 */

const STORAGE_KEY = "content-flywheel-template-studio-prefill";

export type TemplateStudioPrefillSlide = {
  heading?: string;
  body?: string;
  bg_color?: string;
};

export type TemplateStudioPrefill = {
  slides: TemplateStudioPrefillSlide[];
  brandPrimary?: string;
  brandSecondary?: string;
};

export function getTemplateStudioPrefill(): TemplateStudioPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    const slides = Array.isArray(p.slides)
      ? (p.slides as unknown[]).map((s) => {
          const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
          return {
            heading: typeof o.heading === "string" ? o.heading : "",
            body: typeof o.body === "string" ? o.body : "",
            bg_color: typeof o.bg_color === "string" ? o.bg_color : undefined,
          };
        })
      : [];
    return {
      slides,
      brandPrimary: typeof p.brandPrimary === "string" ? p.brandPrimary : undefined,
      brandSecondary: typeof p.brandSecondary === "string" ? p.brandSecondary : undefined,
    };
  } catch {
    return null;
  }
}

export function setTemplateStudioPrefill(prefill: TemplateStudioPrefill): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // ignore
  }
}

export function clearTemplateStudioPrefill(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
