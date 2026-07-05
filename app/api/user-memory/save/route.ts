export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/user-memory/save
 *
 * Save any piece of knowledge to the user's personal AI memory.
 * Called automatically by AI features (coach, research, analytics…)
 * or manually by the user.
 *
 * Body: {
 *   category:         string         — memory category key
 *   type:             string         — sub-type within category
 *   title:            string         — short headline
 *   content:          string         — full content
 *   source?:          MemorySource   — which feature generated this
 *   metadata?:        object         — category-specific fields
 *   tags?:            string[]
 *   memoryType?:      MemoryType     — defaults to 'automatic'
 *   confidenceScore?: number         — 0.0–1.0
 * }
 *
 * Returns: the created UserMemoryEntry (without embedding vector).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveUserMemory, MEMORY_SOURCES, type MemorySource } from "@/lib/user-memory";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      category?: string;
      type?: string;
      title?: string;
      content?: string;
      source?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
      memoryType?: string;
      confidenceScore?: number;
    };

    const { category, type, title, content = "", source: rawSource, metadata, tags, memoryType, confidenceScore } = body;

    if (!category || !type || !title) {
      return NextResponse.json({ error: "category, type, and title are required" }, { status: 400 });
    }

    const source: MemorySource = MEMORY_SOURCES.includes(rawSource as MemorySource)
      ? (rawSource as MemorySource)
      : "manual";

    const entry = await saveUserMemory({
      userId,
      category,
      type,
      title,
      content,
      source,
      metadata,
      tags: Array.isArray(tags) ? tags : [],
      memoryType: (memoryType === "pinned" || memoryType === "favourite" || memoryType === "archived")
        ? memoryType
        : "automatic",
      confidenceScore: typeof confidenceScore === "number" ? Math.min(1, Math.max(0, confidenceScore)) : 1.0,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[user-memory/save]", err);
    return NextResponse.json({ error: "Failed to save memory" }, { status: 500 });
  }
}
