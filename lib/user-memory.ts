/**
 * Personal AI Memory Engine — per-user knowledge base
 *
 * Every AI feature reads from this before generating, and writes back
 * important outputs after generating. Unlike Founder OS (admin-only),
 * every authenticated user has their own isolated memory.
 *
 * Architecture:
 *   user_memory table (Postgres + pgvector)
 *   embedding: text-embedding-3-small (1536-dim)
 *   summary:   gpt-4o-mini (80 tokens, non-blocking)
 */

import OpenAI from "openai";
import { client, db } from "@/db/db";
import { userMemoryTable } from "@/db/schema/user-memory-schema";
import { eq, and, sql, desc } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const SUMMARY_MODEL   = "gpt-4o-mini";
const EMBED_DIM       = 1536;

export const MEMORY_CATEGORIES = {
  research:    { label: "Research",    icon: "🔬", description: "Reports, market insights, competitor analysis" },
  products:    { label: "Products",    icon: "📦", description: "Product ideas, launches, positioning" },
  content:     { label: "Content",     icon: "✍️",  description: "Hooks, captions, copywriting frameworks" },
  design:      { label: "Design",      icon: "🎨", description: "Winning designs, colour palettes, layouts" },
  analytics:   { label: "Analytics",   icon: "📊", description: "Performance data, learnings, patterns" },
  experiments: { label: "Experiments", icon: "🧪", description: "Hypotheses, results, validated learnings" },
  brand:       { label: "Brand",       icon: "🏷️",  description: "Brand voice, personas, tone of voice" },
  goals:       { label: "Goals",       icon: "🎯", description: "Business goals, targets, milestones" },
  notes:       { label: "Notes",       icon: "📝", description: "General notes and ideas" },
  coaching:    { label: "Coaching",    icon: "🧠", description: "AI Coach conversations and advice" },
} as const;

export type MemoryCategory = keyof typeof MEMORY_CATEGORIES;

export const MEMORY_TYPES = ["automatic", "pinned", "favourite", "archived"] as const;
export type MemoryType = typeof MEMORY_TYPES[number];

export const MEMORY_SOURCES = [
  "coach", "research", "analytics", "design", "product",
  "experiment", "marketplace", "notes", "manual",
] as const;
export type MemorySource = typeof MEMORY_SOURCES[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserMemoryEntry {
  id: string;
  userId: string;
  category: string;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  aiSummary?: string | null;
  tags?: string[];
  memoryType: MemoryType;
  source: string;
  confidenceScore: number;
  usageCount: number;
  lastUsedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Relevance score 0–1, present only on search results */
  relevance?: number;
}

export interface SaveMemoryOptions {
  userId: string;
  category: string;
  type: string;
  title: string;
  content: string;
  source?: MemorySource;
  metadata?: Record<string, unknown>;
  tags?: string[];
  memoryType?: MemoryType;
  confidenceScore?: number;
}

export interface MemorySearchOptions {
  limit?: number;
  minRelevance?: number;
  category?: string;
  excludeArchived?: boolean;
}

export interface MemorySearchResult extends UserMemoryEntry {
  relevance: number;
  matchedBy: "vector" | "text";
}

// ─── Embedding generation ─────────────────────────────────────────────────────

export async function generateMemoryEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
      dimensions: EMBED_DIM,
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.warn("[user-memory] embedding failed:", err);
    return null;
  }
}

export async function generateMemorySummary(title: string, content: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !content.trim()) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content: "Write ONE sentence (max 80 words) summarising this entry's key insight. Be specific and concrete. No filler.",
        },
        {
          role: "user",
          content: `Title: ${title}\n\n${content.slice(0, 1500)}`,
        },
      ],
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("[user-memory] summary failed:", err);
    return null;
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Persist a memory entry and enrich it with embedding + AI summary async.
 * Returns immediately after the DB insert — enrichment is fire-and-forget.
 */
export async function saveUserMemory(opts: SaveMemoryOptions): Promise<UserMemoryEntry> {
  const {
    userId, category, type, title, content,
    source = "manual", metadata, tags = [],
    memoryType = "automatic", confidenceScore = 1.0,
  } = opts;

  const [entry] = await db
    .insert(userMemoryTable)
    .values({
      userId, category, type, title, content,
      source, metadata: metadata ?? null,
      memoryType, confidenceScore,
    })
    .returning();

  // Store tags via raw SQL (Drizzle text[] insert requires casting)
  if (tags.length > 0) {
    void client.unsafe(
      `UPDATE user_memory SET tags = $1::text[] WHERE id = $2`,
      [tags, entry.id]
    ).catch(() => {});
  }

  // Enrich async
  void enrichUserMemoryEntry(entry.id, title, content).catch(() => {});

  return { ...(entry as unknown as UserMemoryEntry), tags };
}

/**
 * Generate embedding + AI summary for an existing entry and persist both.
 * Safe to call multiple times — idempotent update.
 */
export async function enrichUserMemoryEntry(
  entryId: string,
  title: string,
  content: string
): Promise<void> {
  const [embedding, aiSummary] = await Promise.all([
    generateMemoryEmbedding(`${title}\n\n${content}`),
    generateMemorySummary(title, content),
  ]);

  if (!embedding && !aiSummary) return;

  try {
    if (embedding) {
      const embeddingLiteral = `[${embedding.join(",")}]`;
      await client.unsafe(
        `UPDATE user_memory
         SET embedding = $1::vector,
             ai_summary = COALESCE($2, ai_summary),
             updated_at = NOW()
         WHERE id = $3`,
        [embeddingLiteral, aiSummary ?? null, entryId]
      );
    } else if (aiSummary) {
      await client.unsafe(
        `UPDATE user_memory SET ai_summary = $1, updated_at = NOW() WHERE id = $2`,
        [aiSummary, entryId]
      );
    }
  } catch (err) {
    console.warn("[user-memory] enrich failed:", err);
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Semantic search over a user's personal memory.
 *
 * Strategy:
 *   1. Embed the query with text-embedding-3-small
 *   2. Cosine distance search (pgvector) for embedded entries
 *   3. ILIKE fallback for un-embedded entries
 *   4. Merge, deduplicate, sort by relevance, cap at limit
 *   5. Increment usage_count fire-and-forget
 */
export async function searchUserMemory(
  userId: string,
  query: string,
  options: MemorySearchOptions = {}
): Promise<MemorySearchResult[]> {
  const { limit = 8, minRelevance = 0.25, category, excludeArchived = true } = options;

  const embedding = await generateMemoryEmbedding(query);

  // ── Vector search ────────────────────────────────────────────────────────
  let vectorResults: MemorySearchResult[] = [];

  if (embedding) {
    try {
      const embeddingLiteral = `[${embedding.join(",")}]`;

      const catCondition = category ? `AND category = '${category}'` : "";
      const archiveCondition = excludeArchived ? `AND memory_type != 'archived'` : "";

      const rows = await client.unsafe(
        `SELECT id, user_id, category, type, title, content, metadata,
                ai_summary, tags, memory_type, source, confidence_score,
                usage_count, last_used_at, created_at, updated_at,
                1 - (embedding <=> $1::vector) AS similarity
         FROM user_memory
         WHERE user_id = $2
           AND embedding IS NOT NULL
           ${catCondition}
           ${archiveCondition}
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [embeddingLiteral, userId, limit * 2]
      );

      vectorResults = (rows as Record<string, unknown>[])
        .map(row => ({
          ...rowToMemory(row),
          relevance: Number(row.similarity ?? 0),
          matchedBy: "vector" as const,
        }))
        .filter(r => r.relevance >= minRelevance);
    } catch (err) {
      console.warn("[user-memory] vector search failed:", err);
    }
  }

  // ── Text fallback ────────────────────────────────────────────────────────
  const vectorIds = new Set(vectorResults.map(r => r.id));
  let textResults: MemorySearchResult[] = [];

  try {
    const q = `%${query.toLowerCase()}%`;

    const conditions = [
      eq(userMemoryTable.userId, userId),
      sql`embedding IS NULL`,
      sql`(LOWER(title) LIKE ${q} OR LOWER(content) LIKE ${q} OR LOWER(ai_summary) LIKE ${q})`,
      ...(category ? [eq(userMemoryTable.category, category)] : []),
      ...(excludeArchived ? [sql`memory_type != 'archived'`] : []),
    ];

    const textRows = await db
      .select()
      .from(userMemoryTable)
      .where(and(...conditions))
      .orderBy(desc(userMemoryTable.usageCount), desc(userMemoryTable.updatedAt))
      .limit(limit);

    textResults = textRows
      .filter(r => !vectorIds.has(r.id))
      .map(r => ({
        ...(r as unknown as UserMemoryEntry),
        tags: [],
        relevance: 0.3,
        matchedBy: "text" as const,
      }));
  } catch (err) {
    console.warn("[user-memory] text search failed:", err);
  }

  // ── Merge + sort ─────────────────────────────────────────────────────────
  const merged = [...vectorResults, ...textResults]
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  // ── Increment usage (fire-and-forget) ────────────────────────────────────
  if (merged.length > 0) {
    const ids = merged.map(r => r.id);
    void client.unsafe(
      `UPDATE user_memory
       SET usage_count = usage_count + 1, last_used_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids]
    ).catch(() => {});
  }

  return merged;
}

// ─── Context for AI injection ─────────────────────────────────────────────────

/**
 * Build a formatted context block from the most relevant user memories.
 * Inject this into the system prompt of any AI feature.
 */
export async function getUserMemoryContext(
  userId: string,
  query: string,
  limit = 5
): Promise<string> {
  const results = await searchUserMemory(userId, query, { limit, minRelevance: 0.3 });
  if (results.length === 0) return "";

  const lines = results.map((r, i) => {
    const cat = (MEMORY_CATEGORIES as Record<string, { label: string }>)[r.category]?.label ?? r.category;
    const parts: string[] = [`${i + 1}. [${cat.toUpperCase()}] ${r.title}`];
    const summary = r.aiSummary ?? (r.content ? r.content.slice(0, 200).replace(/\n/g, " ") : null);
    if (summary) parts.push(`   → ${summary}`);
    const tagsArr = r.tags ?? [];
    if (tagsArr.length > 0) parts.push(`   Tags: ${tagsArr.join(", ")}`);
    return parts.join("\n");
  });

  return [
    "━━━ YOUR BUSINESS BRAIN ━━━",
    "The following is relevant context from your Business Brain — everything Content Flywheel has learned about your business.",
    "Use this to personalise your response — reference past work, avoid repeating advice, build on prior context.",
    "",
    ...lines,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ].join("\n");
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function rowToMemory(row: Record<string, unknown>): UserMemoryEntry {
  return {
    id:              String(row.id ?? ""),
    userId:          String(row.user_id ?? ""),
    category:        String(row.category ?? ""),
    type:            String(row.type ?? ""),
    title:           String(row.title ?? ""),
    content:         String(row.content ?? ""),
    metadata:        (row.metadata as Record<string, unknown>) ?? null,
    aiSummary:       row.ai_summary != null ? String(row.ai_summary) : null,
    tags:            Array.isArray(row.tags) ? (row.tags as string[]) : [],
    memoryType:      (row.memory_type as MemoryType) ?? "automatic",
    source:          String(row.source ?? "manual"),
    confidenceScore: typeof row.confidence_score === "number" ? row.confidence_score : 1.0,
    usageCount:      typeof row.usage_count === "number" ? row.usage_count : 0,
    lastUsedAt:      row.last_used_at as string | null,
    createdAt:       String(row.created_at ?? ""),
    updatedAt:       String(row.updated_at ?? ""),
  };
}
