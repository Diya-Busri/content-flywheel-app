import Link from "next/link";
import { BookOpen, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { DIFFICULTY_COLORS } from "@/lib/academy";
import type { SelectAcademyCourse } from "@/db/schema/academy-schema";

interface CourseCardProps {
  course: SelectAcademyCourse;
  lessonCount?: number;
  progressPercent?: number;
  nextLessonId?: string | null;
}

export function CourseCard({ course, lessonCount = 0, progressPercent, nextLessonId }: CourseCardProps) {
  const difficulty = course.difficulty ?? "beginner";
  const started = typeof progressPercent === "number" && progressPercent > 0;
  const complete = progressPercent === 100;
  const pct = progressPercent ?? 0;

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-md">
      <Link href={`/dashboard/academy/${course.id}`}>
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <BookOpen className="h-10 w-10 opacity-40" />
            </div>
          )}
          <span
            className={`absolute left-3 top-3 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${DIFFICULTY_COLORS[difficulty] ?? DIFFICULTY_COLORS.beginner}`}
          >
            {difficulty}
          </span>
          {complete && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Complete
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-semibold text-foreground line-clamp-1">{course.title}</h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" /> {lessonCount} lesson{lessonCount !== 1 ? "s" : ""}
            </span>
            {course.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {course.estimatedDuration}
              </span>
            )}
          </div>

          {started && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{Math.round(pct)}% complete</span>
                <span>{Math.round(pct * lessonCount / 100)}/{lessonCount} lessons</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${complete ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Continue / Start button */}
      <div className="border-t px-4 py-3">
        {started && !complete && nextLessonId ? (
          <Link
            href={`/dashboard/academy/${course.id}/${nextLessonId}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Link>
        ) : complete ? (
          <Link
            href={`/dashboard/academy/${course.id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <CheckCircle2 className="h-4 w-4 text-green-500" /> Review Course
          </Link>
        ) : (
          <Link
            href={`/dashboard/academy/${course.id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Start Course <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
