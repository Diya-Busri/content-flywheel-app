/**
 * Fetch one Pexels video URL for B-roll (e.g. "someone applying" product).
 * Uses PEXELS_API_KEY (server-only — never use NEXT_PUBLIC_ prefix for this key).
 * Prefers portrait, HD, duration 5–45s.
 */

export type PexelsVideoResult = {
  videoUrl: string;
  duration: number;
  width: number;
  height: number;
} | null;

/**
 * Derive a short search query from product name/description for B-roll (e.g. someone applying product).
 * Uses description so B-roll matches how the product is used.
 */
export function derivePexelsQuery(productName: string, productDescription: string): string {
  const desc = (productDescription ?? "").slice(0, 200).toLowerCase();
  const text = `${productName} ${desc}`.toLowerCase();
  // Prefer "person applying/using" style for UGC feel—matches script and product description
  if (/\b(perfume|fragrance|mist|spray|scent|cheirosa)\b/.test(text)) return "woman applying perfume spray";
  if (/\b(skincare|serum|cream|moisturizer|face|glow)\b/.test(text)) return "woman applying skincare serum";
  if (/\b(lipstick|lip|makeup|cosmetic|lip gloss)\b/.test(text)) return "woman applying makeup";
  if (/\b(hair|shampoo|conditioner|styling)\b/.test(text)) return "person applying hair product";
  if (/\b(body|lotions|bath|body mist)\b/.test(text)) return "person applying body lotion";
  if (/\b(apply|applying|spray|use|using)\b/.test(desc)) return "hands applying beauty product";
  // Generic: product in use / hands
  return "hands holding product beauty";
}

/**
 * Search Pexels for one portrait video suitable for B-roll. Returns the first HD (or SD) file link, or null.
 */
export async function fetchOnePexelsVideo(searchQuery: string): Promise<PexelsVideoResult> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey?.trim()) {
    console.log("[pexels-video] PEXELS_API_KEY not set, skipping B-roll");
    return null;
  }

  const url = new URL("https://api.pexels.com/videos/search");
  url.searchParams.set("query", searchQuery);
  url.searchParams.set("orientation", "portrait");
  url.searchParams.set("per_page", "5");
  url.searchParams.set("size", "medium"); // full HD or similar

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey.trim() },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn("[pexels-video] Pexels API error:", res.status);
      return null;
    }
    const data = (await res.json()) as {
      videos?: Array<{
        id: number;
        duration?: number;
        width?: number;
        height?: number;
        video_files?: Array<{
          quality?: string;
          width?: number;
          height?: number;
          link?: string;
          file_type?: string;
        }>;
      }>;
    };
    const videos = data.videos ?? [];
    for (const video of videos) {
      const duration = video.duration ?? 0;
      if (duration < 5 || duration > 60) continue; // prefer 5–60s clips
      const files = video.video_files ?? [];
      const hd = files.find((f) => f.quality === "hd" && f.link && (f.file_type === "video/mp4" || f.file_type?.includes("mp4")));
      const sd = files.find((f) => f.quality === "sd" && f.link && (f.file_type === "video/mp4" || f.file_type?.includes("mp4")));
      const best = hd ?? sd ?? files.find((f) => f.link && (f.file_type === "video/mp4" || f.file_type?.includes("mp4")));
      if (best?.link) {
        console.log("[pexels-video] Using B-roll:", searchQuery, "duration", duration, "quality", best.quality);
        return {
          videoUrl: best.link,
          duration,
          width: best.width ?? video.width ?? 1080,
          height: best.height ?? video.height ?? 1920,
        };
      }
    }
  } catch (err) {
    console.warn("[pexels-video] Fetch error:", err instanceof Error ? err.message : err);
  }
  return null;
}
