export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

/**
 * POST: Deprecated. Use Video Creation Guide flow instead.
 * Returns 410 Gone.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId);

  if (rl) return rl;

  return NextResponse.json(
    {
      error: "Product-in-hand preview is no longer available. Use Step 4: Video Creation Guides instead.",
    },
    { status: 410 }
  );
}
