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
  pinPostAction,
  featurePostAction,
  deletePostAction,
} from "@/actions/academy-actions";
import { categoryLabel, timeAgo } from "@/lib/academy";
import { SortableModuleList } from "@/components/academy/sortable-module-list";

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
                <SortableModuleList
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
