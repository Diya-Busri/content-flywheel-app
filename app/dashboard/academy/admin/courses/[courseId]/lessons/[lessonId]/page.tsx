import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import { getLessonById, getCourseById } from "@/db/queries/academy-queries";
import { LessonEditorClient } from "./LessonEditorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Lesson | Academy Admin" };

export default async function LessonEditorPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const [lesson, course] = await Promise.all([
    getLessonById(params.lessonId),
    getCourseById(params.courseId),
  ]);
  if (!lesson || !course) notFound();

  return (
    <LessonEditorClient
      lesson={JSON.parse(JSON.stringify(lesson))}
      courseId={params.courseId}
      courseTitle={course.title}
    />
  );
}
