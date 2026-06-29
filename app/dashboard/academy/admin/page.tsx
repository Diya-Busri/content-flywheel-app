import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import {
  listAllCourses,
  listModulesByCourse,
  listLessonsByCourse,
  listCommunityPosts,
} from "@/db/queries/academy-queries";
import { AcademyAdminClient } from "./AcademyAdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Academy Admin | Content Flywheel" };

export default async function AcademyAdminPage() {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const courses = await listAllCourses();
  const modulesByCourse: Record<string, any[]> = {};
  const lessonsByCourse: Record<string, any[]> = {};
  await Promise.all(
    courses.map(async (c) => {
      const [mods, lessons] = await Promise.all([listModulesByCourse(c.id), listLessonsByCourse(c.id)]);
      modulesByCourse[c.id] = mods;
      lessonsByCourse[c.id] = lessons;
    })
  );
  const posts = await listCommunityPosts("all");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Academy Admin</h1>
      <AcademyAdminClient
        courses={courses}
        modulesByCourse={modulesByCourse}
        lessonsByCourse={lessonsByCourse}
        posts={posts}
      />
    </div>
  );
}
