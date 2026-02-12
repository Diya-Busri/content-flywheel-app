"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2 } from "lucide-react";

const TIMEFRAME_OPTIONS = [7, 14, 30, 60, 90] as const;
const DAILY_TIME_OPTIONS = [
  { value: "30min", label: "30 min" },
  { value: "1hr", label: "1 hr" },
  { value: "2hr", label: "2 hrs" },
  { value: "3hr", label: "3 hrs" },
  { value: "4hr+", label: "4 hrs+" },
] as const;

type CreateGoalModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function CreateGoalModal({
  open,
  onOpenChange,
}: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [dailyTime, setDailyTime] = useState<string>("1hr");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [timeframeError, setTimeframeError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleNext = () => {
    setTitleError(null);
    setTimeframeError(null);

    let valid = true;
    if (!title.trim()) {
      setTitleError("Title is required");
      valid = false;
    }
    if (!timeframe) {
      setTimeframeError("Timeframe is required");
      valid = false;
    }

    if (!valid) return;

    const formData = {
      title: title.trim(),
      description: description.trim() || undefined,
      timeframe: Number(timeframe),
      dailyTime,
    };

    console.log("CreateGoalModal Step 1 submit:", formData);

    setIsGenerating(true);
    // Placeholder: show "Generating tasks..." for a moment
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleCancel = () => {
    setTitle("");
    setDescription("");
    setTimeframe("");
    setDailyTime("1hr");
    setTitleError(null);
    setTimeframeError(null);
    setIsGenerating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isGenerating && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Goal — Step 1</DialogTitle>
        </DialogHeader>

        {isGenerating ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">
              Generating tasks...
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal title (required)</Label>
              <Input
                id="goal-title"
                placeholder="e.g. Launch my first product"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(null);
                }}
                className={titleError ? "border-red-500" : ""}
              />
              {titleError && (
                <p className="text-sm text-red-500">{titleError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-description">Description (optional)</Label>
              <Textarea
                id="goal-description"
                placeholder="What do you want to achieve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Timeframe (required)</Label>
              <Select
                value={timeframe}
                onValueChange={(v) => {
                  setTimeframe(v);
                  if (timeframeError) setTimeframeError(null);
                }}
              >
                <SelectTrigger className={timeframeError ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAME_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {timeframeError && (
                <p className="text-sm text-red-500">{timeframeError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Daily time commitment</Label>
              <Select value={dailyTime} onValueChange={setDailyTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAILY_TIME_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!isGenerating && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleNext} className="bg-orange-500 hover:bg-orange-600">
              Next →
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
