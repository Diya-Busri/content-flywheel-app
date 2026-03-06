import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const dynamic = "force-dynamic";

/**
 * Base /api/brand-builder route.
 * Use specific endpoints: POST /api/brand-builder/verify, POST /api/brand-builder/generate,
 * POST /api/brand-builder/calendar/generate, POST /api/brand-builder/caption/generate, etc.
 */
export async function GET() {
  const [userId, err] = await requireAuth();
  if (err) return err;
  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;
  return NextResponse.json({
    ok: true,
    userId,
    message: "Use sub-routes: /verify, /generate, /calendar/generate, /calendar/save, /caption/generate, /drop-scripts/generate, /drop-scripts/save, /launch-checklist, /launch-checklist/generate, /launch-checklist/save",
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
        "POST /api/brand-builder/verify",
        "POST /api/brand-builder/generate",
        "POST /api/brand-builder/calendar/generate",
        "POST /api/brand-builder/calendar/save",
        "POST /api/brand-builder/caption/generate",
        "POST /api/brand-builder/drop-scripts/generate",
        "POST /api/brand-builder/drop-scripts/save",
        "GET /api/brand-builder/launch-checklist",
        "POST /api/brand-builder/launch-checklist/generate",
        "POST /api/brand-builder/launch-checklist/save",
      ],
    },
    { status: 400 }
  );
}
