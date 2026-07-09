/**
 * POST /api/launch/start
 * Creates a new AI launch project and returns { launchId }.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { launchProjectsTable, type LaunchPreferences } from "@/db/schema/launch-schema";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";

    if (!goal) return NextResponse.json({ error: "Goal is required" }, { status: 400 });

    // Defence-in-depth: rule-based guard (no AI) to block obvious placeholder inputs
    const norm = goal.toLowerCase().replace(/['"!?.]/g, "").trim();
    const NO_IDEA = new Set(["idk", "i dont know", "i don't know", "not sure", "unsure", "no idea", "dunno", "help me decide", "help me choose"]);
    const INVALID  = new Set(["test", "testing", "hello", "hi", "hey", "asdf", "qwerty", "foo", "bar", "baz", "lorem", "ipsum", "123", "abc"]);
    const SPAM_RE  = [/^(.)\1{2,}$/, /^[qwerty]+$/i, /^[asdfghjkl]+$/i, /^[zxcvbnm]+$/i];
    const isSpam   = SPAM_RE.some(r => r.test(norm));
    if (NO_IDEA.has(norm) || INVALID.has(norm) || isSpam || norm.replace(/\s/g, "").length < 8) {
      return NextResponse.json({ error: "INVALID_GOAL", message: "Please enter a real business idea." }, { status: 400 });
    }

    // Parse and validate user preferences
    const rawPrefs = body.preferences as Record<string, unknown> | undefined;
    const VALID_LENGTHS = new Set(["short", "medium", "long"]);
    const VALID_COUNTS  = new Set([3, 5, 8, 10]);
    const preferences: LaunchPreferences = {
      productLength: VALID_LENGTHS.has(rawPrefs?.productLength as string)
        ? (rawPrefs!.productLength as LaunchPreferences["productLength"]) : "medium",
      includeImages: rawPrefs?.includeImages === true,
      carouselCount: VALID_COUNTS.has(Number(rawPrefs?.carouselCount))
        ? (Number(rawPrefs!.carouselCount) as LaunchPreferences["carouselCount"]) : 5,
    };

    const [project] = await db
      .insert(launchProjectsTable)
      .values({ userId, goal, status: "queued", currentStage: "research", progress: 0,
        stageResults: { preferences } })
      .returning({ id: launchProjectsTable.id });

    if (!project?.id) return NextResponse.json({ error: "Failed to create project" }, { status: 500 });

    return NextResponse.json({ launchId: project.id });
  } catch (err) {
    console.error("[launch/start]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
