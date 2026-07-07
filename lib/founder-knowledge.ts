/**
 * Founder Knowledge Engine — shared utilities
 *
 * Every AI-powered feature that reads from or writes to Founder OS goes
 * through these helpers. This keeps embedding generation, search logic,
 * and admin assertions DRY across the codebase.
 */

import OpenAI from "openai";
import { client } from "@/db/db";
import { db } from "@/db/db";
import { founderWorkspaceEntriesTable } from "@/db/schema/founder-workspace-schema";
import type { FounderKnowledgeEntry } from "@/db/schema/founder-workspace-schema";
import { eq, and } from "drizzle-orm";

// ─── Constants ───────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536-dim, fast, cheap
const SUMMARY_MODEL   = "gpt-4o-mini";
const EMBED_DIM       = 1536;

// ─── Embedding generation ─────────────────────────────────────────────────────

/**
 * Generate an OpenAI embedding for the given text.
 * Returns a Float32Array of length 1536, or null on failure.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // safety limit
      dimensions: EMBED_DIM,
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[founder-knowledge] embedding failed:", err);
    return null;
  }
}

/**
 * Generate a 1–2 sentence AI summary of the given knowledge entry.
 * Returns null on failure — non-blocking.
 */
export async function generateAISummary(title: string, content: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!content.trim()) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: "You are a knowledge librarian. Write a 1–2 sentence summary of the given knowledge entry that captures the core insight. Be specific, not generic. No filler words.",
        },
        {
          role: "user",
          content: `Title: ${title}\n\nContent: ${content.slice(0, 2000)}`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("[founder-knowledge] summary failed:", err);
    return null;
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface KnowledgeSearchOptions {
  /** Limit to specific categories (undefined = all) */
  categories?: string[];
  /** Max results to return (default: 8) */
  limit?: number;
  /** Minimum relevance score 0–1 (default: 0.25) */
  minRelevance?: number;
}

export interface KnowledgeSearchResult {
  entry: FounderKnowledgeEntry;
  /** Cosine similarity 0–1, or text-match score */
  relevance: number;
  /** How this result was found */
  matchedBy: "vector" | "text";
}

/**
 * Search Founder OS entries for a given query.
 *
 * Strategy:
 * 1. Generate embedding for the query.
 * 2. Cosine similarity search against entries that have embeddings (pgvector).
 * 3. Text ILIKE fallback for entries without embeddings.
 * 4. Merge + deduplicate; vector results ranked higher.
 * 5. Increment usage_count for all returned entries (fire-and-forget).
 */
export async function searchFounderKnowledge(
  userId: string,
  query: string,
  options: KnowledgeSearchOptions = {}
): Promise<KnowledgeSearchResult[]> {
  const { categories, limit = 8, minRelevance = 0.25 } = options;

  const catClause = categories && categories.length > 0
    ? `AND category = ANY(ARRAY[${categories.map((_, i) => `$${i + 3}`).join(",")}]::text[])`
    : "";

  // ── Vector search ────────────────────────────────────────────────────────
  let vectorResults: KnowledgeSearchResult[] = [];

  const embedding = await generateEmbedding(query);
  if (embedding) {
    try {
      const embeddingLiteral = `[${embedding.join(",")}]`;
      // Build the query with optional category filter
      let vectorSql: string;
      let vectorParams: unknown[];

      if (categories && categories.length > 0) {
        vectorSql = `
          SELECT id, user_id, category, type, title, content, metadata,
                 ai_summary, usage_count, source, confidence_score, last_used_at,
                 created_at, updated_at, tags, related_entry_ids,
                 1 - (embedding <=> $1::vector) AS similarity
          FROM founder_workspace_entries
          WHERE user_id = $2
            AND embedding IS NOT NULL
            AND category = ANY($3::text[])
          ORDER BY embedding <=> $1::vector
          LIMIT $4
        `;
        vectorParams = [embeddingLiteral, userId, categories, limit];
      } else {
        vectorSql = `
          SELECT id, user_id, category, type, title, content, metadata,
                 ai_summary, usage_count, source, confidence_score, last_used_at,
                 created_at, updated_at, tags, related_entry_ids,
                 1 - (embedding <=> $1::vector) AS similarity
          FROM founder_workspace_entries
          WHERE user_id = $2
            AND embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector
          LIMIT $3
        `;
        vectorParams = [embeddingLiteral, userId, limit];
      }

      const rows = await client.unsafe(vectorSql, vectorParams as string[]);
      vectorResults = (rows as Record<string, unknown>[])
        .map(row => ({
          entry: rowToEntry(row),
          relevance: typeof row.similarity === "number" ? row.similarity : 0,
          matchedBy: "vector" as const,
        }))
        .filter(r => r.relevance >= minRelevance);
    } catch (err) {
      console.warn("[founder-knowledge] vector search failed:", err);
    }
  }

  // ── Text fallback for entries without embeddings ─────────────────────────
  const vectorIds = new Set(vectorResults.map(r => r.entry.id));
  let textResults: KnowledgeSearchResult[] = [];

  try {
    const q = `%${query.toLowerCase()}%`;
    let textSql: string;
    let textParams: unknown[];

    if (categories && categories.length > 0) {
      textSql = `
        SELECT id, user_id, category, type, title, content, metadata,
               ai_summary, usage_count, source, confidence_score, last_used_at,
               created_at, updated_at, tags, related_entry_ids
        FROM founder_workspace_entries
        WHERE user_id = $1
          AND embedding IS NULL
          AND category = ANY($2::text[])
          AND (LOWER(title) LIKE $3 OR LOWER(content) LIKE $3 OR LOWER(ai_summary) LIKE $3)
        ORDER BY usage_count DESC, created_at DESC
        LIMIT $4
      `;
      textParams = [userId, categories, q, limit];
    } else {
      textSql = `
        SELECT id, user_id, category, type, title, content, metadata,
               ai_summary, usage_count, source, confidence_score, last_used_at,
               created_at, updated_at, tags, related_entry_ids
        FROM founder_workspace_entries
        WHERE user_id = $1
          AND embedding IS NULL
          AND (LOWER(title) LIKE $2 OR LOWER(content) LIKE $2 OR LOWER(ai_summary) LIKE $2)
        ORDER BY usage_count DESC, created_at DESC
        LIMIT $3
      `;
      textParams = [userId, q, limit];
    }

    const textRows = await client.unsafe(textSql, textParams as string[]);
    textResults = (textRows as Record<string, unknown>[])
      .filter(row => !vectorIds.has(String(row.id)))
      .map(row => ({
        entry: rowToEntry(row),
        relevance: 0.3, // fixed score for text matches
        matchedBy: "text" as const,
      }));
  } catch (err) {
    console.warn("[founder-knowledge] text search failed:", err);
  }

  // ── Merge, sort, cap ─────────────────────────────────────────────────────
  const merged = [...vectorResults, ...textResults]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  // ── Increment usage_count (fire-and-forget) ──────────────────────────────
  if (merged.length > 0) {
    const ids = merged.map(r => r.entry.id);
    void client.unsafe(
      `UPDATE founder_workspace_entries SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids]
    ).catch(() => {});
  }

  return merged;
}

// ─── Save insight ─────────────────────────────────────────────────────────────

export interface SaveInsightOptions {
  userId: string;
  category: string;
  type: string;
  title: string;
  content: string;
  source: "manual" | "research" | "coach" | "analytics" | "experiment";
  metadata?: Record<string, unknown>;
  tags?: string[];
  confidenceScore?: number;
}

/**
 * Save a new knowledge entry and immediately generate its embedding + AI summary.
 * Designed to be called from Research, AI Coach, Analytics, etc.
 */
export async function saveKnowledgeEntry(opts: SaveInsightOptions): Promise<FounderKnowledgeEntry> {
  const {
    userId, category, type, title, content, source,
    metadata, tags = [], confidenceScore = 1.0,
  } = opts;

  // Create the row in Drizzle (without embedding — added via raw SQL below)
  const [entry] = await db
    .insert(founderWorkspaceEntriesTable)
    .values({
      userId, category, type, title, content,
      metadata: metadata ?? null,
      source,
      confidenceScore,
      aiSummary: null,
    })
    .returning();

  // Generate embedding + summary in parallel (non-blocking on failure)
  const [embedding, aiSummary] = await Promise.all([
    generateEmbedding(`${title} ${content}`),
    generateAISummary(title, content),
  ]);

  // Store embedding + summary + tags via raw SQL
  if (embedding || aiSummary || tags.length > 0) {
    try {
      if (embedding) {
        const embeddingLiteral = `[${embedding.join(",")}]`;
        await client.unsafe(
          `UPDATE founder_workspace_entries
           SET embedding = $1::vector,
               ai_summary = COALESCE($2, ai_summary),
               tags = $3::text[]
           WHERE id = $4`,
          [embeddingLiteral, aiSummary ?? null, tags, entry.id]
        );
      } else if (aiSummary || tags.length > 0) {
        await client.unsafe(
          `UPDATE founder_workspace_entries
           SET ai_summary = COALESCE($1, ai_summary),
               tags = $2::text[]
           WHERE id = $3`,
          [aiSummary ?? null, tags, entry.id]
        );
      }
    } catch (err) {
      console.warn("[founder-knowledge] post-insert enrichment failed:", err);
    }
  }

  return { ...entry, tags, aiSummary: aiSummary ?? undefined, relevance: undefined } as FounderKnowledgeEntry;
}

/**
 * Update the embedding and AI summary for an existing entry.
 * Called by the CRUD API after title/content changes.
 */
export async function enrichExistingEntry(entryId: string, title: string, content: string): Promise<void> {
  const [embedding, aiSummary] = await Promise.all([
    generateEmbedding(`${title} ${content}`),
    generateAISummary(title, content),
  ]);

  if (embedding || aiSummary) {
    try {
      if (embedding) {
        const embeddingLiteral = `[${embedding.join(",")}]`;
        await client.unsafe(
          `UPDATE founder_workspace_entries
           SET embedding = $1::vector,
               ai_summary = COALESCE($2, ai_summary),
               updated_at = NOW()
           WHERE id = $3`,
          [embeddingLiteral, aiSummary ?? null, entryId]
        );
      } else if (aiSummary) {
        await client.unsafe(
          `UPDATE founder_workspace_entries
           SET ai_summary = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [aiSummary, entryId]
        );
      }
    } catch (err) {
      console.warn("[founder-knowledge] enrichment failed:", err);
    }
  }
}

// ─── Admin check helper ───────────────────────────────────────────────────────

/**
 * Returns true if the given Clerk userId belongs to the configured admin email.
 * Import and use this instead of repeating the check in every route.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!adminEmail || !userId) return false;
  try {
    // Dynamic import to avoid bundling Clerk server SDK into non-server modules
    const { clerkClient } = await import("@clerk/nextjs/server");
    const user = await clerkClient().users.getUser(userId);
    const userEmail = user.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ?? "";
    return userEmail === adminEmail;
  } catch {
    return false;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): FounderKnowledgeEntry {
  return {
    id:              String(row.id ?? ""),
    userId:          String(row.user_id ?? ""),
    category:        String(row.category ?? ""),
    type:            String(row.type ?? ""),
    title:           String(row.title ?? ""),
    content:         String(row.content ?? ""),
    metadata:        (row.metadata as Record<string, unknown>) ?? null,
    aiSummary:       row.ai_summary != null ? String(row.ai_summary) : null,
    usageCount:      typeof row.usage_count === "number" ? row.usage_count : 0,
    source:          String(row.source ?? "manual"),
    confidenceScore: typeof row.confidence_score === "number" ? row.confidence_score : 1.0,
    lastUsedAt:      row.last_used_at instanceof Date ? row.last_used_at : null,
    createdAt:       row.created_at instanceof Date ? row.created_at : new Date(),
    updatedAt:       row.updated_at instanceof Date ? row.updated_at : new Date(),
    tags:            Array.isArray(row.tags) ? (row.tags as string[]) : [],
    relatedEntryIds: Array.isArray(row.related_entry_ids) ? (row.related_entry_ids as string[]) : [],
  };
}
