"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronDown, Clock } from "lucide-react";

interface LessonRow {
  id: string;
  title: string;
  durationMinutes: number | null;
  completed: boolean;
}
interface ModuleRow {
  id: string;
  title: string;
  description: string | null;
}

export function CourseModuleList({
  courseId,
  modules,
  lessonsByModule,
}: {
  courseId: string;
  modules: ModuleRow[];
  lessonsByModule: Record<string, LessonRow[]>;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set(modules.map((m) => m.id)));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-2">
      {modules.map((mod, idx) => {
        const lessons = lessonsByModule[mod.id] ?? [];
        const isOpen = open.has(mod.id);
        const done = lessons.filter((l) => l.completed).length;
        return (
          <div key={mod.id} className="overflow-hidden rounded-xl border bg-card">
            <button
              onClick={() => toggle(mod.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {idx + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-foreground">{mod.title}</p>
                {mod.description && <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>}
              </div>
              <span className="text-xs text-muted-foreground">
                {done}/{lessons.length}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && lessons.length > 0 && (
              <ul className="border-t">
                {lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/dashboard/academy/${courseId}/${lesson.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50"
                    >
                      {lesson.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      )}
                      <span className="flex-1 text-foreground">{lesson.title}</span>
                      {lesson.durationMinutes != null && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {lesson.durationMinutes}m
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
