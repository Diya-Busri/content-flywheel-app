export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/agents/daily-review
 *
 * Runs all agents (force mode) and generates a daily business brief.
 * Returns the brief immediately — this call IS synchronous (awaits all agents).
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateDailyBrief } from "@/lib/agent-orchestrator";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

export async function POST() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = (sessionClaims?.email as string | undefined) === ADMIN_EMAIL;

  try {
    const brief = await generateDailyBrief(userId, isAdmin);
    return NextResponse.json(brief);
  } catch (err) {
    console.error("[agents/daily-review]", err);
    return NextResponse.json({ error: "Failed to generate daily brief" }, { status: 500 });
  }
}
