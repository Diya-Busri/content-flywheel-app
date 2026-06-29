import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { DIFFICULTY_COLORS } from "@/lib/academy";
import type { SelectAcademyCourse } from "@/db/schema/academy-schema";

interface CourseCardProps {
  course: SelectAcademyCourse;
  lessonCount?: number;
  progressPercent?: number;
}

export function CourseCard({ course, lessonCount = 0, progressPercent }: CourseCardProps) {
  const difficulty = course.difficulty ?? "beginner";
  const started = typeof progressPercent === "number" && progressPercent > 0;
  return (
    <Link
      href={`/dashboard/academy/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-md"
    >
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
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold text-foreground line-clamp-1">{course.title}</h3>
        {course.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" /> {lessonCount} lessons
          </span>
          {course.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {course.estimatedDuration}
            </span>
          )}
        </div>
        {started && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{Math.round(progressPercent!)}% complete</p>
          </div>
        )}
      </div>
    </Link>
  );
}
