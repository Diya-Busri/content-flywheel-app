import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/is-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

function parseHandle(input: string): string | null {
  try {
    const url = new URL(input.startsWith("http") ? input : `https://${input}`);
    if (url.hostname.includes("tiktok.com")) {
      const m = url.pathname.match(/^\/@?([^/?]+)/);
      if (m) return m[1].replace(/^@/, "");
    }
  } catch {
    // not a URL
  }
  const m = input.match(/^@?([a-zA-Z0-9_.]+)$/);
  return m ? m[1] : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(v: any): number | undefined {
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const handle = parseHandle(url.trim());
  if (!handle) return NextResponse.json({ error: "Invalid TikTok URL or handle" }, { status: 400 });

  try {
    const profileUrl = `https://www.tiktok.com/@${handle}`;
    const res = await fetch(profileUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `TikTok returned ${res.status} — account may be private or not exist` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // TikTok embeds account data as JSON in a script tag
    const scriptMatch = html.match(
      /<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*type="application\/json"[^>]*>([^<]+)<\/script>/
    );
    if (!scriptMatch) {
      return NextResponse.json(
        { error: "Could not read TikTok profile — account may be private or TikTok blocked the request" },
        { status: 422 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = JSON.parse(scriptMatch[1]) as Record<string, any>;
    const scope = data?.["__DEFAULT_SCOPE__"] ?? {};
    const userDetail = scope["webapp.user-detail"];

    if (!userDetail) {
      return NextResponse.json({ error: "User not found or account is private" }, { status: 422 });
    }

    const { user, stats } = userDetail?.userInfo ?? {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawVideos: any[] = scope["webapp.user-post"]?.itemList ?? [];
    const videos = rawVideos.slice(0, 30).map((v) => ({
      id: v.id as string,
      description: (v.desc as string) ?? "",
      createdAt: v.createTime ? new Date((v.createTime as number) * 1000).toISOString().split("T")[0] : undefined,
      views: safeNum(v.stats?.playCount),
      likes: safeNum(v.stats?.diggCount),
      comments: safeNum(v.stats?.commentCount),
      shares: safeNum(v.stats?.shareCount),
      duration: safeNum(v.video?.duration),
    }));

    // Derived stats
    const viewCounts = videos.map((v) => v.views ?? 0).filter((n) => n > 0);
    const avgViews = viewCounts.length ? Math.round(viewCounts.reduce((a, b) => a + b, 0) / viewCounts.length) : null;
    const topVideo = videos.length ? [...videos].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] : null;

    return NextResponse.json({
      handle,
      profileUrl,
      profile: {
        username: user?.uniqueId as string | undefined,
        nickname: user?.nickname as string | undefined,
        bio: user?.signature as string | undefined,
        verified: user?.verified as boolean | undefined,
        private: user?.privateAccount as boolean | undefined,
      },
      stats: {
        followers: safeNum(stats?.followerCount),
        following: safeNum(stats?.followingCount),
        totalLikes: safeNum(stats?.heartCount),
        videoCount: safeNum(stats?.videoCount),
      },
      derived: {
        avgViewsLast30Videos: avgViews,
        topVideoDescription: topVideo?.description,
        topVideoViews: topVideo?.views,
        videosAnalyzed: videos.length,
      },
      recentVideos: videos,
    });
  } catch (err) {
    console.error("[tiktok-analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch TikTok data" },
      { status: 500 }
    );
  }
}
