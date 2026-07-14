import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import { getCheckpointLessonAnalytics } from "@/db/queries/academy-checkpoint-analytics-queries";
import { CheckpointAnalyticsClient } from "./CheckpointAnalyticsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Understanding Check Analytics | Academy Admin" };

export default async function CheckpointAnalyticsPage() {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const lessons = await getCheckpointLessonAnalytics();

  return <CheckpointAnalyticsClient lessons={lessons} />;
}
