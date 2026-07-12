import { z } from "zod";
import { searchUserMemory } from "@/lib/user-memory";
import type { JarvisTool, ToolContext } from "../types";
import { ok, fail } from "../types";
import { memorySummarySchema, type MemorySummary } from "./schemas";

const inputSchema = z
  .object({
    query: z.string().min(1).max(500),
  })
  .strict();
type Input = z.infer<typeof inputSchema>;

type Output = { count: number; memories: MemorySummary[] };

/**
 * Searches the authenticated user's Personal AI Memory (lib/user-memory.ts).
 * searchUserMemory() itself scopes every query by userId — this tool just
 * passes ctx.userId through and never accepts a userId from the caller.
 */
async function execute(ctx: ToolContext, input: Input) {
  try {
    const results = await searchUserMemory(ctx.userId, input.query, { limit: 8 });

    const memories: MemorySummary[] = results.map((r) => {
      const summary = {
        id: r.id,
        category: r.category,
        title: r.title,
        summary: r.aiSummary ?? r.content.slice(0, 240).replace(/\n/g, " "),
      };
      const parsed = memorySummarySchema.safeParse(summary);
      if (!parsed.success) throw new Error(`Invalid memory summary for ${r.id}: ${parsed.error.message}`);
      return parsed.data;
    });

    return ok<Output>({ count: memories.length, memories });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to read brand memory");
  }
}

export const getBrandMemoryTool: JarvisTool<Input, Output> = {
  name: "get_brand_memory",
  description: "Semantic search over the user's Personal AI Memory relevant to the current goal.",
  inputSchema,
  execute,
};
