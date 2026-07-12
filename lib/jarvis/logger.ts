import { db } from "@/db/db";
import { executionStepsTable } from "@/db/schema/jarvis-schema";
import { eq } from "drizzle-orm";
import type { JarvisTool, ToolContext, ToolResult } from "./types";

/**
 * Runs a Jarvis tool with full step logging:
 *  1. Validates raw input against the tool's zod schema.
 *  2. Inserts an execution_steps row (status "running") before calling the tool.
 *  3. Calls the tool, catching any unexpected throw.
 *  4. Updates the step row to "completed" or "failed" with output/error.
 *
 * A tool is NEVER reported as completed unless it actually returned
 * { success: true }. Thrown errors and invalid input both produce a
 * "failed" step with a specific error message — never a silent success.
 */
export async function runToolLogged<TInput, TOutput>(
  tool: JarvisTool<TInput, TOutput>,
  ctx: ToolContext,
  rawInput: unknown,
): Promise<ToolResult<TOutput>> {
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const message = `Invalid input for ${tool.name}: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
    await db.insert(executionStepsTable).values({
      runId: ctx.runId,
      toolName: tool.name,
      status: "failed",
      input: isPlainRecord(rawInput) ? rawInput : { raw: String(rawInput) },
      error: message,
      startedAt: new Date(),
      completedAt: new Date(),
    });
    console.error(`[jarvis:${tool.name}] validation failed for run ${ctx.runId}: ${message}`);
    return { success: false, error: message };
  }

  const [step] = await db
    .insert(executionStepsTable)
    .values({
      runId: ctx.runId,
      toolName: tool.name,
      status: "running",
      input: parsed.data as unknown as Record<string, unknown>,
      startedAt: new Date(),
    })
    .returning();

  console.log(`[jarvis:${tool.name}] started (run=${ctx.runId} user=${ctx.userId})`);

  try {
    const result = await tool.execute(ctx, parsed.data);

    if (result.success) {
      await db
        .update(executionStepsTable)
        .set({
          status: "completed",
          output: isPlainRecord(result.data) ? result.data : { value: result.data },
          completedAt: new Date(),
        })
        .where(eq(executionStepsTable.id, step!.id));
      console.log(`[jarvis:${tool.name}] completed (run=${ctx.runId})`);
    } else {
      await db
        .update(executionStepsTable)
        .set({ status: "failed", error: result.error, completedAt: new Date() })
        .where(eq(executionStepsTable.id, step!.id));
      console.error(`[jarvis:${tool.name}] failed (run=${ctx.runId}): ${result.error}`);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(executionStepsTable)
      .set({ status: "failed", error: message, completedAt: new Date() })
      .where(eq(executionStepsTable.id, step!.id));
    console.error(`[jarvis:${tool.name}] threw (run=${ctx.runId}):`, err);
    return { success: false, error: message };
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
