"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLATFORM_EMOJIS: Record<string, string> = {
  tiktok: "🎵",
  instagram: "📸",
  twitter: "✖️",
};

type Props = {
  productId: string;
  productTitle: string;
  platform: string;
  caption: string;
};

export function SchedulePostReminder({ productId, productTitle, platform, caption }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const { toast } = useToast();

  // Default: tomorrow at 9am local
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const tomorrowStr = tomorrow.toISOString().slice(0, 16);

  const [scheduledTime, setScheduledTime] = useState(tomorrowStr);

  const handleSchedule = async () => {
    const dt = new Date(scheduledTime);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      toast({ title: "Pick a future date and time", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/social-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          caption,
          productId,
          productTitle,
          scheduledTime: dt.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setScheduled(true);
      setOpen(false);
      toast({
        title: "Reminder set! 📅",
        description: `We'll remind you to post on ${PLATFORM_EMOJIS[platform] ?? ""} ${platform} on ${dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })} at ${dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
      });
    } catch {
      toast({ title: "Failed to schedule reminder", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (scheduled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
        <Check className="w-3 h-3" /> Scheduled
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-xs text-gray-500 hover:text-orange-500 px-2"
        >
          <Calendar className="w-3 h-3" />
          Schedule
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 space-y-3" align="start">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {PLATFORM_EMOJIS[platform] ?? ""} Schedule {platform} post
          </p>
          <p className="text-xs text-gray-500">
            Set a reminder — we'll notify you when it's time to post this caption.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Post date & time</Label>
          <Input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1"
          onClick={handleSchedule}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
          {loading ? "Scheduling…" : "Set Reminder"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
