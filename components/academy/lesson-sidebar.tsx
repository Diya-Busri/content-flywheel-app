"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, PlayCircle, FileText } from "lucide-react";
import type { SelectAcademyModule, SelectAcademyLesson } from "@/db/schema/academy-schema";

interface LessonSidebarProps {
  courseId: string;
  courseTitle: string;
  modules: SelectAcademyModule[];
  lessonsByModule: Record<string, SelectAcademyLesson[]>;
  completedLessonIds: string[];
  currentLessonId: string;
}

export function LessonSidebar({
  courseId,
  courseTitle,
  modules,
  lessonsByModule,
  completedLessonIds,
  currentLessonId,
}: LessonSidebarProps) {
  const completed = new Set(completedLessonIds);
  const currentModuleId = modules.find((m) =>
    (lessonsByModule[m.id] ?? []).some((l) => l.id === currentLessonId)
  )?.id;
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(currentModuleId ? [currentModuleId] : modules.map((m) => m.id))
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <aside className="flex h-full flex-col">
      <div className="border-b p-4">
        <Link href={`/dashboard/academy/${courseId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Course overview
        </Link>
        <h2 className="mt-1 font-semibold text-foreground line-clamp-2">{courseTitle}</h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {modules.map((mod) => {
          const lessons = lessonsByModule[mod.id] ?? [];
          const isOpen = expanded.has(mod.id);
          const doneCount = lessons.filter((l) => completed.has(l.id)).length;
          return (
            <div key={mod.id} className="mb-1">
              <button
                onClick={() => toggle(mod.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-muted"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                />
                <span className="flex-1 line-clamp-1">{mod.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {doneCount}/{lessons.length}
                </span>
              </button>
              {isOpen && (
                <ul className="ml-2 mt-0.5 space-y-0.5 border-l pl-2">
                  {lessons.map((lesson) => {
                    const isDone = completed.has(lesson.id);
                    const isCurrent = lesson.id === currentLessonId;
                    return (
                      <li key={lesson.id}>
                        <Link
                          href={`/dashboard/academy/${courseId}/${lesson.id}`}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                            isCurrent
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                          ) : isCurrent ? (
                            <PlayCircle className="h-4 w-4 shrink-0" />
                          ) : lesson.lessonType === "text" ? (
                            <FileText className="h-4 w-4 shrink-0 opacity-60" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 opacity-60" />
                          )}
                          <span className="line-clamp-1">{lesson.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
