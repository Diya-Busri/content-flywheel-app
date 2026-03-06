import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * GET: YouTube search autocomplete suggestions.
 * Query: ?q=search+term
 * Returns string[] of suggestions (no API key required; uses Google suggest endpoint).
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q");
    const query = (q ?? "").trim().slice(0, 100);
    if (!query) {
      return NextResponse.json({ suggestions: [] });
    }

    const url = new URL("https://suggestqueries.google.com/complete/search");
    url.searchParams.set("client", "youtube");
    url.searchParams.set("ds", "yt");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "en");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const text = await res.text();

    // Response is often JSONP: callback(["query", [["suggestion1",...], ...]])
    // or a JSON array: ["query", [["suggestion1", 0, [512]], ...]]
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length >= 2 && Array.isArray(parsed[1])) {
        const raw = parsed[1];
        for (const item of raw) {
          if (typeof item === "string") {
            suggestions.push(item);
          } else if (Array.isArray(item) && typeof item[0] === "string") {
            suggestions.push(item[0]);
          }
        }
      }
    } catch {
      // If JSONP, try to extract array
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr) && arr.length >= 2 && Array.isArray(arr[1])) {
            const raw = arr[1];
            for (const item of raw) {
              if (typeof item === "string") suggestions.push(item);
              else if (Array.isArray(item) && typeof item[0] === "string") suggestions.push(item[0]);
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 15) });
  } catch (e) {
    console.error("seo youtube-autocomplete:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error", suggestions: [] },
      { status: 500 }
    );
  }
}
