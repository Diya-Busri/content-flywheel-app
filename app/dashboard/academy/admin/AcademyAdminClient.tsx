"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pin,
  Star,
  Loader2,
  GripVertical,
  Pencil,
} from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import {
  createCourseAction,
  updateCourseAction,
  deleteCourseAction,
  publishCourseAction,
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  reorderModulesAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
  pinPostAction,
  featurePostAction,
  deletePostAction,
} from "@/actions/academy-actions";
import { categoryLabel, timeAgo } from "@/lib/academy";

type AnyRow = Record<string, any>;

export function AcademyAdminClient({
  courses,
  modulesByCourse,
  lessonsByCourse,
  posts,
}: {
  courses: AnyRow[];
  modulesByCourse: Record<string, AnyRow[]>;
  lessonsByCourse: Record<string, AnyRow[]>;
  posts: AnyRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(courses[0]?.id ?? null);

  async function run(fn: () => Promise<{ isSuccess: boolean; message: string }>, successMsg?: string) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.isSuccess) {
      toast({ title: successMsg ?? res.message });
      router.refresh();
    } else {
      toast({ title: "Error", description: res.message, variant: "destructive" });
    }
    return res.isSuccess;
  }

  return (
    <Tabs defaultValue="courses">
      <TabsList>
        <TabsTrigger value="courses">Courses</TabsTrigger>
        <TabsTrigger value="community">Community</TabsTrigger>
      </TabsList>

      {/* ---------------- COURSES ---------------- */}
      <TabsContent value="courses" className="mt-4 space-y-4">
        <NewCourseForm pending={pending} onCreate={(data) => run(() => createCourseAction(data as any), "Course created")} />

        {courses.map((course) => (
          <div key={course.id} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 p-3">
              <button
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                className="flex flex-1 items-center gap-2 text-left"
              >
                {expandedCourse === course.id ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span className="font-medium text-foreground">{course.title}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    course.isPublished ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {course.isPublished ? "Published" : "Draft"}
                </span>
              </button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => publishCourseAction(course.id, !course.isPublished))}
              >
                {course.isPublished ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this course and all its content?")) run(() => deleteCourseAction(course.id));
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>

            {expandedCourse === course.id && (
              <div className="space-y-4 border-t p-4">
                <CourseEditForm
                  course={course}
                  pending={pending}
                  onSave={(data) => run(() => updateCourseAction(course.id, data), "Course updated")}
                />
                <ModuleManager
                  course={course}
                  modules={modulesByCourse[course.id] ?? []}
                  lessons={lessonsByCourse[course.id] ?? []}
                  pending={pending}
                  run={run}
                />
              </div>
            )}
          </div>
        ))}
      </TabsContent>

      {/* ---------------- COMMUNITY ---------------- */}
      <TabsContent value="community" className="mt-4 space-y-3">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts.</p>}
        {posts.map((post) => (
          <div key={post.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">{categoryLabel(post.category)}</span>
                {post.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                {post.isFeatured && <Star className="h-3 w-3 text-yellow-500" />}
                <span>{timeAgo(post.createdAt)}</span>
              </div>
              <p className="mt-1 font-medium text-foreground">{post.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{post.userEmail}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => pinPostAction(post.id, !post.isPinned))}
              >
                {post.isPinned ? "Unpin" : "Pin"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => featurePostAction(post.id, !post.isFeatured))}
              >
                {post.isFeatured ? "Unfeature" : "Feature"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this post?")) run(() => deletePostAction(post.id));
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------- Forms ------------------------- */

function NewCourseForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (data: AnyRow) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <div className="rounded-xl border border-dashed bg-card p-3">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Course
        </Button>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>Course title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Launching Your First Product" />
          </div>
          <Button
            disabled={pending || !title.trim()}
            onClick={async () => {
              const ok = await onCreate({ title: title.trim() });
              if (ok) {
                setTitle("");
                setOpen(false);
              }
            }}
          >
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Create
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function CourseEditForm({
  course,
  pending,
  onSave,
}: {
  course: AnyRow;
  pending: boolean;
  onSave: (data: AnyRow) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    title: course.title ?? "",
    description: course.description ?? "",
    difficulty: course.difficulty ?? "beginner",
    estimatedDuration: course.estimatedDuration ?? "",
    thumbnailUrl: course.thumbnailUrl ?? "",
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
        />
      </div>
      <div>
        <Label>Difficulty</Label>
        <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
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
        <Label>Estimated duration</Label>
        <Input
          value={form.estimatedDuration}
          onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })}
          placeholder="e.g. 2 hours"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Thumbnail URL</Label>
        <Input
          value={form.thumbnailUrl}
          onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div>
        <Button disabled={pending} onClick={() => onSave(form)}>
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save course
        </Button>
      </div>
    </div>
  );
}

function ModuleManager({
  course,
  modules,
  lessons,
  pending,
  run,
}: {
  course: AnyRow;
  modules: AnyRow[];
  lessons: AnyRow[];
  pending: boolean;
  run: (fn: () => Promise<{ isSuccess: boolean; message: string }>, msg?: string) => Promise<boolean>;
}) {
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const sorted = [...modules].sort((a, b) => a.orderIndex - b.orderIndex);

  function move(idx: number, dir: -1 | 1) {
    const arr = [...sorted];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    run(() => reorderModulesAction(arr.map((m) => m.id)), "Reordered");
  }

  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Modules</h3>
      <div className="space-y-3">
        {sorted.map((mod, idx) => (
          <div key={mod.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Input
                defaultValue={mod.title}
                className="flex-1"
                onBlur={(e) => {
                  if (e.target.value !== mod.title)
                    run(() => updateModuleAction(mod.id, { title: e.target.value }), "Module updated");
                }}
              />
              <Button size="sm" variant="ghost" disabled={pending || idx === 0} onClick={() => move(idx, -1)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending || idx === sorted.length - 1}
                onClick={() => move(idx, 1)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete module and its lessons?")) run(() => deleteModuleAction(mod.id));
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
            <LessonManager
              course={course}
              moduleId={mod.id}
              lessons={lessons.filter((l) => l.moduleId === mod.id)}
              pending={pending}
              run={run}
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Label>New module</Label>
          <Input value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Module title" />
        </div>
        <Button
          disabled={pending || !newModuleTitle.trim()}
          onClick={async () => {
            const ok = await run(
              () => createModuleAction({ courseId: course.id, title: newModuleTitle.trim() }),
              "Module added"
            );
            if (ok) setNewModuleTitle("");
          }}
        >
          <Plus className="mr-1 h-4 w-4" />Add
        </Button>
      </div>
    </div>
  );
}

function LessonManager({
  course,
  moduleId,
  lessons,
  pending,
  run,
}: {
  course: AnyRow;
  moduleId: string;
  lessons: AnyRow[];
  pending: boolean;
  run: (fn: () => Promise<{ isSuccess: boolean; message: string }>, msg?: string) => Promise<boolean>;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);

  function move(idx: number, dir: -1 | 1) {
    const arr = [...sorted];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    run(() => reorderLessonsAction(arr.map((l) => l.id)), "Reordered");
  }

  return (
    <div className="ml-6 mt-2 space-y-2 border-l pl-3">
      {sorted.map((lesson, idx) => (
        <div key={lesson.id} className="rounded-md border bg-background/50 p-2">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-sm text-foreground">{lesson.title}</span>
            {!lesson.isPublished && <span className="text-[10px] text-muted-foreground">(draft)</span>}
            <Button size="sm" variant="ghost" onClick={() => setEditing(editing === lesson.id ? null : lesson.id)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" disabled={pending || idx === 0} onClick={() => move(idx, -1)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending || idx === sorted.length - 1}
              onClick={() => move(idx, 1)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete lesson?")) run(() => deleteLessonAction(lesson.id));
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </div>
          {editing === lesson.id && (
            <LessonForm
              initial={lesson}
              pending={pending}
              onSave={async (data) => {
                const ok = await run(() => updateLessonAction(lesson.id, data), "Lesson updated");
                if (ok) setEditing(null);
              }}
            />
          )}
        </div>
      ))}

      {showNew ? (
        <LessonForm
          initial={{}}
          pending={pending}
          onSave={async (data) => {
            const ok = await run(
              () => createLessonAction({ ...data, courseId: course.id, moduleId, title: data.title }),
              "Lesson added"
            );
            if (ok) setShowNew(false);
          }}
          onCancel={() => setShowNew(false)}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />Add lesson
        </Button>
      )}
    </div>
  );
}

function LessonForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial: AnyRow;
  pending: boolean;
  onSave: (data: AnyRow) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    title: initial.title ?? "",
    videoUrl: initial.videoUrl ?? "",
    content: initial.content ?? "",
    lessonType: initial.lessonType ?? "video",
    durationMinutes: initial.durationMinutes ?? "",
    isPublished: initial.isPublished ?? true,
  });

  return (
    <div className="mt-2 grid gap-2">
      <Input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Lesson title"
      />
      <Input
        value={form.videoUrl}
        onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
        placeholder="YouTube URL (optional)"
      />
      <Textarea
        value={form.content}
        onChange={(e) => setForm({ ...form, content: e.target.value })}
        placeholder="Lesson content / notes (optional)"
        rows={3}
      />
      <div className="flex gap-2">
        <Select value={form.lessonType} onValueChange={(v) => setForm({ ...form, lessonType: v })}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          placeholder="Minutes"
          className="w-28"
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
          />
          Published
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !form.title.trim()}
          onClick={() =>
            onSave({
              title: form.title.trim(),
              videoUrl: form.videoUrl || null,
              content: form.content || null,
              lessonType: form.lessonType,
              durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
              isPublished: form.isPublished,
            })
          }
        >
          {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
