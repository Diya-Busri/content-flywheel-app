export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/user-memory/save
 *
 * Save knowledge to personal AI memory (Business Brain).
 *
 * Intelligence features:
 * - Duplicate detection: if new content is ≥92% similar to an existing memory,
 *   the existing entry is merged and updated instead of creating a duplicate.
 * - Intelligence pipeline: score update + pattern detection + recommendations
 *   run in the background after every save.
 *
 * Body: { category, type, title, content, source?, metadata?, tags?, memoryType?, confidenceScore? }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { saveUserMemory, generateMemoryEmbedding, MEMORY_SOURCES, type MemorySource } from "@/lib/user-memory";
import { checkForDuplicate, mergeIntoExisting, linkRelatedMemories, runIntelligencePipeline, recordTimelineEvent } from "@/lib/intelligence-engine";
import { db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { eq } from "drizzle-orm";

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

    const validatedConfidence = typeof confidenceScore === "number"
      ? Math.min(1, Math.max(0, confidenceScore))
      : 1.0;

    // ── Duplicate Detection ────────────────────────────────────────────────
    // Generate embedding first so we can check for duplicates synchronously
    const embedding = await generateMemoryEmbedding(`${title}\n\n${content}`);
    let duplicateId: string | null = null;

    if (embedding) {
      duplicateId = await checkForDuplicate(userId, embedding);
    }

    if (duplicateId) {
      // Merge into existing instead of creating a duplicate
      await mergeIntoExisting(duplicateId, title, content, validatedConfidence);

      await recordTimelineEvent(userId, {
        eventType: "memory_merged",
        title: `Knowledge merged: ${title.slice(0, 80)}`,
        description: "Similar knowledge already existed — merged to strengthen existing memory",
        memoryId: duplicateId,
      });

      // Still run pipeline (fire-and-forget)
      void runIntelligencePipeline(userId).catch(() => {});

      const [merged] = await db
        .select()
        .from(userMemoryTable)
        .where(eq(userMemoryTable.id, duplicateId))
        .limit(1);

      return NextResponse.json({ ...merged, _merged: true }, { status: 200 });
    }

    // ── Save new entry ─────────────────────────────────────────────────────
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
      confidenceScore: validatedConfidence,
    });

    // Log timeline event
    void recordTimelineEvent(userId, {
      eventType: "memory_saved",
      title: `Learned: ${title.slice(0, 80)}`,
      description: `New ${category} knowledge saved from ${source}`,
      memoryId: entry.id as string,
    }).catch(() => {});

    // Link related memories + run full pipeline (fire-and-forget)
    if (embedding && entry.id) {
      void linkRelatedMemories(userId, entry.id as string, embedding).catch(() => {});
    }
    void runIntelligencePipeline(userId).catch(() => {});

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[user-memory/save]", err);
    return NextResponse.json({ error: "Failed to save memory" }, { status: 500 });
  }
}
