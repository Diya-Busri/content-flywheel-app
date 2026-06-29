import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { GraduationCap, Users, CheckCircle2, BookOpen, ArrowRight, Settings2 } from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import {
  listPublishedCourses,
  listLessonsByCourse,
  getAllUserProgress,
  getMostRecentProgress,
  getLessonById,
} from "@/db/queries/academy-queries";
import { CourseCard } from "@/components/academy/course-card";

export const metadata = { title: "Academy | Content Flywheel" };
export const dynamic = "force-dynamic";

export default async function AcademyHomePage() {
  const { userId } = await auth();
  const admin = await isAdmin();
  const courses = await listPublishedCourses();

  const lessonsByCourse: Record<string, Awaited<ReturnType<typeof listLessonsByCourse>>> = {};
  await Promise.all(
    courses.map(async (c) => {
      lessonsByCourse[c.id] = await listLessonsByCourse(c.id);
    })
  );

  const progress = userId ? await getAllUserProgress(userId) : [];
  const completedByCourse = new Map<string, number>();
  for (const p of progress) {
    completedByCourse.set(p.courseId, (completedByCourse.get(p.courseId) ?? 0) + 1);
  }

  const coursePercent = (courseId: string) => {
    const total = lessonsByCourse[courseId]?.length ?? 0;
    if (!total) return 0;
    return ((completedByCourse.get(courseId) ?? 0) / total) * 100;
  };

  const inProgressCount = courses.filter((c) => {
    const pct = coursePercent(c.id);
    return pct > 0 && pct < 100;
  }).length;
  const totalCompleted = progress.length;

  // Continue learning
  let continueCourse: (typeof courses)[number] | null = null;
  let continueLessonId: string | null = null;
  if (userId) {
    const recent = await getMostRecentProgress(userId);
    if (recent) {
      const recentLesson = await getLessonById(recent.lessonId);
      const course = courses.find((c) => c.id === recent.courseId);
      if (course && recentLesson) {
        continueCourse = course;
        const lessons = lessonsByCourse[course.id] ?? [];
        const doneSet = new Set(progress.filter((p) => p.courseId === course.id).map((p) => p.lessonId));
        const next = lessons.find((l) => !doneSet.has(l.id));
        continueLessonId = (next ?? recentLesson).id;
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <GraduationCap className="h-6 w-6 text-primary" /> Academy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Learn how to build, market, and sell your digital products.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> <span className="text-xs">Lessons completed</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalCompleted}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4" /> <span className="text-xs">Courses in progress</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GraduationCap className="h-4 w-4" /> <span className="text-xs">Available courses</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-foreground">{courses.length}</p>
        </div>
      </div>

      {/* Continue learning */}
      {continueCourse && continueLessonId && (
        <div className="mb-6 overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
              {continueCourse.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={continueCourse.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Continue learning</p>
              <h3 className="mt-0.5 font-semibold text-foreground">{continueCourse.title}</h3>
              <p className="text-sm text-muted-foreground">
                {Math.round(coursePercent(continueCourse.id))}% complete
              </p>
            </div>
            <Link
              href={`/dashboard/academy/${continueCourse.id}/${continueLessonId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Course grid */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">All courses</h2>
      {courses.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
          <GraduationCap className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">No courses published yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              lessonCount={lessonsByCourse[course.id]?.length ?? 0}
              progressPercent={coursePercent(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
