import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, BookOpen, GraduationCap } from "lucide-react";
import {
  getMostRecentProgress,
  getCourseById,
  listLessonsByCourse,
  getUserCourseProgress,
} from "@/db/queries/academy-queries";

/** Server component: shows the user's most recent course + next incomplete lesson. */
export async function ContinueLearningCard() {
  const { userId } = await auth();
  if (!userId) return null;

  let recent;
  try {
    recent = await getMostRecentProgress(userId);
  } catch {
    return null;
  }
  if (!recent) return null;

  const course = await getCourseById(recent.courseId);
  if (!course || !course.isPublished) return null;

  const [lessons, progress] = await Promise.all([
    listLessonsByCourse(course.id),
    getUserCourseProgress(userId, course.id),
  ]);
  const published = lessons.filter((l) => l.isPublished);
  const doneSet = new Set(progress.map((p) => p.lessonId));
  const total = published.length;
  const done = published.filter((l) => doneSet.has(l.id)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const nextLesson = published.find((l) => !doneSet.has(l.id)) ?? published[published.length - 1];
  if (!nextLesson) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">Continue learning</h2>
      </div>
      <Link href={`/dashboard/academy/${course.id}/${nextLesson.id}`} className="group block">
        <div className="rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-sm hover:shadow-md transition-all p-4 flex items-center gap-4">
          <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-[#2A2A2A]">
            {course.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <BookOpen className="h-5 w-5 text-gray-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">{course.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">Next: {nextLesson.title}</p>
            <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100 dark:bg-[#2A2A2A]">
              <div className="h-full rounded-full bg-orange-500" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">{percent}% complete</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </Link>
    </section>
  );
}
