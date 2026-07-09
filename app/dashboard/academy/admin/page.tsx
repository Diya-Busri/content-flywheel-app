import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import {
  getAllCourses,
  listLessonsByCourse,
  getAcademyStats,
  getRecentActivity,
  getCommunityPostsForAdmin,
} from "@/db/queries/academy-queries";
import { AcademyAdminClient } from "./AcademyAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Academy Admin | Content Flywheel" };

export default async function AcademyAdminPage() {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const [courses, stats, activity, posts] = await Promise.all([
    getAllCourses(),
    getAcademyStats(),
    getRecentActivity(),
    getCommunityPostsForAdmin(),
  ]);

  // lesson counts per course
  const lessonCounts: Record<string, number> = {};
  await Promise.all(
    courses.map(async (c) => {
      const lessons = await listLessonsByCourse(c.id);
      lessonCounts[c.id] = lessons.length;
    })
  );

  return (
    <AcademyAdminClient
      courses={JSON.parse(JSON.stringify(courses))}
      lessonCounts={lessonCounts}
      stats={stats}
      activity={JSON.parse(JSON.stringify(activity))}
      posts={JSON.parse(JSON.stringify(posts))}
    />
  );
}
