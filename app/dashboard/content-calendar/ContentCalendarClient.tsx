"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setVideoPrefill, getTimelineUrl } from "@/lib/video-prefill";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  Film,
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ScheduleSlot = { platform: string; at: string };

type CalendarEvent = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "published";
  createdAt: string;
  scheduledAt: string | null;
  scheduleSlots: ScheduleSlot[];
  views: number | null;
  engagement: number | null;
  thumbnailUrl: string | null;
  metadata?: Record<string, unknown>;
};

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube Shorts" },
];

const SCHEDULE_POST_PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "both", label: "Both" },
];

type ScheduledPostItem = {
  id: string;
  contentType: string;
  contentJson: Record<string, unknown>;
  platform: string;
  scheduledTime: string | null;
  postedStatus: boolean;
  createdAt: string | null;
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getEventsByDay(events: CalendarEvent[], month: Date): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  events.forEach((ev) => {
    if (ev.status === "published" || (ev.scheduledAt && ev.status === "scheduled")) {
      const at = ev.scheduledAt ? parseISO(ev.scheduledAt) : null;
      if (at && at >= monthStart && at <= monthEnd) {
        const key = format(at, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(ev);
      }
    }
  });

  return map;
}

export default function ContentCalendarClient({
  scheduleVideoId,
  ideaTitle,
  ideaHook,
}: {
  scheduleVideoId?: string | null;
  ideaTitle?: string | null;
  ideaHook?: string | null;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [ideaBannerDismissed, setIdeaBannerDismissed] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [scheduleModalVideo, setScheduleModalVideo] = useState<CalendarEvent | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlots, setScheduleSlots] = useState<Record<string, string>>({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [calendarTab, setCalendarTab] = useState<"calendar" | "scheduled">("calendar");
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostItem[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [schedulePostModalEvent, setSchedulePostModalEvent] = useState<CalendarEvent | null>(null);
  const [schedulePostDate, setSchedulePostDate] = useState("");
  const [schedulePostTime, setSchedulePostTime] = useState("09:00");
  const [schedulePostPlatform, setSchedulePostPlatform] = useState("both");
  const [savingSchedulePost, setSavingSchedulePost] = useState(false);
  const [dueNotificationShown, setDueNotificationShown] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; hook: string; platform: string; suggestedDate: string }[]>([]);

  const { toast } = useToast();
  const router = useRouter();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content-calendar/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setEvents(data.events ?? []);
    } catch (e) {
      toast({
        title: "Could not load calendar",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const fetchScheduledPosts = useCallback(async () => {
    setScheduledLoading(true);
    try {
      const res = await fetch("/api/scheduled-posts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setScheduledPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      toast({
        title: "Could not load scheduled posts",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
      setScheduledPosts([]);
    } finally {
      setScheduledLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (calendarTab === "scheduled") fetchScheduledPosts();
  }, [calendarTab, fetchScheduledPosts]);

  useEffect(() => {
    fetchScheduledPosts();
  }, [fetchScheduledPosts]);

  useEffect(() => {
    if (scheduledPosts.length === 0 || dueNotificationShown) return;
    const now = new Date();
    const due = scheduledPosts.filter(
      (p) => !p.postedStatus && p.scheduledTime && new Date(p.scheduledTime) <= now
    );
    if (due.length > 0) {
      setDueNotificationShown(true);
      const title = due.length === 1
        ? (due[0].contentJson?.title as string) || "Scheduled post"
        : null;
      toast({
        title: "Time to post",
        description: title
          ? `"${title}" is ready to publish.`
          : `You have ${due.length} posts ready to publish.`,
      });
    }
  }, [scheduledPosts, dueNotificationShown, toast]);

  const fetchSuggestions = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/content-calendar/suggest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuggestions(Array.isArray(data.ideas) ? data.ideas : []);
    } catch (e) {
      toast({ title: "Could not generate ideas", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const openSchedulePostModal = (ev: CalendarEvent) => {
    setSchedulePostModalEvent(ev);
    const d = ev.scheduledAt ? parseISO(ev.scheduledAt) : new Date();
    setSchedulePostDate(format(d, "yyyy-MM-dd"));
    setSchedulePostTime(format(d, "HH:mm"));
    setSchedulePostPlatform("both");
  };

  const closeSchedulePostModal = () => {
    setSchedulePostModalEvent(null);
    setSavingSchedulePost(false);
  };

  const saveSchedulePost = async () => {
    if (!schedulePostModalEvent) return;
    const scheduledTime = new Date(`${schedulePostDate}T${schedulePostTime}`);
    if (Number.isNaN(scheduledTime.getTime())) {
      toast({ title: "Invalid date or time", variant: "destructive" });
      return;
    }
    setSavingSchedulePost(true);
    try {
      const res = await fetch("/api/scheduled-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: "video",
          contentJson: {
            id: schedulePostModalEvent.id,
            title: schedulePostModalEvent.title,
            status: schedulePostModalEvent.status,
            scheduledAt: schedulePostModalEvent.scheduledAt,
            thumbnailUrl: schedulePostModalEvent.thumbnailUrl,
            metadata: schedulePostModalEvent.metadata,
          },
          platform: schedulePostPlatform,
          scheduledTime: scheduledTime.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to schedule");
      toast({ title: "Scheduled", description: "Post added to queue." });
      closeSchedulePostModal();
      if (calendarTab === "scheduled") fetchScheduledPosts();
    } catch (e) {
      toast({
        title: "Could not schedule post",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingSchedulePost(false);
    }
  };

  const markScheduledAsPosted = async (id: string) => {
    try {
      const res = await fetch(`/api/scheduled-posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postedStatus: true }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Marked as posted" });
      fetchScheduledPosts();
    } catch {
      toast({ title: "Could not update", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (scheduleVideoId && events.length > 0 && !scheduleModalVideo) {
      const ev = events.find((e) => e.id === scheduleVideoId);
      if (ev) {
        setScheduleModalVideo(ev);
        const primary = ev.scheduledAt || format(new Date(), "yyyy-MM-dd");
        setScheduleDate(primary.slice(0, 10));
        const slots: Record<string, string> = {};
        ev.scheduleSlots.forEach((s) => {
          slots[s.platform] = s.at.slice(0, 16);
        });
        PLATFORMS.forEach((p) => {
          if (!slots[p.id]) slots[p.id] = format(new Date(), "yyyy-MM-dd'T'09:00");
        });
        setScheduleSlots(slots);
      }
    }
  }, [scheduleVideoId, events, scheduleModalVideo]);

  const drafts = useMemo(
    () => events.filter((e) => e.status === "draft"),
    [events]
  );
  const eventsByDay = useMemo(
    () => getEventsByDay(events, month),
    [events, month]
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [month]);

  const openScheduleModal = (ev: CalendarEvent) => {
    setScheduleModalVideo(ev);
    const primary = ev.scheduledAt || format(new Date(), "yyyy-MM-dd");
    setScheduleDate(primary.slice(0, 10));
    const slots: Record<string, string> = {};
    ev.scheduleSlots.forEach((s) => {
      slots[s.platform] = s.at.slice(0, 16);
    });
    PLATFORMS.forEach((p) => {
      if (!slots[p.id]) slots[p.id] = `${primary}T09:00`;
    });
    setScheduleSlots(slots);
  };

  const closeScheduleModal = () => {
    setScheduleModalVideo(null);
    setSavingSchedule(false);
  };

  const saveSchedule = async () => {
    if (!scheduleModalVideo) return;
    setSavingSchedule(true);
    try {
      const slots: ScheduleSlot[] = PLATFORMS.map((p) => ({
        platform: p.id,
        at: new Date(scheduleSlots[p.id] || scheduleDate).toISOString(),
      }));
      const primaryAt = slots[0]?.at ?? new Date(scheduleDate).toISOString();

      const res = await fetch(
        `/api/video-timeline/videos/${scheduleModalVideo.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "scheduled",
            metadata: {
              scheduledAt: primaryAt,
              scheduleSlots: slots,
            },
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save schedule");
      toast({ title: "Scheduled", description: "Video added to calendar." });
      fetchEvents();
      closeScheduleModal();
    } catch (e) {
      toast({
        title: "Could not schedule",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingSchedule(false);
    }
  };

  const showIdeaBanner = ideaTitle && !ideaBannerDismissed;

  return (
    <div className="space-y-8">
      {showIdeaBanner && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-foreground">Idea from Video Ideas</p>
            <p className="text-sm text-muted-foreground truncate max-w-md" title={ideaTitle}>
              {ideaTitle}
              {ideaHook ? ` — “${ideaHook}”` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVideoPrefill({
                  title: ideaTitle ?? undefined,
                  description: ideaHook ?? undefined,
                  source: "calendar",
                });
                router.push(getTimelineUrl());
              }}
            >
              Create in Timeline
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIdeaBannerDismissed(true)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Content Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            Schedule videos from Timeline. Queue posts for TikTok/Instagram and get reminded when it&apos;s time to post.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSuggestions}
            disabled={suggesting}
          >
            {suggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {suggesting ? "Thinking…" : "Suggest content"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/video-timeline">
              <Film className="w-4 h-4 mr-2" />
              Create in Timeline
            </Link>
          </Button>
        </div>
      </div>

      {/* AI content suggestions panel */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50/40 dark:bg-orange-950/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-orange-500" />
              AI Content Ideas
            </p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSuggestions([])}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((idea, i) => (
              <div
                key={i}
                className="rounded-lg bg-white dark:bg-[#1A1A1A] border border-[#E5E7EB] dark:border-[#2A2A2A] p-3 flex flex-col gap-2"
              >
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">{idea.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed flex-1">&ldquo;{idea.hook}&rdquo;</p>
                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{idea.suggestedDate} · {idea.platform}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2 border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800/50 dark:text-orange-400"
                    onClick={() => {
                      setVideoPrefill({ title: idea.title, description: idea.hook, source: "calendar" });
                      router.push(getTimelineUrl());
                    }}
                  >
                    Use idea
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={calendarTab} onValueChange={(v) => setCalendarTab(v as "calendar" | "scheduled")}>
        <TabsList className="mb-4 bg-muted">
          <TabsTrigger value="calendar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Calendar
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Scheduled
          </TabsTrigger>
        </TabsList>

      {calendarTab === "scheduled" ? (
        <>
          {scheduledLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
            </div>
          ) : scheduledPosts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No scheduled posts yet</p>
                <p className="text-sm mt-1">
                  Use &quot;Schedule Post&quot; on a calendar item to add a post to the queue. You&apos;ll get a reminder when it&apos;s time to post.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Queued posts</CardTitle>
                <p className="text-sm text-muted-foreground">
                  When the time hits, you&apos;ll see a notification to manually upload.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {scheduledPosts.map((p) => {
                    const title = (p.contentJson?.title as string) || "Untitled";
                    const scheduledAt = p.scheduledTime ? parseISO(p.scheduledTime) : null;
                    const isDue = scheduledAt && !p.postedStatus && scheduledAt <= new Date();
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {scheduledAt ? format(scheduledAt, "EEE, MMM d, yyyy 'at' h:mm a") : "—"} · {p.platform}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isDue && (
                            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
                              Time to post
                            </span>
                          )}
                          {p.postedStatus ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 text-green-600" /> Posted
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markScheduledAsPosted(p.id)}
                            >
                              <Send className="w-3.5 h-3.5 mr-1.5" />
                              Mark as posted
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <>
          {/* Month navigation + grid */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMonth(subMonths(month, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <CardTitle className="text-lg font-semibold">
                  {format(month, "MMMM yyyy")}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {WEEKDAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const isCurrentMonth = isSameMonth(day, month);
                  return (
                    <div
                      key={key}
                      className={`min-h-[100px] p-2 bg-background ${
                        !isCurrentMonth ? "opacity-50" : ""
                      } ${isToday(day) ? "ring-1 ring-primary/30 rounded" : ""}`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          isToday(day)
                            ? "text-primary"
                            : isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center gap-1 rounded px-2 py-1 bg-primary/10 text-primary group"
                          >
                            <button
                              type="button"
                              onClick={() => openScheduleModal(ev)}
                              className="flex-1 min-w-0 text-left text-xs hover:bg-primary/20 rounded flex items-center gap-1 truncate"
                            >
                              {ev.status === "published" ? (
                                <Check className="w-3 h-3 text-green-600 shrink-0" />
                              ) : (
                                <CalendarIcon className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">{ev.title}</span>
                              {(ev.views != null || ev.engagement != null) && (
                                <span className="text-muted-foreground shrink-0">
                                  {ev.views != null && `${ev.views} views`}
                                  {ev.views != null && ev.engagement != null && " · "}
                                  {ev.engagement != null && `${ev.engagement} eng`}
                                </span>
                              )}
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-xs shrink-0 opacity-70 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSchedulePostModal(ev);
                              }}
                            >
                              Schedule Post
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Drafts waiting to be scheduled */}
          {drafts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Circle className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  Drafts waiting to be scheduled
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Save from Timeline, then pick a date/time to schedule.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {drafts.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                    >
                      <span className="font-medium text-foreground truncate">
                        {ev.title}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {ev.views != null && (
                          <span className="text-xs text-muted-foreground">
                            {ev.views} views
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openScheduleModal(ev)}
                        >
                          Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSchedulePostModal(ev)}
                        >
                          Schedule Post
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/video-timeline?projectId=${ev.id}`}>
                            Edit
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" /> Published
            </span>
            <span className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Scheduled
            </span>
            <span className="flex items-center gap-2">
              <Circle className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Draft
            </span>
          </div>
        </>
      )}

      </Tabs>

      {/* Schedule Post modal (queue for TikTok/Instagram) */}
      <Dialog open={!!schedulePostModalEvent} onOpenChange={(open) => !open && closeSchedulePostModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {schedulePostModalEvent ? `Schedule Post: ${schedulePostModalEvent.title}` : "Schedule Post"}
            </DialogTitle>
          </DialogHeader>
          {schedulePostModalEvent && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={schedulePostDate}
                  onChange={(e) => setSchedulePostDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={schedulePostTime}
                  onChange={(e) => setSchedulePostTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <select
                  value={schedulePostPlatform}
                  onChange={(e) => setSchedulePostPlatform(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SCHEDULE_POST_PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                You&apos;ll get a notification when it&apos;s time to post. Upload manually to TikTok/Instagram then mark as posted.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeSchedulePostModal}>
              Cancel
            </Button>
            <Button onClick={saveSchedulePost} disabled={savingSchedulePost}>
              {savingSchedulePost ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add to queue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule modal */}
      <Dialog open={!!scheduleModalVideo} onOpenChange={(open) => !open && closeScheduleModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {scheduleModalVideo ? `Schedule: ${scheduleModalVideo.title}` : "Schedule video"}
            </DialogTitle>
          </DialogHeader>
          {scheduleModalVideo && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Primary date</Label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Time per platform</Label>
                <div className="space-y-2">
                  {PLATFORMS.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-24 text-sm text-muted-foreground">
                        {p.label}
                      </span>
                      <Input
                        type="datetime-local"
                        value={scheduleSlots[p.id] ?? ""}
                        onChange={(e) =>
                          setScheduleSlots((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-publish will run at these times (simulated until integrations are connected).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeScheduleModal}>
              Cancel
            </Button>
            <Button onClick={saveSchedule} disabled={savingSchedule}>
              {savingSchedule ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
