/**
 * Goal progress - Timeline of all submitted proof by day
 */
import type { Metadata } from "next";
import ProgressFlow from "./ProgressFlow";

export const metadata: Metadata = {
  title: "Progress | Goal | Content Flywheel",
  description: "View your goal progress and submitted proof",
};

export default async function GoalProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProgressFlow goalId={id} />;
}
