import type { z } from "zod";
import type { JarvisToolName } from "@/db/schema/jarvis-schema";

/**
 * Context passed into every Jarvis tool. userId always comes from the
 * server-side Clerk session (never from client input) and every tool must
 * use it to scope its DB queries.
 */
export type ToolContext = {
  userId: string;
  runId: string;
};

export type ToolSuccess<T> = { success: true; data: T };
export type ToolFailure = { success: false; error: string };
export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export function ok<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function fail(error: string): ToolResult<never> {
  return { success: false, error };
}

/**
 * A single internal Jarvis tool. Every tool:
 *  - declares a strict zod input schema (validated before execute() runs)
 *  - verifies the authenticated user owns any requested data
 *  - returns a structured ToolResult (explicit success/failure — never throws
 *    to signal a business-logic failure; only unexpected errors should throw,
 *    and even those are caught + logged by the runToolLogged() wrapper)
 */
export interface JarvisTool<TInput = unknown, TOutput = unknown> {
  name: JarvisToolName;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (ctx: ToolContext, input: TInput) => Promise<ToolResult<TOutput>>;
}
