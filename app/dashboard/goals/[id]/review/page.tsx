/**
 * Weekly review - Review proofs submitted this week, confirm honesty
 */
import type { Metadata } from "next";
import ReviewFlow from "./ReviewFlow";

export const metadata: Metadata = {
  title: "Review This Week | Goal | Content Flywheel",
  description: "Review your proof submissions and confirm accountability",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewFlow goalId={id} />;
}
