export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/intelligence/run
 *
 * Trigger the intelligence pipeline for the authenticated user.
 * Updates scores, detects patterns, generates recommendations.
 * Responds immediately — all work happens async.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runIntelligencePipeline } from "@/lib/intelligence-engine";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Trigger async — don't await
  void runIntelligencePipeline(userId).catch(() => {});

  return NextResponse.json({ ok: true, message: "Intelligence pipeline started" });
}
