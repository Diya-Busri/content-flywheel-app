/**
 * Stock photos via Unsplash API (https://unsplash.com/developers).
 * Set UNSPLASH_ACCESS_KEY in env. Same response shape as stock-photos for the Graphics panel.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "nature";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const perPage = Math.min(30, Math.max(1, parseInt(searchParams.get("per_page") || "24", 10)));

  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    return Response.json(
      { error: "UNSPLASH_ACCESS_KEY is not configured. Get a key at https://unsplash.com/oauth/applications" },
      { status: 503 }
    );
  }

  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("orientation", "squarish");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Unsplash API error:", response.status, err);
      return Response.json({ error: "Failed to fetch photos" }, { status: response.status });
    }

    const data = (await response.json()) as {
      total?: number;
      total_pages?: number;
      results?: Array<{
        id: string;
        urls?: { raw?: string; full?: string; regular?: string; small?: string; thumb?: string };
      }>;
    };

    const photos = (data.results ?? []).map((photo) => {
      const urls = photo.urls ?? {};
      return {
        id: photo.id,
        url: urls.regular ?? urls.small,
        fullUrl: urls.full ?? urls.regular ?? urls.raw ?? urls.small,
        thumb: urls.small ?? urls.thumb ?? urls.regular,
      };
    });

    return Response.json({
      photos,
      total: data.total ?? 0,
      totalPages: data.total_pages ?? 0,
    });
  } catch (error) {
    console.error("Unsplash photos error:", error);
    return Response.json({ error: "Could not load photos" }, { status: 500 });
  }
}
