import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import {
  GraduationCap, BookOpen, ArrowRight, Zap, Trophy, Star, Clock,
  Rocket, Target, TrendingUp, Settings2, CheckCircle2,
} from "lucide-react";
import { isAdmin } from "@/lib/is-admin";
import {
  listPublishedCourses,
  listLessonsByCourse,
  getAllUserProgress,
  getMostRecentProgress,
  getLessonById,
} from "@/db/queries/academy-queries";
import { CourseCard } from "@/components/academy/course-card";
import { ProgressRing } from "@/components/academy/progress-ring";

export const metadata = { title: "Academy | Content Flywheel" };
export const dynamic = "force-dynamic";

const XP_PER_LESSON = 10;

const LEVELS = [
  { min: 0,   label: "Beginner",     color: "text-gray-400" },
  { min: 50,  label: "Explorer",     color: "text-blue-500" },
  { min: 100, label: "Creator",      color: "text-orange-500" },
  { min: 200, label: "Pro Creator",  color: "text-purple-500" },
  { min: 350, label: "Expert",       color: "text-amber-400" },
];

function getLevel(xp: number) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) lvl = l;
  const idx = LEVELS.indexOf(lvl);
  const next = LEVELS[idx + 1];
  const progress = next
    ? ((xp - lvl.min) / (next.min - lvl.min)) * 100
    : 100;
  return { ...lvl, idx: idx + 1, xpToNext: next ? next.min - xp : 0, progress, next };
}

function getAchievements(completedCount: number, hasCompletedCourse: boolean) {
  const badges = [];
  if (completedCount >= 1) badges.push({ icon: "🎯", label: "First Step", desc: "Completed your first lesson" });
  if (completedCount >= 3) badges.push({ icon: "⚡", label: "Quick Learner", desc: "Completed 3 lessons" });
  if (hasCompletedCourse) badges.push({ icon: "🏆", label: "Graduate", desc: "Completed a full course" });
  return badges;
}

function formatTimeRemaining(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

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

  const totalLessons = courses.reduce((sum, c) => sum + (lessonsByCourse[c.id]?.length ?? 0), 0);
  const totalCompleted = progress.length;
  const overallPercent = totalLessons > 0 ? (totalCompleted / totalLessons) * 100 : 0;
  const remainingLessons = totalLessons - totalCompleted;
  const avgMinsPerLesson = 5;
  const timeRemainingMins = remainingLessons * avgMinsPerLesson;

  const xp = totalCompleted * XP_PER_LESSON;
  const level = getLevel(xp);

  const hasCompletedCourse = courses.some((c) => coursePercent(c.id) === 100);
  const achievements = getAchievements(totalCompleted, hasCompletedCourse);

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

  const firstCourse = courses[0];
  const firstLesson = firstCourse ? lessonsByCourse[firstCourse.id]?.[0] : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <GraduationCap className="h-6 w-6 text-orange-500" /> Academy
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCompleted === 0
              ? "You're 6 lessons away from publishing your first digital product."
              : totalCompleted === totalLessons && totalLessons > 0
              ? "You've completed every lesson. Time to publish! 🚀"
              : `You're ${remainingLessons} lesson${remainingLessons !== 1 ? "s" : ""} away from publishing your first digital product.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* XP badge */}
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">{xp} XP</span>
            <span className={`text-xs font-medium ${level.color}`}>· {level.label}</span>
          </div>
          {admin && (
            <Link
              href="/dashboard/academy/admin"
              className="flex items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      {courses.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Overall Progress */}
          <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <ProgressRing percent={overallPercent} size={60} strokeWidth={6} />
            <div>
              <p className="text-xs text-muted-foreground">Overall Progress</p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {Math.round(overallPercent)}% complete
              </p>
              {level.xpToNext > 0 && (
                <p className="text-[11px] text-muted-foreground">{level.xpToNext} XP to {level.next?.label}</p>
              )}
            </div>
          </div>

          {/* Lessons Completed */}
          <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
              <svg width="60" height="60" className="-rotate-90">
                <circle cx="30" cy="30" r="24" fill="none" strokeWidth="6" className="stroke-muted" />
                <circle
                  cx="30" cy="30" r="24" fill="none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 24}
                  strokeDashoffset={totalLessons > 0 ? (2 * Math.PI * 24) * (1 - totalCompleted / totalLessons) : 2 * Math.PI * 24}
                  className="stroke-orange-500 transition-all duration-500"
                />
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <span className="text-sm font-bold text-foreground">{totalCompleted}</span>
                <span className="text-[9px] text-muted-foreground">/{totalLessons}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lessons Completed</p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {totalCompleted} of {totalLessons}
              </p>
              <p className="text-[11px] text-muted-foreground">{xp} XP earned</p>
            </div>
          </div>

          {/* Time Remaining */}
          <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-orange-500/10">
              <Clock className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Time Remaining</p>
              <p className="mt-0.5 text-base font-bold text-foreground">
                {remainingLessons > 0 ? formatTimeRemaining(timeRemainingMins) : "Done! 🎉"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {remainingLessons} lesson{remainingLessons !== 1 ? "s" : ""} left
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Achievements unlocked
          </p>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <div
                key={a.label}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                title={a.desc}
              >
                <span className="text-base">{a.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{a.label}</p>
                  <p className="text-[10px] text-muted-foreground">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Journey / Continue Learning */}
      {courses.length > 0 && (
        <>
          {continueCourse && continueLessonId ? (
            /* Continue learning */
            <div className="mb-6 overflow-hidden rounded-xl border bg-gradient-to-r from-orange-500/10 to-transparent">
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">Continue learning</p>
                  <h3 className="mt-0.5 font-semibold text-foreground">{continueCourse.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(coursePercent(continueCourse.id))}% complete
                  </p>
                  <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{ width: `${coursePercent(continueCourse.id)}%` }}
                    />
                  </div>
                </div>
                <Link
                  href={`/dashboard/academy/${continueCourse.id}/${continueLessonId}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : firstCourse && firstLesson ? (
            /* Start Journey */
            <div className="mb-6 overflow-hidden rounded-xl border-2 border-dashed border-orange-500/30 bg-orange-500/[0.03] p-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                  <Rocket className="h-7 w-7 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">Start Your Journey</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Learn how to research, build, and sell your first digital product — step by step.
                  </p>
                </div>
                <Link
                  href={`/dashboard/academy/${firstCourse.id}/${firstLesson.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Start Course <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Course grid */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">All courses</h2>
        {courses.length > 0 && totalCompleted > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="text-orange-500 font-medium">{totalCompleted}</span> / {totalLessons} lessons done
          </p>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
          <p className="mt-4 text-base font-semibold text-foreground">Courses coming soon</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            We&apos;re building step-by-step courses on creating digital products, growing an audience, and making your first sale. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const pct = coursePercent(course.id);
            const lessons = lessonsByCourse[course.id] ?? [];
            const doneSet = new Set(
              progress.filter((p) => p.courseId === course.id).map((p) => p.lessonId)
            );
            const nextLesson = lessons.find((l) => !doneSet.has(l.id));
            return (
              <CourseCard
                key={course.id}
                course={course}
                lessonCount={lessons.length}
                progressPercent={pct}
                nextLessonId={nextLesson?.id ?? null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
