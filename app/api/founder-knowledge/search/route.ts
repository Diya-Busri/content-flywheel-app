export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/founder-knowledge/search
 *
 * Universal knowledge search — every AI feature calls this before generating.
 *
 * Body: {
 *   query: string           — the search query (user message, topic, etc.)
 *   categories?: string[]  — optional filter to specific Founder OS sections
 *   limit?: number         — max results (default 8)
 *   minRelevance?: number  — minimum score threshold (default 0.25)
 * }
 *
 * Returns: [{ entry, relevance, matchedBy }]
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { searchFounderKnowledge } from "@/lib/founder-knowledge";

async function assertAdmin(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await currentUser();
  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
  if (userEmail !== adminEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return { userId };
}

export async function POST(request: NextRequest) {
  const adminResult = await assertAdmin();
  if (adminResult instanceof NextResponse) return adminResult;
  const { userId } = adminResult;

  try {
    const body = await request.json() as {
      query?: string;
      categories?: string[];
      limit?: number;
      minRelevance?: number;
    };

    const { query, categories, limit = 8, minRelevance = 0.25 } = body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const results = await searchFounderKnowledge(userId, query.trim(), {
      categories,
      limit: Math.min(limit, 20),
      minRelevance,
    });

    return NextResponse.json(results);
  } catch (err) {
    console.error("[founder-knowledge/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
