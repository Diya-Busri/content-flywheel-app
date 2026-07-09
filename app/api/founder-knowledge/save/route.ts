export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/founder-knowledge/save
 *
 * Save an insight to Founder OS from any AI feature.
 * Auto-generates embedding + AI summary for the new entry.
 *
 * Body: {
 *   category:          string   — which Founder OS section to save to
 *   type:              string   — entry sub-type
 *   title:             string   — insight title / headline
 *   content:           string   — full content
 *   source:            string   — 'coach' | 'research' | 'analytics' | 'experiment' | 'manual'
 *   metadata?:         object   — category-specific fields
 *   tags?:             string[] — searchable labels
 *   confidenceScore?:  number   — 0.0–1.0
 * }
 *
 * Returns: the created FounderKnowledgeEntry (without embedding vector).
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { saveKnowledgeEntry } from "@/lib/founder-knowledge";

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

const VALID_SOURCES = ["manual", "research", "coach", "analytics", "experiment"] as const;
type Source = typeof VALID_SOURCES[number];

export async function POST(request: NextRequest) {
  const adminResult = await assertAdmin();
  if (adminResult instanceof NextResponse) return adminResult;
  const { userId } = adminResult;

  try {
    const body = await request.json() as {
      category?: string;
      type?: string;
      title?: string;
      content?: string;
      source?: string;
      metadata?: Record<string, unknown>;
      tags?: string[];
      confidenceScore?: number;
    };

    const { category, type, title, content = "", source: rawSource, metadata, tags, confidenceScore } = body;

    if (!category || !type || !title) {
      return NextResponse.json({ error: "category, type, and title are required" }, { status: 400 });
    }

    const source: Source = VALID_SOURCES.includes(rawSource as Source) ? (rawSource as Source) : "manual";

    const entry = await saveKnowledgeEntry({
      userId,
      category,
      type,
      title,
      content,
      source,
      metadata,
      tags: Array.isArray(tags) ? tags : [],
      confidenceScore: typeof confidenceScore === "number" ? Math.min(1, Math.max(0, confidenceScore)) : 1.0,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("[founder-knowledge/save]", err);
    return NextResponse.json({ error: "Failed to save knowledge entry" }, { status: 500 });
  }
}
