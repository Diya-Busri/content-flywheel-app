import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "pexels";

export const dynamic = "force-dynamic";

/** Pexels video file (quality, link). */
type PexelsVideoFile = { id?: number; quality?: string; width?: number; height?: number; link: string; file_type?: string };
/** Pexels video picture (thumbnail). */
type PexelsVideoPicture = { id?: number; picture?: string; nr?: number };
/** Pexels API video object (v1 and legacy shapes). */
type PexelsVideo = {
  id: number;
  width?: number;
  height?: number;
  url?: string;
  duration?: number;
  image?: string;
  image_url?: string;
  video_files?: PexelsVideoFile[];
  video_pictures?: PexelsVideoPicture[];
};

export type VideoSearchHit = {
  id: number;
  url: string;
  duration: number;
  thumbnail: string;
  width?: number;
  height?: number;
};

/**
 * GET /api/videos/search?q=office+workspace&per_page=10
 * Search Pexels stock videos. Returns: video URL (streaming), duration (seconds), thumbnail.
 * Requires PEXELS_API_KEY in env (free at https://www.pexels.com/api/new/).
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const perPage = Math.min(20, Math.max(1, parseInt(searchParams.get("per_page") ?? "10", 10) || 10));

    if (!q) return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });

    const apiKey = process.env.PEXELS_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Pexels API key not configured. Add PEXELS_API_KEY to .env.local (free at https://www.pexels.com/api/new/)." },
        { status: 503 }
      );
    }

    const client = createClient(apiKey);
    const response = await (client.videos.search as (params: { query: string; per_page: number }) => Promise<{ videos?: PexelsVideo[] }>)({
      query: q,
      per_page: perPage,
    });

    const videos = Array.isArray(response.videos) ? response.videos : [];
    const results: VideoSearchHit[] = videos.map((v) => {
      const files = Array.isArray(v.video_files) ? v.video_files : [];
      const hd = files.find((f) => f.quality === "hd" && f.link);
      const sd = files.find((f) => f.link);
      const best = hd ?? sd ?? files[0];
      const url = best?.link ?? "";
      const pictures = Array.isArray(v.video_pictures) ? v.video_pictures : [];
      const thumbPic = pictures.find((p) => p.picture) ?? pictures[0];
      const thumbnail = v.image ?? v.image_url ?? (thumbPic as PexelsVideoPicture & { picture?: string })?.picture ?? "";
      const duration = typeof v.duration === "number" ? v.duration : 0;
      return {
        id: v.id,
        url,
        duration,
        thumbnail,
        width: best?.width ?? v.width,
        height: best?.height ?? v.height,
      };
    }).filter((r) => r.url);

    return NextResponse.json({ videos: results });
  } catch (err) {
    console.error("[videos/search]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video search failed" },
      { status: 500 }
    );
  }
}
