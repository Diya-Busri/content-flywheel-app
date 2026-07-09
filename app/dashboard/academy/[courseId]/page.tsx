import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { CheckCircle2, Circle, Clock, BookOpen, ArrowRight, PlayCircle } from "lucide-react";
import {
  getCourseById,
  listModulesByCourse,
  listLessonsByCourse,
  getUserCourseProgress,
} from "@/db/queries/academy-queries";
import { DIFFICULTY_COLORS } from "@/lib/academy";
import { ProgressRing } from "@/components/academy/progress-ring";
import { CourseModuleList } from "./CourseModuleList";

export const dynamic = "force-dynamic";

export default async function CourseOverviewPage({ params }: { params: { courseId: string } }) {
  const course = await getCourseById(params.courseId);
  if (!course || !course.isPublished) return notFound();

  const { userId } = await auth();
  const [modules, lessons, progress] = await Promise.all([
    listModulesByCourse(params.courseId),
    listLessonsByCourse(params.courseId),
    userId ? getUserCourseProgress(userId, params.courseId) : Promise.resolve([]),
  ]);

  const completedIds = new Set(progress.map((p) => p.lessonId));
  const publishedLessons = lessons.filter((l) => l.isPublished);
  const total = publishedLessons.length;
  const done = publishedLessons.filter((l) => completedIds.has(l.id)).length;
  const percent = total ? (done / total) * 100 : 0;

  const lessonsByModule: Record<string, typeof publishedLessons> = {};
  for (const m of modules) lessonsByModule[m.id] = [];
  for (const l of publishedLessons) {
    if (lessonsByModule[l.moduleId]) lessonsByModule[l.moduleId].push(l);
  }

  const firstLesson = publishedLessons.find((l) => !completedIds.has(l.id)) ?? publishedLessons[0];
  const difficulty = course.difficulty ?? "beginner";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <Link href="/dashboard/academy" className="text-sm text-muted-foreground hover:text-foreground">
        ← Academy
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border bg-card">
        {course.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnailUrl} alt={course.title} className="h-48 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${DIFFICULTY_COLORS[difficulty]}`}
                >
                  {difficulty}
                </span>
                {course.estimatedDuration && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> {course.estimatedDuration}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> {total} lessons
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-foreground">{course.title}</h1>
              {course.description && (
                <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
              )}
            </div>
            {total > 0 && <ProgressRing percent={percent} size={64} />}
          </div>

          {total > 0 && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {done} of {total} lessons completed
              </p>
            </div>
          )}

          {firstLesson && (
            <Link
              href={`/dashboard/academy/${course.id}/${firstLesson.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {done > 0 ? (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" /> Start Course
                </>
              )}
            </Link>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-6 text-lg font-semibold text-foreground">Course content</h2>
      {modules.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          No lessons added yet.
        </p>
      ) : (
        <CourseModuleList
          courseId={course.id}
          modules={modules.map((m) => ({ id: m.id, title: m.title, description: m.description }))}
          lessonsByModule={Object.fromEntries(
            Object.entries(lessonsByModule).map(([mid, ls]) => [
              mid,
              ls.map((l) => ({
                id: l.id,
                title: l.title,
                durationMinutes: l.durationMinutes,
                completed: completedIds.has(l.id),
              })),
            ])
          )}
        />
      )}
    </div>
  );
}
