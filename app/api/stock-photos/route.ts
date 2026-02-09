/**
 * Stock photos via Pexels (free API key at https://www.pexels.com/api/)
 * Keeps same response shape as before for the Graphics tab.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "relationships";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(30, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));

  const apiKey = process.env.PEXELS_API_KEY || process.env.NEXT_PUBLIC_PEXELS_API_KEY;
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
