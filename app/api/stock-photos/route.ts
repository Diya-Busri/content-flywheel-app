export const dynamic = "force-dynamic";
/**
 * Stock photos via Pexels (free API key at https://www.pexels.com/api/)
 * Keeps same response shape as before for the Graphics tab.
 * Banned keywords (door, building, architecture, etc.) are replaced with a safe default.
 * API key must be server-only (PEXELS_API_KEY). Do not use NEXT_PUBLIC_ for Pexels key.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sanitizePexelsQuery } from "@/lib/auto-design-suggestion";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("query") || "golden bokeh light";
  const query = sanitizePexelsQuery(rawQuery);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(30, Math.max(1, parseInt(searchParams.get("per_page") || "24", 10)));

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "PEXELS_API_KEY is not configured. Get a free key at https://www.pexels.com/api/" },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("orientation", "square");

    const response = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Pexels API error:", response.status, err);
      return Response.json({ error: "Failed to fetch photos" }, { status: response.status });
    }

    const data = (await response.json()) as {
      photos?: Array<{
        id: number;
        alt?: string;
        src?: { small?: string; medium?: string; large?: string; large2x?: string; original?: string };
      }>;
      total_results?: number;
      page?: number;
      per_page?: number;
    };

    const photos = (data.photos ?? []).map((photo) => ({
      id: String(photo.id),
      url: photo.src?.medium ?? photo.src?.small,
      fullUrl: photo.src?.original ?? photo.src?.large2x ?? photo.src?.large ?? photo.src?.medium,
      thumb: photo.src?.small ?? photo.src?.medium,
    }));

    return Response.json({
      photos,
      total: data.total_results ?? 0,
      totalPages: data.per_page ? Math.ceil((data.total_results ?? 0) / data.per_page) : 0,
    });
  } catch (error) {
    console.error("Stock photos error:", error);
    return Response.json({ error: "Could not load photos" }, { status: 500 });
  }
}
