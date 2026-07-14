"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Star,
  Copy,
  Archive,
  Pencil,
  Pin,
  Lock,
  Megaphone,
  BookOpen,
  Users,
  GraduationCap,
  Activity,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  createCourseAction,
  deleteCourseAction,
  duplicateCourseAction,
  archiveCourseAction,
  toggleCourseFeaturedAction,
  pinPostAction,
  featurePostAction,
  lockPostAction,
  deletePostAction,
  createAnnouncementAction,
} from "@/actions/academy-actions";
import { categoryLabel, timeAgo, COURSE_STATUS_COLORS, generateSlug } from "@/lib/academy";

type AnyRow = Record<string, any>;

interface Stats {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  totalLessons: number;
  communityPosts: number;
  activeLearners: number;
  completionRate: number;
}

interface ActivityItem {
  type: "progress" | "post";
  actor: string;
  text: string;
  at: string;
}

export function AcademyAdminClient({
  courses,
  lessonCounts,
  stats,
  activity,
  posts,
}: {
  courses: AnyRow[];
  lessonCounts: Record<string, number>;
  stats: Stats;
  activity: ActivityItem[];
  posts: AnyRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<{ isSuccess: boolean; message: string }>, successMsg?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.isSuccess) {
        toast({ title: successMsg ?? res.message });
        router.refresh();
      } else {
        toast({ title: "Error", description: res.message, variant: "destructive" });
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academy Admin</h1>
          <p className="text-sm text-muted-foreground">Manage courses, lessons and community.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/academy/admin/checkpoints" className="text-sm text-muted-foreground hover:text-foreground">
            Understanding Check analytics →
          </Link>
          <Link href="/dashboard/academy" className="text-sm text-muted-foreground hover:text-foreground">
            View Academy →
          </Link>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>

        {/* ---------------- DASHBOARD ---------------- */}
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard icon={BookOpen} label="Total Courses" value={stats.totalCourses} />
            <StatCard icon={BookOpen} label="Published" value={stats.publishedCourses} tone="green" />
            <StatCard icon={BookOpen} label="Drafts" value={stats.draftCourses} tone="muted" />
            <StatCard icon={Archive} label="Archived" value={stats.archivedCourses} tone="red" />
            <StatCard icon={GraduationCap} label="Total Lessons" value={stats.totalLessons} />
            <StatCard icon={Users} label="Community Posts" value={stats.communityPosts} />
            <StatCard icon={Users} label="Active Learners" value={stats.activeLearners} />
            <StatCard icon={Activity} label="Completion Rate" value={`${stats.completionRate}%`} tone="green" />
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
              <Activity className="h-4 w-4" /> Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        a.type === "post" ? "bg-amber-500" : "bg-green-500"
                      }`}
                    />
                    <span className="text-foreground">
                      <span className="font-medium">{a.actor}</span> {a.text}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        {/* ---------------- COURSES ---------------- */}
        <TabsContent value="courses" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <CreateCourseButton isPending={isPending} onCreate={(d) => run(() => createCourseAction(d as any), "Course created")} />
          </div>

          {courses.length === 0 && (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              No courses yet. Create your first one.
            </div>
          )}

          <div className="space-y-2">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {course.coverImageUrl || course.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={course.coverImageUrl || course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/academy/admin/courses/${course.id}`}
                      className="truncate font-medium text-foreground hover:underline"
                    >
                      {course.title}
                    </Link>
                    <Badge variant="outline" className={COURSE_STATUS_COLORS[course.status] ?? ""}>
                      {course.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {course.category && <span>{course.category}</span>}
                    {course.difficulty && <span className="capitalize">{course.difficulty}</span>}
                    <span>{lessonCounts[course.id] ?? 0} lessons</span>
                  </div>
                </div>

                <button
                  title="Toggle featured"
                  disabled={isPending}
                  onClick={() => run(() => toggleCourseFeaturedAction(course.id))}
                  className="shrink-0"
                >
                  <Star
                    className={`h-5 w-5 ${course.isFeatured ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                  />
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/dashboard/academy/admin/courses/${course.id}`}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Duplicate"
                    disabled={isPending}
                    onClick={() => run(() => duplicateCourseAction(course.id))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {course.status !== "archived" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Archive"
                      disabled={isPending}
                      onClick={() => run(() => archiveCourseAction(course.id))}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm("Delete this course and all its content?")) run(() => deleteCourseAction(course.id));
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---------------- COMMUNITY ---------------- */}
        <TabsContent value="community" className="mt-4">
          <CommunityManager posts={posts} isPending={isPending} run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------- Stat card ------------------------- */

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "green" | "red" | "muted";
}) {
  const toneClass =
    tone === "green" ? "text-green-500" : tone === "red" ? "text-red-500" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

/* ------------------------- Create course ------------------------- */

function CreateCourseButton({
  isPending,
  onCreate,
}: {
  isPending: boolean;
  onCreate: (data: AnyRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1.5 h-4 w-4" /> Create Course
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Course title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Launching Your First Digital Product"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !title.trim()}
            onClick={() => {
              onCreate({ title: title.trim(), slug: generateSlug(title), status: "draft" });
              setTitle("");
              setOpen(false);
            }}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Community manager ------------------------- */

type Run = (fn: () => Promise<{ isSuccess: boolean; message: string }>, msg?: string) => void;

function CommunityManager({ posts, isPending, run }: { posts: AnyRow[]; isPending: boolean; run: Run }) {
  const [filter, setFilter] = useState<"all" | "announcements" | "pinned" | "unanswered">("all");

  const filtered = posts.filter((p) => {
    if (filter === "announcements") return p.isAnnouncement;
    if (filter === "pinned") return p.isPinned;
    if (filter === "unanswered") return (p.commentsCount ?? 0) === 0;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "announcements", "pinned", "unanswered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              filter === f ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto">
          <CreateAnnouncementButton isPending={isPending} run={run} />
        </div>
      </div>

      {filtered.length === 0 && <p className="text-sm text-muted-foreground">No posts.</p>}

      <div className="space-y-2">
        {filtered.map((post) => (
          <div key={post.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Badge variant="outline">{categoryLabel(post.category)}</Badge>
                {post.isAnnouncement && (
                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-500">
                    <Megaphone className="mr-1 h-3 w-3" /> Announcement
                  </Badge>
                )}
                {post.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                {post.isFeatured && <Star className="h-3 w-3 text-yellow-500" />}
                {post.isLocked && <Lock className="h-3 w-3 text-red-500" />}
                <span>{timeAgo(post.createdAt)}</span>
              </div>
              <p className="mt-1 truncate font-medium text-foreground">{post.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {post.userEmail} · {post.commentsCount ?? 0} comments · {post.likesCount ?? 0} likes
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => pinPostAction(post.id, !post.isPinned))}>
                {post.isPinned ? "Unpin" : "Pin"}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => featurePostAction(post.id, !post.isFeatured))}>
                {post.isFeatured ? "Unfeature" : "Feature"}
              </Button>
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => lockPostAction(post.id))}>
                {post.isLocked ? "Unlock" : "Lock"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  if (confirm("Delete this post?")) run(() => deletePostAction(post.id));
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateAnnouncementButton({ isPending, run }: { isPending: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Megaphone className="mr-1.5 h-4 w-4" /> Create Announcement
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Content</Label>
            <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="schedule-toggle">Schedule for later</Label>
            <Switch id="schedule-toggle" checked={schedule} onCheckedChange={setSchedule} />
          </div>
          {schedule && (
            <div className="space-y-1.5">
              <Label>Publish at</Label>
              <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending || !title.trim() || !content.trim() || (schedule && !scheduledFor)}
            onClick={() => {
              run(
                () =>
                  createAnnouncementAction({
                    title: title.trim(),
                    content: content.trim(),
                    category: "admin",
                    scheduledFor: schedule ? scheduledFor : null,
                  }),
                schedule ? "Announcement scheduled" : "Announcement posted"
              );
              setTitle("");
              setContent("");
              setSchedule(false);
              setScheduledFor("");
              setOpen(false);
            }}
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {schedule ? "Schedule" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
