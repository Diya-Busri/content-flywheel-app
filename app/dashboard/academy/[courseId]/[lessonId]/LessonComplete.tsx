"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { markLessonCompleteAction } from "@/actions/academy-actions";
import { CompletionCelebration } from "@/components/academy/completion-celebration";

export function LessonComplete({
  lessonId,
  courseId,
  alreadyComplete,
  nextLessonId,
}: {
  lessonId: string;
  courseId: string;
  alreadyComplete: boolean;
  nextLessonId: string | null;
}) {
  const [completed, setCompleted] = useState(alreadyComplete);
  const [celebrate, setCelebrate] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleComplete() {
    setLoading(true);
    const res = await markLessonCompleteAction(lessonId, courseId);
    setLoading(false);
    if (res.isSuccess) {
      setCompleted(true);
      setCelebrate(true);
      toast({ title: "Lesson complete! 🎉" });
      router.refresh();
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {celebrate && <CompletionCelebration />}
      {completed ? (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/15 px-4 py-2 text-sm font-medium text-green-600">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </span>
      ) : (
        <Button onClick={handleComplete} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
          Mark as Complete
        </Button>
      )}
      {nextLessonId && (
        <Link
          href={`/dashboard/academy/${courseId}/${nextLessonId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Next Lesson <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
