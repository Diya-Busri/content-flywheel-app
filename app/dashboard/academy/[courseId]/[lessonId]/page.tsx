import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Download, FileText } from "lucide-react";
import {
  getCourseById,
  getLessonById,
  listModulesByCourse,
  listLessonsByCourse,
  listResourcesByLesson,
  getUserCourseProgress,
} from "@/db/queries/academy-queries";
import { LessonPlayer } from "@/components/academy/lesson-player";
import { LessonSidebar } from "@/components/academy/lesson-sidebar";
import { BlockViewer } from "@/components/academy/block-viewer";
import { parseLessonBlocks } from "@/lib/academy-blocks";
import { LessonComplete } from "./LessonComplete";

export const dynamic = "force-dynamic";

export default async function LessonViewerPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const { userId } = await auth();
  const [course, lesson] = await Promise.all([
    getCourseById(params.courseId),
    getLessonById(params.lessonId),
  ]);
  if (!course || !lesson || lesson.courseId !== course.id) return notFound();

  const [modules, lessons, resources, progress] = await Promise.all([
    listModulesByCourse(params.courseId),
    listLessonsByCourse(params.courseId),
    listResourcesByLesson(params.lessonId),
    userId ? getUserCourseProgress(userId, params.courseId) : Promise.resolve([]),
  ]);

  const publishedLessons = lessons.filter((l) => l.isPublished);
  const completedIds = progress.map((p) => p.lessonId);
  const completedSet = new Set(completedIds);

  const lessonsByModule: Record<string, typeof publishedLessons> = {};
  for (const m of modules) lessonsByModule[m.id] = [];
  for (const l of publishedLessons) {
    if (lessonsByModule[l.moduleId]) lessonsByModule[l.moduleId].push(l);
  }

  const currentIndex = publishedLessons.findIndex((l) => l.id === lesson.id);
  const nextLesson = currentIndex >= 0 ? publishedLessons[currentIndex + 1] : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Sidebar */}
      <div className="hidden w-72 shrink-0 border-r bg-card md:block">
        <LessonSidebar
          courseId={course.id}
          courseTitle={course.title}
          modules={modules}
          lessonsByModule={lessonsByModule}
          completedLessonIds={completedIds}
          currentLessonId={lesson.id}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
          <h1 className="text-xl font-bold text-foreground">{lesson.title}</h1>

          {/* Legacy YouTube field — only shown for older lessons that predate block content */}
          {lesson.videoUrl && (
            <div className="mt-4">
              <LessonPlayer videoUrl={lesson.videoUrl} />
            </div>
          )}

          {(() => {
            const blocks = parseLessonBlocks(lesson.content);
            return blocks.length > 0 ? (
              <div className="mt-6">
                <BlockViewer blocks={blocks} />
              </div>
            ) : null;
          })()}

          {resources.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4" /> Resources
              </h2>
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-foreground">{r.title}</span>
                      {r.fileType && (
                        <span className="text-[11px] uppercase text-muted-foreground">{r.fileType}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 border-t pt-6">
            <LessonComplete
              lessonId={lesson.id}
              courseId={course.id}
              alreadyComplete={completedSet.has(lesson.id)}
              nextLessonId={nextLesson?.id ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
