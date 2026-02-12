/**
 * Goal Tracker - Daily goals with accountability
 */
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { goalsTable } from "@/db/schema/goals-schema";
import { eq } from "drizzle-orm";
import GoalsFlow from "./GoalsFlow";
import GoalsEmptyState from "./GoalsEmptyState";

export const metadata: Metadata = {
  title: "Goal Tracker | Content Flywheel",
  description: "Track daily goals and stay accountable",
};

export default async function GoalsPage() {
  const { userId } = await auth();
  if (!userId) {
    return <GoalsEmptyState />;
  }

  const goals = await db
    .select({ id: goalsTable.id })
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .limit(1);

  const hasGoals = goals.length > 0;

  if (!hasGoals) {
    return <GoalsEmptyState />;
  }

  return <GoalsFlow />;
}
