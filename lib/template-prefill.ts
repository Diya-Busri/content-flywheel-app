/**
 * Prefill content when "Use Template" is clicked. Stored in sessionStorage so
 * the target editor can pre-fill with the template content.
 */

const STORAGE_KEY = "content-flywheel-template-prefill";

export type TemplatePrefill = {
  content: string;
  formatType: string;
  title: string;
  templateId?: string;
};

/** Map format_type to the editor URL to open when using a template. */
export const FORMAT_TYPE_TO_EDITOR_PATH: Record<string, string> = {
  copy_writer: "/dashboard/content-studio/copy-writer",
  script: "/dashboard/content-studio/create/scripts",
  seo: "/dashboard/content-studio/seo",
  ebook: "/dashboard/digital-products",
  planner: "/dashboard/digital-products",
  workbook: "/dashboard/digital-products",
  spreadsheet: "/dashboard/digital-products",
  notion: "/dashboard/digital-products",
  course: "/dashboard/digital-products",
  checklist: "/dashboard/digital-products",
  journal: "/dashboard/digital-products",
  marketing: "/dashboard/digital-products",
  other: "/dashboard/content-studio/copy-writer",
};

export function getTemplatePrefill(): TemplatePrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    return {
      content: typeof p.content === "string" ? p.content : "",
      formatType: typeof p.formatType === "string" ? p.formatType : "other",
      title: typeof p.title === "string" ? p.title : "",
      templateId: typeof p.templateId === "string" ? p.templateId : undefined,
    };
  } catch {
    return null;
  }
}

export function setTemplatePrefill(prefill: TemplatePrefill): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // ignore
  }
}

export function clearTemplatePrefill(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getEditorPathForFormatType(formatType: string): string {
  return FORMAT_TYPE_TO_EDITOR_PATH[formatType] ?? FORMAT_TYPE_TO_EDITOR_PATH.other;
}
