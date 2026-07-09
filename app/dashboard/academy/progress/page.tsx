import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, BookOpen, Trophy, Clock } from "lucide-react";
import { listPublishedCourses, listLessonsByCourse, getAllUserProgress } from "@/db/queries/academy-queries";
import { ProgressRing } from "@/components/academy/progress-ring";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Progress | Academy" };

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) return redirect("/sign-in");

  const courses = await listPublishedCourses();
  const progress = await getAllUserProgress(userId);

  const completedLessonIds = new Set(progress.map((p) => p.lessonId));
  const completedByCourse = new Map<string, number>();
  for (const p of progress) {
    completedByCourse.set(p.courseId, (completedByCourse.get(p.courseId) ?? 0) + 1);
  }

  const courseData = await Promise.all(
    courses.map(async (course) => {
      const lessons = await listLessonsByCourse(course.id);
      const completed = completedByCourse.get(course.id) ?? 0;
      const total = lessons.length;
      const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
      const started = completed > 0;
      const done = total > 0 && completed >= total;
      const nextLesson = lessons.find((l) => !completedLessonIds.has(l.id));
      return { course, lessons, completed, total, pct, started, done, nextLesson };
    })
  );

  const totalCompleted = progress.length;
  const coursesCompleted = courseData.filter((c) => c.done).length;
  const coursesStarted = courseData.filter((c) => c.started && !c.done).length;
  const activeCourses = courseData.filter((c) => c.started);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <h2 className="mb-1 text-xl font-bold text-foreground">My Progress</h2>
      <p className="mb-6 text-sm text-muted-foreground">Track your learning journey across all courses.</p>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Lessons completed", value: totalCompleted, icon: CheckCircle2, color: "text-green-500" },
          { label: "Courses finished", value: coursesCompleted, icon: Trophy, color: "text-yellow-500" },
          { label: "In progress", value: coursesStarted, icon: Clock, color: "text-blue-500" },
          { label: "Available", value: courses.length, icon: BookOpen, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className={`mb-1 flex items-center gap-1.5 text-xs text-muted-foreground`}>
              <Icon className={`h-3.5 w-3.5 ${color}`} /> {label}
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Active courses */}
      {activeCourses.length > 0 && (
        <section className="mb-8">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">In Progress</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCourses.map(({ course, completed, total, pct, nextLesson }) => (
              <div key={course.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
                <ProgressRing percent={pct} size={56} strokeWidth={5} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{course.title}</p>
                  <p className="text-xs text-muted-foreground">{completed}/{total} lessons · {pct}%</p>
                  {nextLesson && (
                    <Link
                      href={`/dashboard/academy/${course.id}/${nextLesson.id}`}
                      className="mt-1.5 inline-block rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Continue →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All courses */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">All Courses</h3>
        <div className="divide-y rounded-xl border bg-card">
          {courseData.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No courses available yet.</p>
          )}
          {courseData.map(({ course, completed, total, pct, done, started, nextLesson }) => (
            <div key={course.id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-8 text-center text-sm font-bold text-muted-foreground">{pct}%</div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                <p className="text-xs text-muted-foreground">{completed}/{total} lessons</p>
              </div>
              <div>
                {done ? (
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">Complete</span>
                ) : started && nextLesson ? (
                  <Link
                    href={`/dashboard/academy/${course.id}/${nextLesson.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Continue
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/academy/${course.id}`}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Start
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
