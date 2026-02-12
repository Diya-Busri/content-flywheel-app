"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, ChevronRight, Package, Video, DollarSign, PenLine } from "lucide-react";
import { GOAL_TEMPLATES } from "@/lib/goals/templates";
import { useToast } from "@/components/ui/use-toast";

const TIMEFRAME_DAYS = [7, 14, 30, 60, 90] as const;
const DAILY_TIME_OPTIONS = [
  { value: "30min", label: "30 min", minutes: 30 },
  { value: "1hr", label: "1 hr", minutes: 60 },
  { value: "2hr", label: "2 hrs", minutes: 120 },
  { value: "3hr", label: "3 hrs", minutes: 180 },
  { value: "4hr+", label: "4 hrs+", minutes: 240 },
] as const;

type CreateGoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (goalId: string) => void;
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CreateGoalDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateGoalDialogProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalDays, setTotalDays] = useState<number>(30);
  const [dailyTimeCommitment, setDailyTimeCommitment] = useState<string>("1hr");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep(0);
      setTitle("");
      setDescription("");
      setTotalDays(30);
      setDailyTimeCommitment("1hr");
    }
    onOpenChange(nextOpen);
  };

  const applyTemplate = (templateId: string | null) => {
    if (templateId) {
      const t = GOAL_TEMPLATES.find((x) => x.id === templateId);
      if (t) {
        setTitle(t.goalTitle);
        setDescription(t.description);
        setTotalDays(t.totalDays);
        setDailyTimeCommitment(t.dailyTimeCommitment);
      }
    } else {
      setTitle("");
      setDescription("");
      setTotalDays(30);
      setDailyTimeCommitment("1hr");
    }
    setStep(1);
  };

  const handleStep1Next = () => {
    if (!title.trim()) {
      toast({ title: "Enter a goal title", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleStartGoal = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          totalDays,
          dailyTimeCommitment: dailyTimeCommitment
            ? DAILY_TIME_OPTIONS.find((o) => o.value === dailyTimeCommitment)?.minutes ?? 60
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create goal");
      const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : null;
      if (!id) {
        console.error("[CreateGoalDialog] API did not return a valid goal id", data);
        throw new Error("Server did not return goal id");
      }
      toast({ title: "Goal created!" });
      handleClose(false);
      onSuccess(id);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Could not create goal",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const startDate = new Date();
  const endDate = addDays(startDate, totalDays);
  const dailyTimeLabel = DAILY_TIME_OPTIONS.find((o) => o.value === dailyTimeCommitment)?.label ?? dailyTimeCommitment;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-white">
            {step === 0 && "Choose a starting point"}
            {step === 1 && "Goal details"}
            {step === 2 && "Ready to start your goal?"}
          </DialogTitle>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Start from a pre-built plan or create your own from scratch. You can customize everything in the next step.
            </p>
            <div className="grid gap-2">
              {GOAL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50/50 dark:hover:border-orange-800 dark:hover:bg-orange-950/20 transition-colors"
                >
                  {t.id === "digital-product" && <Package className="w-5 h-5 text-orange-500 shrink-0" />}
                  {t.id === "tiktok-audience" && <Video className="w-5 h-5 text-orange-500 shrink-0" />}
                  {t.id === "first-revenue" && <DollarSign className="w-5 h-5 text-orange-500 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{t.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.totalDays} days · {t.dailyTimeCommitment}/day</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyTemplate(null)}
                className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-transparent px-4 py-3 text-left hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <PenLine className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Start from scratch</span>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal title</Label>
              <Input
                id="goal-title"
                placeholder="Launch my first product"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-desc">Description (optional)</Label>
              <Textarea
                id="goal-desc"
                placeholder="What do you want to achieve?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Timeframe</Label>
              <Select
                value={String(totalDays)}
                onValueChange={(v) => setTotalDays(Number(v))}
              >
                <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAME_DAYS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>How much time can you dedicate daily?</Label>
              <RadioGroup
                value={dailyTimeCommitment}
                onValueChange={setDailyTimeCommitment}
                className="grid gap-2"
              >
                {DAILY_TIME_OPTIONS.map((o) => (
                  <div
                    key={o.value}
                    className="flex items-center space-x-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  >
                    <RadioGroupItem value={o.value} id={`daily-${o.value}`} />
                    <Label
                      htmlFor={`daily-${o.value}`}
                      className="flex-1 cursor-pointer text-sm font-normal"
                    >
                      {o.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-slate-500">
                Be realistic — consistent small actions beat burnout
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Goal</span>
                <span className="text-slate-900 dark:text-white font-medium text-right">{title}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Duration</span>
                <span className="text-slate-900 dark:text-white font-medium">{totalDays} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Daily commitment</span>
                <span className="text-slate-900 dark:text-white font-medium">{dailyTimeLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Start date</span>
                <span className="text-slate-900 dark:text-white font-medium">Today</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">End date</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {formatDate(endDate)}
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              We&apos;ll generate your daily tasks as you progress. You&apos;ll see today&apos;s tasks immediately after starting.
            </p>
          </div>
        )}

        {step > 0 && (
        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white"
                onClick={handleStep1Next}
              >
                Next
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                onClick={handleStartGoal}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Start Goal
              </Button>
            </>
          )}
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
