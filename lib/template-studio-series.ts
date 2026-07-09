/**
 * Optional "show / series" context for Template Studio AI modes — persists in localStorage
 * and is written into Video Timeline library metadata for grouping in My Library.
 */

export const TEMPLATE_STUDIO_SERIES_STORAGE_KEY = "content-flywheel-template-studio-series";

export type TemplateStudioSeriesPrefs = {
  seriesTitle: string;
  episodeNumber: number;
};

export function loadTemplateStudioSeriesPrefs(): TemplateStudioSeriesPrefs {
  if (typeof window === "undefined") return { seriesTitle: "", episodeNumber: 1 };
  try {
    const raw = localStorage.getItem(TEMPLATE_STUDIO_SERIES_STORAGE_KEY);
    if (!raw) return { seriesTitle: "", episodeNumber: 1 };
    const j = JSON.parse(raw) as { seriesTitle?: unknown; episodeNumber?: unknown };
    const seriesTitle = typeof j.seriesTitle === "string" ? j.seriesTitle : "";
    const episodeNumber =
      typeof j.episodeNumber === "number" && Number.isFinite(j.episodeNumber) && j.episodeNumber >= 1
        ? Math.floor(j.episodeNumber)
        : 1;
    return { seriesTitle, episodeNumber };
  } catch {
    return { seriesTitle: "", episodeNumber: 1 };
  }
}

export function saveTemplateStudioSeriesPrefs(p: TemplateStudioSeriesPrefs): void {
  try {
    localStorage.setItem(
      TEMPLATE_STUDIO_SERIES_STORAGE_KEY,
      JSON.stringify({
        seriesTitle: p.seriesTitle.trim(),
        episodeNumber: p.episodeNumber >= 1 ? Math.floor(p.episodeNumber) : 1,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Attach series fields for library grouping (only when show name is non-empty). */
export function mergeSeriesIntoTimelinePayload<T extends Record<string, unknown>>(
  content: T,
  seriesTitle: string,
  episodeNumber: number
): T & { seriesTitle?: string; episodeNumber?: number } {
  const st = seriesTitle.trim();
  if (!st) return { ...content };
  const ep = episodeNumber >= 1 ? Math.floor(episodeNumber) : 1;
  return { ...content, seriesTitle: st, episodeNumber: ep };
}

export function buildStickmanLibraryTitle(topicSummary: string, seriesTitle: string, episodeNumber: number): string {
  const topic = topicSummary.trim().slice(0, 72) || "Stickman Whiteboard";
  const st = seriesTitle.trim();
  if (!st) return `Stickman: ${topic} (Draft)`;
  return `${st} · Ep ${episodeNumber >= 1 ? episodeNumber : 1}: ${topic}`.slice(0, 120);
}

/** Safe basename for viral MP4 download when a show is set. */
export function buildViralExportFilenameBase(topic: string, seriesTitle: string, episodeNumber: number): string {
  const t = topic.trim().slice(0, 40) || "viral";
  const st = seriesTitle.trim();
  const safe = (s: string) =>
    s
      .replace(/[/\\?%*:|"<>]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  if (!st) return safe(t);
  const ep = episodeNumber >= 1 ? episodeNumber : 1;
  return safe(`${st}-ep${ep}-${t}`).slice(0, 120);
}
