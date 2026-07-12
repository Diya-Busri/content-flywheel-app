import type { JarvisToolName } from "@/db/schema/jarvis-schema";
import type { JarvisTool } from "./types";

/**
 * Central registry of internal Jarvis tools. Each tool file (lib/jarvis/tools/*)
 * calls registerTool() once at module load. lib/jarvis/tools/index.ts imports
 * every tool file for its side effect — orchestrator code must import that
 * index (not individual tool files) so the registry is always fully populated.
 *
 * The registry necessarily erases each tool's concrete TInput/TOutput to
 * `unknown` — dynamic dispatch by tool name can't preserve per-tool types.
 * Type safety at the dispatch boundary is instead enforced at runtime by each
 * tool's own zod inputSchema (checked in lib/jarvis/logger.ts before execute()
 * ever runs). Each tool definition itself is still fully typed where it's
 * declared, via the generic signature of registerTool() below.
 */
type AnyJarvisTool = JarvisTool<unknown, unknown>;

const registry = new Map<JarvisToolName, AnyJarvisTool>();

export function registerTool<TInput, TOutput>(tool: JarvisTool<TInput, TOutput>): void {
  if (registry.has(tool.name)) {
    // Defensive: registering the same tool twice (e.g. hot reload) should not
    // crash the app — just keep the latest definition.
    console.warn(`[jarvis] tool "${tool.name}" registered more than once`);
  }
  registry.set(tool.name, tool as unknown as AnyJarvisTool);
}

export function getTool(name: JarvisToolName): AnyJarvisTool {
  const tool = registry.get(name);
  if (!tool) {
    throw new Error(
      `Jarvis tool "${name}" is not registered. Make sure lib/jarvis/tools/index.ts imports it.`,
    );
  }
  return tool;
}

export function listRegisteredTools(): JarvisToolName[] {
  return Array.from(registry.keys());
}
