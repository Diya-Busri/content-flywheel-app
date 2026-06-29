import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import { getCourseWithModulesAndLessons } from "@/db/queries/academy-queries";
import { CourseEditorClient } from "./CourseEditorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Course | Academy Admin" };

export default async function CourseEditorPage({ params }: { params: { courseId: string } }) {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const tree = await getCourseWithModulesAndLessons(params.courseId);
  if (!tree) notFound();

  return (
    <CourseEditorClient
      course={JSON.parse(JSON.stringify(tree.course))}
      modules={JSON.parse(JSON.stringify(tree.modules))}
      lessons={JSON.parse(JSON.stringify(tree.lessons))}
    />
  );
}
