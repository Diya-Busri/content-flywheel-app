import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";

/**
 * Fetches the user's brand voice from the database and returns it as a
 * formatted string suitable for injecting into AI prompts (e.g. system or
 * user context). Returns an empty string if no brand voice is set.
 */
export async function getBrandVoice(userId: string): Promise<string> {
  if (!userId?.trim()) return "";

  const [row] = await db
    .select()
    .from(brandVoiceTable)
    .where(eq(brandVoiceTable.userId, userId));

  if (!row) return "";

  const parts: string[] = [];

  if (row.brandName?.trim()) {
    parts.push(`Brand name: ${row.brandName.trim()}`);
  }
  if (row.tone?.trim()) {
    parts.push(`Tone: ${row.tone.trim()}`);
  }
  if (row.targetAudience?.trim()) {
    parts.push(`Target audience: ${row.targetAudience.trim()}`);
  }
  if (row.writingStyle?.trim()) {
    parts.push(`Writing style: ${row.writingStyle.trim()}`);
  }
  if (row.examplePhrases?.trim()) {
    parts.push(`Example phrases: ${row.examplePhrases.trim()}`);
  }

  if (parts.length === 0) return "";

  return [
    "Brand voice (use when generating content for this user):",
    parts.join("\n"),
  ].join("\n");
}
