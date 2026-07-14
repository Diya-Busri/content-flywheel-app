import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { FileText, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
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
import { isAcademyCheckpointEnabled } from "@/lib/academy/checkpoint-guard";
import { getCourseCheckpointRecap } from "@/db/queries/academy-checkpoint-queries";
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

  const [modules, lessons, resources, progress, checkpointEnabled] = await Promise.all([
    listModulesByCourse(params.courseId),
    listLessonsByCourse(params.courseId),
    listResourcesByLesson(params.lessonId),
    userId ? getUserCourseProgress(userId, params.courseId) : Promise.resolve([]),
    userId ? isAcademyCheckpointEnabled(userId) : Promise.resolve(false),
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
  const isLastLesson = currentIndex === publishedLessons.length - 1;
  const lessonNumber = currentIndex + 1;

  // Only fetched for the course-complete recap — no point querying this on every lesson page.
  const checkpointRecap =
    isLastLesson && checkpointEnabled && userId ? await getCourseCheckpointRecap(userId, course.id) : null;

  const blocks = parseLessonBlocks(lesson.content);
  const isInternal = lesson.ctaRoute?.startsWith("/");

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
          {/* Lesson header */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Lesson {lessonNumber} of {publishedLessons.length}
              {lesson.durationMinutes && ` · ${lesson.durationMinutes} min`}
            </p>
            <h1 className="text-xl font-bold text-foreground">{lesson.title}</h1>
          </div>

          {/* Legacy YouTube field */}
          {lesson.videoUrl && (
            <div className="mb-6">
              <LessonPlayer videoUrl={lesson.videoUrl} />
            </div>
          )}

          {/* Block content */}
          {blocks.length > 0 && (
            <div className="mb-6">
              <BlockViewer blocks={blocks} />
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div className="mb-6 rounded-xl border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-orange-500" /> Resources
              </h2>
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
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

          {/* Action CTA — open the relevant CF tool */}
          {lesson.ctaRoute && lesson.ctaLabel && (
            <div className="mb-6 rounded-xl border-2 border-orange-500/30 bg-orange-500/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">
                Now it&apos;s your turn
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Apply what you just learned — open the tool and try it with your own idea.
              </p>
              {isInternal ? (
                <Link
                  href={lesson.ctaRoute}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  {lesson.ctaLabel} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <a
                  href={lesson.ctaRoute}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  {lesson.ctaLabel} <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          {/* Complete / Next */}
          <div className="border-t pt-6">
            <LessonComplete
              lessonId={lesson.id}
              courseId={course.id}
              lessonTitle={lesson.title}
              alreadyComplete={completedSet.has(lesson.id)}
              nextLessonId={nextLesson?.id ?? null}
              isLastLesson={isLastLesson}
              totalLessons={publishedLessons.length}
              completedCount={completedIds.length}
              checkpointEnabled={checkpointEnabled}
              applyToolKey={lesson.applyToolKey}
              checkpointRecap={checkpointRecap}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
