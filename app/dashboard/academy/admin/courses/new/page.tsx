import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/is-admin";
import { insertCourse } from "@/db/queries/academy-queries";

export const dynamic = "force-dynamic";

// Creates a fresh draft course then redirects into the full-page editor.
export default async function NewCoursePage() {
  if (!(await isAdmin())) redirect("/dashboard/academy");

  const course = await insertCourse({ title: "Untitled course", status: "draft" });
  redirect(`/dashboard/academy/admin/courses/${course.id}`);
}
