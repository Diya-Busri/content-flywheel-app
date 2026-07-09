"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Plus, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { ImageUploadZone } from "@/components/academy/image-upload-zone";
import { SortableModuleList } from "@/components/academy/sortable-module-list";
import {
  updateCourseAction,
  updateCourseStatusAction,
  updateCourseImageAction,
  toggleCourseFeaturedAction,
} from "@/actions/academy-actions";
import { generateSlug, COURSE_CATEGORIES } from "@/lib/academy";

type AnyRow = Record<string, any>;

function parseOutcomes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CourseEditorClient({
  course,
  modules,
  lessons,
}: {
  course: AnyRow;
  modules: AnyRow[];
  lessons: AnyRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();

  const [form, setForm] = useState({
    title: course.title ?? "",
    description: course.description ?? "",
    slug: course.slug ?? generateSlug(course.title ?? ""),
    category: course.category ?? "",
    difficulty: course.difficulty ?? "beginner",
    estimatedDuration: course.estimatedDuration ?? "",
    coverImageUrl: course.coverImageUrl ?? course.thumbnailUrl ?? "",
  });
  const [outcomes, setOutcomes] = useState<string[]>(parseOutcomes(course.learningOutcomes));
  const [status, setStatus] = useState<string>(course.status ?? "draft");
  const [isFeatured, setIsFeatured] = useState<boolean>(!!course.isFeatured);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const slugTouched = useRef(course.slug != null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // run() helper compatible with SortableModuleList (returns Promise<boolean>)
  const run = useCallback(
    async (fn: () => Promise<{ isSuccess: boolean; message: string }>, msg?: string) => {
      setPending(true);
      const res = await fn();
      setPending(false);
      if (res.isSuccess) {
        toast({ title: msg ?? res.message });
        router.refresh();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
      return res.isSuccess;
    },
    [router, toast]
  );

  const persist = useCallback(
    async (overrides?: Partial<typeof form> & { outcomes?: string[] }) => {
      setSaving(true);
      const data = { ...form, ...overrides };
      const ol = overrides?.outcomes ?? outcomes;
      const res = await updateCourseAction(course.id, {
        title: data.title,
        description: data.description,
        slug: data.slug || null,
        category: data.category || null,
        difficulty: data.difficulty,
        estimatedDuration: data.estimatedDuration,
        coverImageUrl: data.coverImageUrl || null,
        thumbnailUrl: data.coverImageUrl || null,
        learningOutcomes: JSON.stringify(ol),
      });
      setSaving(false);
      if (!res.isSuccess) {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    },
    [course.id, form, outcomes, toast]
  );

  // Debounced auto-save on form/outcome changes
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 2000);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "title" && !slugTouched.current) {
        next.slug = generateSlug(String(value));
      }
      return next;
    });
    scheduleSave();
  }

  async function handleAIGenerate() {
    if (!form.title.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/academy/ai/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      const newForm = {
        ...form,
        description: data.description || form.description,
        difficulty: (data.difficulty || form.difficulty).toLowerCase(),
        estimatedDuration: data.estimatedDuration || form.estimatedDuration,
      };
      setForm(newForm);
      const newOutcomes = Array.isArray(data.learningOutcomes) ? data.learningOutcomes : outcomes;
      setOutcomes(newOutcomes);
      await persist({ ...newForm, outcomes: newOutcomes });
      toast({
        title: "Course generated",
        description: `${(data.modules?.length ?? 0)} module ideas suggested — add them below.`,
      });
      // store suggested modules in window for optional manual add
      if (Array.isArray(data.modules) && data.modules.length) {
        toast({
          title: "Suggested modules",
          description: data.modules.map((m: any) => m.title).join(", "),
        });
      }
    } catch (e) {
      toast({
        title: "AI generation failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  }

  async function changeStatus(next: string) {
    setStatus(next);
    await run(() => updateCourseStatusAction(course.id, next as any), `Course set to ${next}`);
  }

  async function toggleFeatured() {
    setIsFeatured((v) => !v);
    await run(() => toggleCourseFeaturedAction(course.id));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/dashboard/academy/admin"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Academy Admin
        </Link>
        <span className="text-xs text-muted-foreground">
          {saving ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : (
            "All changes saved"
          )}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT 60% */}
        <div className="space-y-4 lg:col-span-3">
          <div>
            <Label className="mb-1.5 block">Cover image</Label>
            <ImageUploadZone
              value={form.coverImageUrl}
              onChange={(url) => {
                setForm((f) => ({ ...f, coverImageUrl: url }));
                run(() => updateCourseImageAction(course.id, url), "Cover image updated");
              }}
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Title</Label>
            <Input
              className="text-lg font-semibold"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              onBlur={() => persist()}
            />
          </div>

          <div className="flex justify-start">
            <Button variant="outline" onClick={handleAIGenerate} disabled={aiLoading || !form.title.trim()}>
              {aiLoading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Generate with AI
            </Button>
          </div>

          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              onBlur={() => persist()}
              placeholder="What is this course about?"
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Learning outcomes</Label>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={o}
                    onChange={(e) => {
                      const next = [...outcomes];
                      next[i] = e.target.value;
                      setOutcomes(next);
                      scheduleSave();
                    }}
                    onBlur={() => persist()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const next = outcomes.filter((_, j) => j !== i);
                      setOutcomes(next);
                      persist({ outcomes: next });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOutcomes([...outcomes, ""])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add outcome
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">Slug</Label>
            <Input
              value={form.slug}
              onChange={(e) => {
                slugTouched.current = true;
                updateField("slug", e.target.value);
              }}
              onBlur={() => persist()}
            />
          </div>
        </div>

        {/* RIGHT 40% */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={status} onValueChange={changeStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              {status !== "published" ? (
                <Button className="mt-2 w-full" disabled={pending} onClick={() => changeStatus("published")}>
                  Publish course
                </Button>
              ) : (
                <Button
                  className="mt-2 w-full"
                  variant="outline"
                  disabled={pending}
                  onClick={() => changeStatus("draft")}
                >
                  Unpublish
                </Button>
              )}
            </div>

            <Separator />

            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Select value={form.category || undefined} onValueChange={(v) => updateField("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => updateField("difficulty", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Estimated duration</Label>
              <Input
                value={form.estimatedDuration}
                onChange={(e) => updateField("estimatedDuration", e.target.value)}
                onBlur={() => persist()}
                placeholder="e.g. 2 hours"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Star className={`h-4 w-4 ${isFeatured ? "fill-yellow-400 text-yellow-400" : ""}`} /> Featured
              </Label>
              <Switch checked={isFeatured} onCheckedChange={toggleFeatured} />
            </div>

            <Separator />

            <Button className="w-full" disabled={saving} onClick={() => persist()}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
            </Button>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* MODULE & LESSON BUILDER */}
      <h2 className="mb-3 text-lg font-semibold text-foreground">Modules &amp; Lessons</h2>
      <SortableModuleList course={course} modules={modules} lessons={lessons} pending={pending} run={run} />
    </div>
  );
}
