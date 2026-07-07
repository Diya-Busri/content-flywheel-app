export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/user-memory/search
 *
 * Semantic search over the authenticated user's personal memory.
 *
 * Body: {
 *   query:           string   — natural language search query
 *   limit?:          number   — max results (default 8)
 *   minRelevance?:   number   — 0.0–1.0 (default 0.25)
 *   category?:       string   — filter to one category
 *   excludeArchived?: boolean — default true
 * }
 *
 * Returns: MemorySearchResult[] sorted by relevance desc.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchUserMemory } from "@/lib/user-memory";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      query?: string;
      limit?: number;
      minRelevance?: number;
      category?: string;
      excludeArchived?: boolean;
    };

    const { query, limit = 8, minRelevance = 0.25, category, excludeArchived = true } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchUserMemory(userId, query.trim(), {
      limit: Math.min(Number(limit) || 8, 30),
      minRelevance: Math.min(Math.max(Number(minRelevance) || 0.25, 0), 1),
      category: category || undefined,
      excludeArchived,
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[user-memory/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
