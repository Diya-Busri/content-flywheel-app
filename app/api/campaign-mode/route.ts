import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * Base /api/campaign-mode route.
 * Use specific endpoints: POST /api/campaign-mode/verify, GET|POST /api/campaign-mode/workspaces,
 * GET|POST /api/campaign-mode/campaigns, POST /api/campaign-mode/concept/generate, etc.
 */
export async function GET() {
  const [userId, err] = await requireAuth();
  if (err) return err;
  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;
  return NextResponse.json({
    ok: true,
    userId,
    message: "Use sub-routes: /verify, /workspaces, /campaigns, /concept/generate, /video-script, /carousel-slides, /caption-seo",
  });
}

export async function POST(request: NextRequest) {
  const [userId, err] = await requireAuth();
  if (err) return err;
  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;
  return NextResponse.json(
    {
      error: "Use a specific endpoint",
      endpoints: [
        "POST /api/campaign-mode/verify",
        "GET|POST /api/campaign-mode/workspaces",
        "GET|POST /api/campaign-mode/campaigns",
        "POST /api/campaign-mode/concept/generate",
        "POST /api/campaign-mode/video-script",
        "POST /api/campaign-mode/carousel-slides",
        "POST /api/campaign-mode/caption-seo",
      ],
    },
    { status: 400 }
  );
}
