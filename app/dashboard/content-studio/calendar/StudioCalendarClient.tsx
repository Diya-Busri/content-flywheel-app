"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
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
  isToday,
  parseISO,
  addWeeks,
  subWeeks,
  startOfDay,
  setHours,
  setMinutes,
} from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Film,
  Loader2,
  Clock,
  Copy,
  Pencil,
  CalendarDays,
  Sparkles,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type ScheduleSlot = { platform: string; at: string };

type CalendarEvent = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "published" | "failed";
  createdAt: string;
  scheduledAt: string | null;
  scheduleSlots: ScheduleSlot[];
  views: number | null;
  engagement: number | null;
  thumbnailUrl: string | null;
  metadata?: Record<string, unknown>;
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-500/20 border-pink-500/50 text-pink-700 dark:text-pink-300",
  youtube: "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300",
  instagram: "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300",
  facebook: "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300",
  default: "bg-gray-500/20 border-gray-500/50 text-gray-700 dark:text-gray-300",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-500/20 text-gray-700 dark:text-gray-300" },
  scheduled: { label: "Scheduled", className: "bg-blue-500/20 text-blue-700 dark:text-blue-300" },
  published: { label: "Published", className: "bg-green-500/20 text-green-700 dark:text-green-300" },
  failed: { label: "Failed", className: "bg-red-500/20 text-red-700 dark:text-red-300" },
};

const OPTIMAL_TIMES = [
  { platform: "TikTok", times: "7–9 AM, 12–1 PM, 7–9 PM" },
  { platform: "YouTube", times: "2–4 PM, 9–11 PM" },
  { platform: "Instagram", times: "11 AM–1 PM, 7–9 PM" },
  { platform: "Facebook", times: "1–3 PM, 7–9 PM" },
];

function getPrimaryPlatform(ev: CalendarEvent): string {
  const first = ev.scheduleSlots?.[0]?.platform;
  if (first && PLATFORM_COLORS[first]) return first;
  return "default";
}

function getEventsByDay(events: CalendarEvent[], month: Date): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  events.forEach((ev) => {
    const at = ev.scheduledAt ? parseISO(ev.scheduledAt) : null;
    if (at && at >= monthStart && at <= monthEnd) {
      const key = format(at, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
  });
  return map;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function DraggableEventCard({
  event,
  compact = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
}) {
  const platform = getPrimaryPlatform(event);
  const status = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: { event },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`rounded border p-1.5 cursor-grab active:cursor-grabbing ${PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.default} ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {event.thumbnailUrl && !compact ? (
          <img
            src={event.thumbnailUrl}
            alt=""
            className="w-8 h-8 rounded object-cover shrink-0"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{event.title}</p>
          <Badge variant="secondary" className={`text-[10px] h-4 ${status.className}`}>
            {status.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function DroppableDayCell({
  dayKey,
  day,
  events,
  isCurrentMonth,
  onEventClick,
  onDayClick,
}: {
  dayKey: string;
  day: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  onEventClick: (ev: CalendarEvent) => void;
  onDayClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });

  return (
    <div
      ref={setNodeRef}
      onClick={onDayClick}
      className={`min-h-[100px] p-2 bg-background border-l border-b border-[#E5E7EB] dark:border-[#2A2A2A] ${
        !isCurrentMonth ? "opacity-50 bg-muted/30" : ""
      } ${isToday(day) ? "ring-1 ring-orange-500/40" : ""} ${isOver ? "bg-orange-500/10" : ""}`}
    >
      <span
        className={`text-sm font-medium ${
          isToday(day) ? "text-orange-500" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {format(day, "d")}
      </span>
      <div className="mt-1 space-y-1">
        {events.slice(0, 3).map((ev) => (
          <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}>
            <DraggableEventCard event={ev} compact />
          </div>
        ))}
        {events.length > 3 && (
          <p className="text-[10px] text-muted-foreground">+{events.length - 3} more</p>
        )}
      </div>
    </div>
  );
}

export default function StudioCalendarClient() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [batchWeekStart, setBatchWeekStart] = useState("");
  const [autoRepost, setAutoRepost] = useState(false);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/content-calendar/events");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const list = (data.events ?? []).map((e: CalendarEvent) => ({
        ...e,
        status: e.status === "failed" ? "failed" : e.status ?? "draft",
      }));
      setEvents(list);
    } catch (e) {
      toast({ title: "Could not load calendar", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over?.id || typeof over.id !== "string") return;
      const dayKey = over.id as string;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return;
      const event = events.find((ev) => ev.id === active.id);
      if (!event) return;
      setSaving(true);
      try {
        const newDate = setMinutes(setHours(parseISO(dayKey), 9), 0);
        const res = await fetch(`/api/video-timeline/videos/${event.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "scheduled",
            metadata: {
              scheduledAt: newDate.toISOString(),
              scheduleSlots: [{ platform: getPrimaryPlatform(event), at: newDate.toISOString() }],
            },
          }),
        });
        if (!res.ok) throw new Error("Failed to reschedule");
        toast({ title: "Rescheduled", description: `Moved to ${format(newDate, "MMM d, yyyy")}` });
        fetchEvents();
      } catch (err) {
        toast({ title: "Could not reschedule", variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [events, fetchEvents, toast]
  );

  const handleRescheduleSave = useCallback(async () => {
    if (!selectedEvent || !rescheduleDate) return;
    setSaving(true);
    try {
      const newDate = startOfDay(parseISO(rescheduleDate));
      const res = await fetch(`/api/video-timeline/videos/${selectedEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "scheduled",
          metadata: {
            scheduledAt: newDate.toISOString(),
            scheduleSlots: [{ platform: getPrimaryPlatform(selectedEvent), at: newDate.toISOString() }],
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to reschedule");
      toast({ title: "Rescheduled" });
      setSelectedEvent(null);
      setRescheduleDate("");
      fetchEvents();
    } catch (err) {
      toast({ title: "Could not reschedule", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [selectedEvent, rescheduleDate, fetchEvents, toast]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [month]);

  const eventsByDay = useMemo(() => getEventsByDay(events, month), [events, month]);

  const draftEvents = useMemo(
    () => events.filter((ev) => ev.status === "draft" || !ev.scheduledAt),
    [events]
  );

  const selectedDayEvents = selectedDayKey ? (eventsByDay.get(selectedDayKey) ?? []) : [];

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    weekDays.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      const atStart = startOfDay(d).getTime();
      const atEnd = atStart + 24 * 60 * 60 * 1000 - 1;
      const dayEvents = events.filter((ev) => {
        const at = ev.scheduledAt ? new Date(ev.scheduledAt).getTime() : null;
        return at != null && at >= atStart && at <= atEnd;
      });
      map.set(key, dayEvents);
    });
    return map;
  }, [events, weekDays]);

  return (
    <div className="space-y-6">
      {/* View toggle + nav */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => (view === "month" ? setMonth(subMonths(month, 1)) : setWeekStart(subWeeks(weekStart, 1)))}
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[180px] text-center">
                {view === "month"
                  ? format(month, "MMMM yyyy")
                  : `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => (view === "month" ? setMonth(addMonths(month, 1)) : setWeekStart(addWeeks(weekStart, 1)))}
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={view === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("month")}
                className={view === "month" ? "bg-orange-500 hover:bg-orange-600" : ""}
              >
                <CalendarIcon className="w-4 h-4 mr-1" />
                Month
              </Button>
              <Button
                variant={view === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("week")}
                className={view === "week" ? "bg-orange-500 hover:bg-orange-600" : ""}
              >
                <LayoutGrid className="w-4 h-4 mr-1" />
                Week
              </Button>
              <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Optimal posting times */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            Optimal posting times
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            AI-suggested best times by platform (local time). Use batch schedule to assign a whole week.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {OPTIMAL_TIMES.map((p) => (
            <div key={p.platform} className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] px-3 py-2">
              <span className="text-sm font-medium">{p.platform}</span>
              <p className="text-xs text-muted-foreground">{p.times}</p>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-center">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            AI suggest
          </Button>
        </CardContent>
      </Card>

      {/* Calendar grid */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
            </div>
          ) : view === "month" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              {draftEvents.length > 0 && (
                <div className="p-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Unscheduled — drag to a day</p>
                  <div className="flex flex-wrap gap-2">
                    {draftEvents.slice(0, 8).map((ev) => (
                      <div key={ev.id}>
                        <DraggableEventCard event={ev} />
                      </div>
                    ))}
                    {draftEvents.length > 8 && (
                      <span className="text-xs text-muted-foreground self-center">+{draftEvents.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-7">
                {WEEKDAY_HEADERS.map((h) => (
                  <div
                    key={h}
                    className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground border-b border-[#E5E7EB] dark:border-[#2A2A2A]"
                  >
                    {h}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDay.get(key) ?? [];
                  return (
                    <DroppableDayCell
                      key={key}
                      dayKey={key}
                      day={day}
                      events={dayEvents}
                      isCurrentMonth={isSameMonth(day, month)}
                      onEventClick={setSelectedEvent}
                      onDayClick={() => setSelectedDayKey(key)}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 px-3 py-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A] text-xs text-muted-foreground">
                <span className="font-medium">Platform:</span>
                {["tiktok", "youtube", "instagram", "facebook"].map((p) => (
                  <span key={p} className={`capitalize ${PLATFORM_COLORS[p] ?? ""}`}>{p}</span>
                ))}
                <span className="font-medium ml-2">Status:</span>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <span key={k} className={v.className}>{v.label}</span>
                ))}
              </div>
            </DndContext>
          ) : (
            <div className="grid grid-cols-7 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
              {WEEKDAY_HEADERS.map((h) => (
                <div
                  key={h}
                  className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground border-b border-r border-[#E5E7EB] dark:border-[#2A2A2A]"
                >
                  {h}
                </div>
              ))}
              {weekDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayEvents = weekEventsByDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    className={`min-h-[120px] p-2 border-r border-b border-[#E5E7EB] dark:border-[#2A2A2A] ${isToday(day) ? "ring-1 ring-orange-500/40" : ""}`}
                  >
                    <span className={`text-sm font-medium ${isToday(day) ? "text-orange-500" : ""}`}>
                      {format(day, "d MMM")}
                    </span>
                    <div className="mt-2 space-y-2">
                      {dayEvents.map((ev) => (
                        <div key={ev.id} onClick={() => setSelectedEvent(ev)}>
                          <DraggableEventCard event={ev} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch schedule */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-orange-500" />
            Batch schedule week
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Set a start date and assign videos to each day for the week.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">Week start (Monday)</Label>
            <Input
              type="date"
              value={batchWeekStart}
              onChange={(e) => setBatchWeekStart(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <Button variant="outline" size="sm" disabled={!batchWeekStart}>
            Open week planner
          </Button>
        </CardContent>
      </Card>

      {/* Auto-repost */}
      <Card className="border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-orange-500" />
            Auto-repost best performers
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Automatically reschedule top-performing videos (by views or engagement) to get more reach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRepost}
              onChange={(e) => setAutoRepost(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Enable auto-repost (coming soon)</span>
          </label>
        </CardContent>
      </Card>

      {/* Day detail modal */}
      <Dialog open={!!selectedDayKey} onOpenChange={(open) => !open && setSelectedDayKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDayKey ? format(parseISO(selectedDayKey), "EEEE, MMMM d, yyyy") : "Day"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scheduled content this day.</p>
            ) : (
              selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedDayKey(null);
                    setSelectedEvent(ev);
                  }}
                >
                  {ev.thumbnailUrl ? (
                    <img src={ev.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                      <Film className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{ev.title}</p>
                    <Badge variant="secondary" className={STATUS_CONFIG[ev.status]?.className ?? ""}>
                      {STATUS_CONFIG[ev.status]?.label ?? ev.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedDayKey(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video action modal: Edit / Reschedule / Duplicate */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent?.thumbnailUrl && (
                <img src={selectedEvent.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
              )}
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/video-timeline?projectId=${selectedEvent?.id}`} onClick={() => setSelectedEvent(null)}>
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Edit in Timeline
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedEvent?.scheduledAt) setRescheduleDate(format(parseISO(selectedEvent.scheduledAt), "yyyy-MM-dd"));
                  else setRescheduleDate(format(new Date(), "yyyy-MM-dd"));
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                Reschedule
              </Button>
              <Button variant="outline" size="sm" disabled title="Duplicate creates a copy (coming soon)">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Duplicate
              </Button>
            </div>
            {rescheduleDate && (
              <div className="flex items-end gap-2 pt-2 border-t">
                <div>
                  <Label className="text-xs">New date</Label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleRescheduleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setSelectedEvent(null); setRescheduleDate(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
