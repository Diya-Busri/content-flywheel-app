/**
 * Agent Framework — Phase 4
 *
 * Base types, interfaces, rate-limiting helpers, and DB persistence
 * for all Content Flywheel AI agents.
 */

import { db } from "@/db/db";
import { agentDiscoveriesTable } from "@/db/schema/agent-discoveries-schema";
import { agentTasksTable } from "@/db/schema/agent-tasks-schema";
import { agentRunsTable } from "@/db/schema/agent-runs-schema";
import { agentPreferencesTable } from "@/db/schema/agent-preferences-schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

// ─── Agent Types ──────────────────────────────────────────────────────────────

export type AgentType =
  | "research"
  | "product"
  | "content"
  | "analytics"
  | "experiment"
  | "coach";

export const AGENT_DEFINITIONS: Record<AgentType, {
  name: string;
  goal: string;
  description: string;
  emoji: string;
  rateLimitHours: number;
}> = {
  research: {
    name: "Research Agent",
    goal: "Monitor trends, detect opportunities, find product ideas",
    description: "Continuously scans your research history for new opportunities, niche shifts, and untapped topics.",
    emoji: "🔬",
    rateLimitHours: 12,
  },
  product: {
    name: "Product Agent",
    goal: "Identify product gaps, suggest bundles, recommend pricing",
    description: "Analyses your product catalogue and market research to find gaps, bundle opportunities, and pricing improvements.",
    emoji: "📦",
    rateLimitHours: 24,
  },
  content: {
    name: "Content Agent",
    goal: "Build content plans, identify trends, recommend hooks and CTAs",
    description: "Proactively builds your content calendar, identifies trending formats, and recommends high-performing hooks.",
    emoji: "✍️",
    rateLimitHours: 12,
  },
  analytics: {
    name: "Analytics Agent",
    goal: "Surface performance patterns, auto-generate insights",
    description: "Continuously analyses your views, CTR, revenue, and conversion data to surface what's working and what isn't.",
    emoji: "📊",
    rateLimitHours: 24,
  },
  experiment: {
    name: "Experiment Agent",
    goal: "Generate and track A/B experiments, recommend winners",
    description: "Automatically designs experiments to test hooks, pricing, thumbnails, and CTAs — then tracks and calls winners.",
    emoji: "⚗️",
    rateLimitHours: 24,
  },
  coach: {
    name: "Business Coach Agent",
    goal: "Monitor all activity and proactively identify risks and opportunities",
    description: "Your always-on business coach — monitors publishing cadence, product completion, and strategic patterns to keep you on track.",
    emoji: "🧠",
    rateLimitHours: 6,
  },
};

// ─── Payload Types ────────────────────────────────────────────────────────────

export interface AgentDiscoveryPayload {
  discoveryType: "opportunity" | "warning" | "insight" | "recommendation";
  title: string;
  description: string;
  confidence: number;   // 0–1
  priority: number;     // 1–10
  actionType?: "url" | "tab" | "feature";
  actionLabel?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTaskPayload {
  title: string;
  description: string;
  priority: number;     // 1–10
  dueDate?: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentRunResult {
  agentType: AgentType;
  discoveries: AgentDiscoveryPayload[];
  tasks: AgentTaskPayload[];
  confidenceScore: number;
  reasoningLog: string[];
  skipped?: boolean;
  skipReason?: string;
}

export interface AgentContext {
  userId: string;
  isAdmin: boolean;
  forceRun?: boolean; // bypass rate limits (daily review)
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

/**
 * Returns hours since the last run of this agent for the user.
 * Returns null if no runs found (never run).
 */
export async function hoursSinceLastRun(
  userId: string,
  agentType: AgentType,
): Promise<number | null> {
  try {
    const rows = await db
      .select({ completedAt: agentRunsTable.completedAt })
      .from(agentRunsTable)
      .where(
        and(
          eq(agentRunsTable.userId, userId),
          eq(agentRunsTable.agentType, agentType),
          eq(agentRunsTable.status, "completed"),
        ),
      )
      .orderBy(desc(agentRunsTable.completedAt))
      .limit(1);

    if (!rows[0]?.completedAt) return null;
    const diffMs = Date.now() - new Date(rows[0].completedAt).getTime();
    return diffMs / 3_600_000;
  } catch {
    return null;
  }
}

// ─── DB Persistence ───────────────────────────────────────────────────────────

export async function saveAgentDiscoveries(
  userId: string,
  agentType: AgentType,
  discoveries: AgentDiscoveryPayload[],
): Promise<void> {
  const safe = Array.isArray(discoveries) ? discoveries : [];
  if (safe.length === 0) return;

  // Deduplicate: don't re-insert if the same title was saved in the last 7 days
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  const existing = await db
    .select({ title: agentDiscoveriesTable.title })
    .from(agentDiscoveriesTable)
    .where(
      and(
        eq(agentDiscoveriesTable.userId, userId),
        eq(agentDiscoveriesTable.agentType, agentType),
        gte(agentDiscoveriesTable.createdAt, cutoff),
      ),
    );
  const existingTitles = new Set(existing.map(r => r.title.toLowerCase()));

  const toInsert = safe.filter(
    d => !existingTitles.has(d.title.toLowerCase()),
  );
  if (toInsert.length === 0) return;

  await db.insert(agentDiscoveriesTable).values(
    toInsert.map(d => ({
      userId,
      agentType,
      discoveryType: d.discoveryType,
      title: d.title,
      description: d.description ?? null,
      confidence: Math.min(1, Math.max(0, d.confidence)),
      priority: Math.min(10, Math.max(1, d.priority)),
      actionType: d.actionType ?? null,
      actionLabel: d.actionLabel ?? null,
      actionUrl: d.actionUrl ?? null,
      metadata: (d.metadata ?? {}) as Record<string, unknown>,
    })),
  );
}

export async function saveAgentTasks(
  userId: string,
  agentType: AgentType,
  tasks: AgentTaskPayload[],
): Promise<void> {
  const safe = Array.isArray(tasks) ? tasks : [];
  if (safe.length === 0) return;

  // Don't create duplicate pending tasks with the same title
  const existing = await db
    .select({ title: agentTasksTable.title })
    .from(agentTasksTable)
    .where(
      and(
        eq(agentTasksTable.userId, userId),
        eq(agentTasksTable.status, "pending"),
      ),
    );
  const existingTitles = new Set(existing.map(r => r.title.toLowerCase()));

  const toInsert = safe.filter(
    t => !existingTitles.has(t.title.toLowerCase()),
  );
  if (toInsert.length === 0) return;

  await db.insert(agentTasksTable).values(
    toInsert.map(t => ({
      userId,
      agentType,
      title: t.title,
      description: t.description ?? null,
      priority: Math.min(10, Math.max(1, t.priority)),
      dueDate: t.dueDate ?? null,
      metadata: (t.metadata ?? {}) as Record<string, unknown>,
    })),
  );
}

export async function startAgentRun(
  userId: string,
  agentType: AgentType,
): Promise<string> {
  const rows = await db
    .insert(agentRunsTable)
    .values({ userId, agentType, status: "running" })
    .returning({ id: agentRunsTable.id });
  return rows[0]!.id;
}

export async function completeAgentRun(
  runId: string,
  result: Pick<AgentRunResult, "discoveries" | "tasks" | "reasoningLog">,
): Promise<void> {
  await db
    .update(agentRunsTable)
    .set({
      status: "completed",
      discoveriesCount: (result.discoveries ?? []).length,
      tasksCount: (result.tasks ?? []).length,
      reasoningLog: result.reasoningLog as unknown as Record<string, unknown>[],
      completedAt: new Date(),
    })
    .where(eq(agentRunsTable.id, runId));
}

export async function failAgentRun(runId: string, error: string): Promise<void> {
  await db
    .update(agentRunsTable)
    .set({
      status: "failed",
      reasoningLog: [error] as unknown as Record<string, unknown>[],
      completedAt: new Date(),
    })
    .where(eq(agentRunsTable.id, runId));
}

// ─── Preferences ──────────────────────────────────────────────────────────────

export async function getAgentPreferences(
  userId: string,
): Promise<Record<AgentType, boolean>> {
  const rows = await db
    .select()
    .from(agentPreferencesTable)
    .where(eq(agentPreferencesTable.userId, userId));

  const prefs: Record<string, boolean> = {};
  for (const row of rows) {
    prefs[row.agentType] = row.isEnabled;
  }

  // Default: all agents enabled
  const defaults: Record<AgentType, boolean> = {
    research: true, product: true, content: true,
    analytics: true, experiment: true, coach: true,
  };
  return { ...defaults, ...prefs };
}

export async function upsertAgentPreference(
  userId: string,
  agentType: AgentType,
  isEnabled: boolean,
): Promise<void> {
  await db
    .insert(agentPreferencesTable)
    .values({ userId, agentType, isEnabled })
    .onConflictDoUpdate({
      target: [agentPreferencesTable.userId, agentPreferencesTable.agentType],
      set: { isEnabled },
    });
}

// ─── Recent Discoveries Helper ─────────────────────────────────────────────────

export async function getRecentDiscoveries(
  userId: string,
  agentType?: AgentType,
  hoursBack = 48,
): Promise<typeof agentDiscoveriesTable.$inferSelect[]> {
  const cutoff = new Date(Date.now() - hoursBack * 3_600_000);
  const conditions = [
    eq(agentDiscoveriesTable.userId, userId),
    gte(agentDiscoveriesTable.createdAt, cutoff),
  ];
  if (agentType) conditions.push(eq(agentDiscoveriesTable.agentType, agentType));

  return db
    .select()
    .from(agentDiscoveriesTable)
    .where(and(...conditions))
    .orderBy(desc(agentDiscoveriesTable.createdAt))
    .limit(20);
}
