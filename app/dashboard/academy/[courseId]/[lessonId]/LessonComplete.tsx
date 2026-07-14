"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, ArrowRight, Loader2, Zap, Trophy,
  Star, Rocket, ShoppingBag, BookOpen, MessageCircleQuestion, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { markLessonCompleteAction } from "@/actions/academy-actions";
import { CompletionCelebration } from "@/components/academy/completion-celebration";
import { UnderstandingCheckPanel } from "@/components/academy/UnderstandingCheckPanel";
import type { CourseCheckpointRecap } from "@/db/queries/academy-checkpoint-queries";

const XP_PER_LESSON = 10;

const MOTIVATIONAL_MESSAGES = [
  "Keep the momentum going — every lesson is one step closer to your first sale. 🔥",
  "You're building real skills. The best creators never stop learning. 💪",
  "Progress is progress. Keep showing up. 🚀",
  "You're ahead of 90% of people who never start. 🌟",
  "Another lesson down. Your first product is getting closer. ✨",
];

function getMotivationalMessage(lessonIndex: number): string {
  return MOTIVATIONAL_MESSAGES[lessonIndex % MOTIVATIONAL_MESSAGES.length];
}

const ACHIEVEMENT_THRESHOLDS: Record<number, { icon: string; label: string }> = {
  1: { icon: "🎯", label: "First Step — You completed your first lesson!" },
  3: { icon: "⚡", label: "Quick Learner — 3 lessons done!" },
  5: { icon: "🔥", label: "On Fire — 5 lessons completed!" },
  10: { icon: "🏆", label: "Dedicated Creator — 10 lessons!" },
};

export function LessonComplete({
  lessonId,
  courseId,
  lessonTitle,
  alreadyComplete,
  nextLessonId,
  isLastLesson,
  totalLessons,
  completedCount,
  checkpointEnabled = false,
  applyToolKey,
  checkpointRecap = null,
}: {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  alreadyComplete: boolean;
  nextLessonId: string | null;
  isLastLesson?: boolean;
  totalLessons?: number;
  completedCount?: number;
  /** Understanding Check feature flag — resolved server-side (admin bypass + per-user beta flag). */
  checkpointEnabled?: boolean;
  applyToolKey?: string | null;
  /** Course-wide Understanding Check rollup — only ever populated for the last lesson. */
  checkpointRecap?: CourseCheckpointRecap | null;
}) {
  const [completed, setCompleted] = useState(alreadyComplete);
  const [celebrate, setCelebrate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCourseComplete, setShowCourseComplete] = useState(false);
  const [newXP, setNewXP] = useState(0);
  const [achievement, setAchievement] = useState<{ icon: string; label: string } | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  // Gates the next-lesson UI only for a FRESH completion this session — revisiting an
  // already-completed lesson never re-forces the checkpoint open (it's still reachable
  // via the "Understanding Check" button below, per "don't repeatedly force it open").
  const [checkpointDone, setCheckpointDone] = useState(!checkpointEnabled || alreadyComplete);
  const { toast } = useToast();
  const router = useRouter();

  function finishCompletionFlow() {
    if (isLastLesson) {
      setShowCourseComplete(true);
    } else {
      toast({
        title: `+${XP_PER_LESSON} XP — Lesson complete! 🎉`,
        description: getMotivationalMessage(completedCount ?? 0),
      });
    }
  }

  async function handleComplete() {
    setLoading(true);
    const res = await markLessonCompleteAction(lessonId, courseId);
    setLoading(false);

    if (res.isSuccess) {
      setCompleted(true);
      setCelebrate(true);
      setNewXP(XP_PER_LESSON);

      // Check for achievement unlock
      const newCount = (completedCount ?? 0) + 1;
      const unlocked = ACHIEVEMENT_THRESHOLDS[newCount];
      if (unlocked) setAchievement(unlocked);

      if (checkpointEnabled) {
        // Open the Understanding Check before showing the normal next-lesson action.
        setShowPanel(true);
      } else {
        finishCompletionFlow();
      }
      router.refresh();
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  function handlePanelDone() {
    // Only the FIRST time the panel concludes after a fresh completion should trigger
    // the celebration/next-step flow. Manual reopens later (checkpointDone already
    // true) just close the panel without re-firing XP toasts or the course-complete screen.
    if (!checkpointDone) {
      setCheckpointDone(true);
      finishCompletionFlow();
    }
  }

  // Course completion celebration screen
  if (showCourseComplete) {
    return (
      <div className="space-y-6">
        {celebrate && <CompletionCelebration />}
        <div className="rounded-xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10">
            <Trophy className="h-8 w-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Course Complete! 🎉</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
            You&apos;ve finished all {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}. You now have everything
            you need to publish your first digital product.
          </p>

          {/* XP earned */}
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">
              +{(totalLessons ?? 1) * XP_PER_LESSON} XP earned
            </span>
          </div>

          {/* What you've built */}
          <div className="mt-6 rounded-lg border bg-card p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              What you can now do
            </p>
            <div className="space-y-2">
              {[
                "Research and validate your niche",
                "Create your digital product",
                "Design it professionally",
                "Write your sales copy",
                "Publish to the marketplace",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Understanding Check recap — only shown if the feature is on and at least one checkpoint was opened. */}
          {checkpointRecap && checkpointRecap.lessonsWithCheckpoint > 0 && (
            <div className="mt-4 rounded-lg border bg-card p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-orange-500" /> Your Understanding Checks
              </p>
              <div className="space-y-1.5 text-sm text-foreground">
                <p>
                  You confirmed you understood{" "}
                  <span className="font-medium">
                    {checkpointRecap.understoodCount} of {checkpointRecap.lessonsWithCheckpoint}
                  </span>{" "}
                  lessons.
                </p>
                {checkpointRecap.helpUsedCount > 0 && (
                  <p className="text-muted-foreground">
                    You asked for extra help on {checkpointRecap.helpUsedCount} lesson{checkpointRecap.helpUsedCount === 1 ? "" : "s"} —
                    revisit those anytime from the course sidebar.
                  </p>
                )}
                {checkpointRecap.skippedCount > 0 && (
                  <p className="text-muted-foreground">
                    You skipped the checkpoint on {checkpointRecap.skippedCount} lesson{checkpointRecap.skippedCount === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard/digital-products/discover"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Rocket className="h-4 w-4" /> Create My Product
            </Link>
            <Link
              href="/dashboard/marketplace"
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <ShoppingBag className="h-4 w-4" /> Visit Marketplace
            </Link>
            <Link
              href="/dashboard/academy"
              className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <BookOpen className="h-4 w-4" /> More Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {celebrate && !showCourseComplete && <CompletionCelebration />}

      {/* Achievement unlock */}
      {achievement && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <span className="text-2xl">{achievement.icon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Achievement unlocked!</p>
            <p className="text-xs text-muted-foreground">{achievement.label}</p>
          </div>
        </div>
      )}

      {/* XP earned notification */}
      {newXP > 0 && !showCourseComplete && (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-foreground">+{newXP} XP earned</span>
          <Star className="h-3.5 w-3.5 text-amber-400 ml-auto" />
        </div>
      )}

      {/* Complete / Next */}
      <div className="flex flex-wrap items-center gap-3">
        {!completed && (
          <Button onClick={handleComplete} disabled={loading} className="bg-orange-500 hover:bg-orange-600">
            {loading
              ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Marking complete…</>
              : <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Mark as Complete</>}
          </Button>
        )}

        {completed && !checkpointDone && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-2 text-sm font-medium text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Completed — finishing your Understanding Check…
          </span>
        )}

        {completed && checkpointDone && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-2 text-sm font-medium text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Completed
            </span>
            {nextLessonId && !isLastLesson && (
              <Link
                href={`/dashboard/academy/${courseId}/${nextLessonId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Next Lesson <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            {isLastLesson && (
              <Link
                href="/dashboard/digital-products/discover"
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
              >
                <Rocket className="h-4 w-4" /> Create My Product
              </Link>
            )}
            {checkpointEnabled && (
              <button
                type="button"
                onClick={() => setShowPanel(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <MessageCircleQuestion className="h-3.5 w-3.5" /> Understanding Check
              </button>
            )}
          </>
        )}
      </div>

      {checkpointEnabled && (
        <UnderstandingCheckPanel
          open={showPanel}
          onOpenChange={setShowPanel}
          lessonId={lessonId}
          lessonTitle={lessonTitle}
          applyToolKey={applyToolKey}
          onDone={handlePanelDone}
        />
      )}
    </div>
  );
}
