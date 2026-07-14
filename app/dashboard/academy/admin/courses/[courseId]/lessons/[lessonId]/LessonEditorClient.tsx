"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Copy, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { BlockEditor } from "@/components/academy/block-editor";
import { parseLessonBlocks, serializeLessonBlocks, newBlock, type Block } from "@/lib/academy-blocks";
import { APPLY_TOOL_KEYS, APPLY_TOOL_LABELS } from "@/lib/academy-checkpoint-routing";
import { AdminCheckpointPreview } from "@/components/academy/admin/AdminCheckpointPreview";
import {
  updateLessonAction,
  createLessonAction,
  deleteLessonAction,
} from "@/actions/academy-actions";

type AnyRow = Record<string, any>;

export function LessonEditorClient({
  lesson,
  courseId,
  courseTitle,
}: {
  lesson: AnyRow;
  courseId: string;
  courseTitle: string;
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [title, setTitle] = useState(lesson.title ?? "");
  const [blocks, setBlocks] = useState<Block[]>(parseLessonBlocks(lesson.content));
  const [ctaLabel, setCtaLabel] = useState<string>(lesson.ctaLabel ?? "");
  const [ctaRoute, setCtaRoute] = useState<string>(lesson.ctaRoute ?? "");
  // Understanding Check (optional) — plain one-per-line text; parsed with a JSON-or-newline
  // fallback (see lib/academy-checkpoint-prompt.ts parseListField) so either format works.
  const [learningObjectives, setLearningObjectives] = useState<string>(lesson.learningObjectives ?? "");
  const [keyConcepts, setKeyConcepts] = useState<string>(lesson.keyConcepts ?? "");
  const [suggestedExercise, setSuggestedExercise] = useState<string>(lesson.suggestedExercise ?? "");
  const [applyToolKey, setApplyToolKey] = useState<string>(lesson.applyToolKey ?? "");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const backHref = `/dashboard/academy/admin/courses/${courseId}`;

  const save = useCallback(
    async (silent = false) => {
      setSaving(true);
      const res = await updateLessonAction(lesson.id, {
        title: title.trim() || "Untitled lesson",
        content: serializeLessonBlocks(blocks),
        ctaLabel: ctaLabel.trim() || null,
        ctaRoute: ctaRoute.trim() || null,
        learningObjectives: learningObjectives.trim() || null,
        keyConcepts: keyConcepts.trim() || null,
        suggestedExercise: suggestedExercise.trim() || null,
        applyToolKey: applyToolKey.trim() || null,
      });
      setSaving(false);
      if (res.isSuccess) {
        if (!silent) toast({ title: "Lesson saved" });
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
    [lesson.id, title, blocks, ctaLabel, ctaRoute, learningObjectives, keyConcepts, suggestedExercise, applyToolKey, toast]
  );

  async function handleAISuggest() {
    if (!title.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/academy/ai/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonTitle: title.trim(), courseTitle }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      if (data.suggestedContent) {
        if (confirm("Append the AI-suggested content to this lesson?")) {
          const block = newBlock("text");
          block.content = data.suggestedContent;
          setBlocks((b) => [...b, block]);
          toast({ title: "Suggestion added", description: "Review and edit below." });
        }
      }
    } catch (e) {
      toast({
        title: "AI suggestion failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDuplicate() {
    setSaving(true);
    const res = await createLessonAction({
      moduleId: lesson.moduleId,
      courseId: lesson.courseId,
      title: `${title} (Copy)`,
      content: serializeLessonBlocks(blocks),
      lessonType: lesson.lessonType ?? "mixed",
    });
    setSaving(false);
    if (res.isSuccess && res.data) {
      toast({ title: "Lesson duplicated" });
      router.push(`/dashboard/academy/admin/courses/${courseId}/lessons/${res.data.id}`);
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this lesson?")) return;
    const res = await deleteLessonAction(lesson.id);
    if (res.isSuccess) {
      toast({ title: "Lesson deleted" });
      router.push(backHref);
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={backHref} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to course editor
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleDuplicate} disabled={saving}>
            <Copy className="mr-1 h-4 w-4" /> Duplicate
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4 text-red-500" /> Delete
          </Button>
          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="mb-1.5 block">Lesson title</Label>
          <Input
            className="text-lg font-semibold"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => save(true)}
          />
        </div>

        <Button variant="outline" onClick={handleAISuggest} disabled={aiLoading || !title.trim()}>
          {aiLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
          AI Suggest
        </Button>

        <Separator />

        <BlockEditor blocks={blocks} onChange={setBlocks} />

        <Separator />

        {/* Action CTA settings */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-0.5">Action CTA</p>
            <p className="text-xs text-muted-foreground">
              Shown at the end of the lesson to send learners to a CF tool to apply what they learned.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs">Button label</Label>
              <Input
                placeholder="e.g. Try AI Coach →"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                onBlur={() => save(true)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">Route / URL</Label>
              <Input
                placeholder="e.g. /dashboard/ai-coach or https://..."
                value={ctaRoute}
                onChange={(e) => setCtaRoute(e.target.value)}
                onBlur={() => save(true)}
              />
            </div>
          </div>
        </div>

        {/* Understanding Check settings (optional) */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">Understanding Check (optional)</p>
              <p className="text-xs text-muted-foreground">
                Improves the end-of-lesson AI checkpoint. Leave blank and the checkpoint falls back to the lesson content alone.
              </p>
            </div>
            <AdminCheckpointPreview
              lessonTitle={title}
              lessonContent={serializeLessonBlocks(blocks)}
              learningObjectives={learningObjectives}
              keyConcepts={keyConcepts}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Learning objectives (one per line)</Label>
            <Textarea
              placeholder={"e.g.\nExplain what a niche is\nIdentify 3 profitable niches"}
              value={learningObjectives}
              onChange={(e) => setLearningObjectives(e.target.value)}
              onBlur={() => save(true)}
              rows={3}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Key concepts (one per line)</Label>
            <Textarea
              placeholder={"e.g.\nNiche\nTarget audience"}
              value={keyConcepts}
              onChange={(e) => setKeyConcepts(e.target.value)}
              onBlur={() => save(true)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Suggested application exercise</Label>
            <Textarea
              placeholder="e.g. Help the learner compare 3 niche ideas against their existing skills."
              value={suggestedExercise}
              onChange={(e) => setSuggestedExercise(e.target.value)}
              onBlur={() => save(true)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Recommended destination tool (&quot;Help me apply this&quot;)</Label>
            <select
              value={applyToolKey}
              onChange={(e) => {
                setApplyToolKey(e.target.value);
              }}
              onBlur={() => save(true)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None — just show the generated result</option>
              {APPLY_TOOL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {APPLY_TOOL_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
