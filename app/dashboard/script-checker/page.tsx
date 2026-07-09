/**
 * Script Checker flow (Flow 3) - Check script compliance with platform guidelines
 */
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq } from "drizzle-orm";
import ScriptCheckerFlow from "./ScriptCheckerFlow";

export const metadata: Metadata = {
  title: "Script Checker | Content Flywheel",
  description: "Check your scripts for platform compliance",
};

export default async function ScriptCheckerPage() {
  const { userId } = await auth();
  let hasBrandVoice = false;

  if (userId) {
    try {
      const [row] = await db
        .select({ id: brandVoiceTable.id })
        .from(brandVoiceTable)
        .where(eq(brandVoiceTable.userId, userId))
        .limit(1);
      hasBrandVoice = !!row;
    } catch {
      // non-fatal: badge just won't show
    }
  }

  return <ScriptCheckerFlow hasBrandVoice={hasBrandVoice} />;
}
