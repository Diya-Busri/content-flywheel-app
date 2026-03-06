"use client";

import { useState, useEffect } from "react";
import { Lock, Calendar, Type, Video, ListChecks, Loader2, Copy, Check, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

const STORAGE_KEY = "content_flywheel_brand_builder_access";

export type BrandCalendarDay = {
  day: number;
  post_type?: string;
  concept?: string;
  text_overlay?: string;
  hook?: string;
};

const TAB_TYPES = [
  { id: "content-calendar", label: "Content Calendar", icon: Calendar, description: "7-day content ideas per week (1–4)" },
  { id: "caption-generator", label: "Caption Generator", icon: Type, description: "Text overlay + caption + hashtags per post" },
  { id: "drop-scripts", label: "Drop Scripts", icon: Video, description: "Announcement & tease video scripts" },
  { id: "launch-checklist", label: "Launch Checklist", icon: ListChecks, description: "POD setup, waitlist emails, 1k roadmap" },
] as const;

type TabId = (typeof TAB_TYPES)[number]["id"];

export default function BrandBuilderClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [aestheticVibe, setAestheticVibe] = useState("");
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState<"TikTok" | "Instagram">("TikTok");
  const [activeTab, setActiveTab] = useState<TabId>("content-calendar");
  const [generating, setGenerating] = useState(false);
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Content Calendar state
  const [weekNumber, setWeekNumber] = useState(1);
  const [calendarDays, setCalendarDays] = useState<BrandCalendarDay[]>([]);
  const [calendarGenerating, setCalendarGenerating] = useState(false);
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [savingWeek, setSavingWeek] = useState(false);

  // Caption Generator state
  const [postConcept, setPostConcept] = useState("");
  const [captionResult, setCaptionResult] = useState<{
    caption: string;
    text_overlay: string;
    hashtags: string;
    alt_text: string;
  } | null>(null);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionCopiedField, setCaptionCopiedField] = useState<string | null>(null);

  // Drop Scripts state
  const [dropType, setDropType] = useState<string>("first drop");
  const [milestone, setMilestone] = useState("");
  const [dropScriptResult, setDropScriptResult] = useState<{
    scriptType: string;
    hook: string;
    middle: string;
    cta: string;
    text_overlays: string[];
    suggested_audio: string;
  } | null>(null);
  const [dropScriptGeneratingType, setDropScriptGeneratingType] = useState<string | null>(null);
  const [dropScriptSaving, setDropScriptSaving] = useState(false);

  // Launch Checklist state
  const [followerCount, setFollowerCount] = useState("");
  const [podPlatform, setPodPlatform] = useState<string>("Printify");
  const [sellingPlatform, setSellingPlatform] = useState<string>("Shopify");
  const [stage, setStage] = useState<string>("idea");
  const [roadmap, setRoadmap] = useState<{
    milestone_to_launch: string;
    checklist: { phase?: string; tasks?: string[]; estimated_time?: string }[];
    waitlist_email: { subject?: string; body?: string };
    first_drop_pricing: { suggested_products?: string[]; pricing_notes?: string };
  } | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [roadmapGenerating, setRoadmapGenerating] = useState(false);
  const [roadmapSaving, setRoadmapSaving] = useState(false);
  const [waitlistEmailCopied, setWaitlistEmailCopied] = useState(false);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      setUnlocked(stored === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/brand-builder/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        try {
          localStorage.setItem(STORAGE_KEY, "1");
        } catch {}
        setUnlocked(true);
        setPassword("");
      } else {
        setVerifyError(data?.error || "Incorrect password.");
      }
    } catch {
      setVerifyError("Could not verify. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setContent("");
    try {
      const res = await fetch("/api/brand-builder/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          brandName,
          aestheticVibe,
          niche,
          platform,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.content === "string") {
        setContent(data.content);
      } else {
        toast({ title: "Generation failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleGenerateWeek = async () => {
    setCalendarGenerating(true);
    try {
      const res = await fetch("/api/brand-builder/calendar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          aestheticVibe,
          niche,
          platform,
          weekNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.days)) {
        setCalendarDays(data.days);
      } else {
        toast({ title: "Generation failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setCalendarGenerating(false);
    }
  };

  const handleRegenerateDay = async (dayIndex: number) => {
    setRegeneratingDay(dayIndex);
    try {
      const res = await fetch("/api/brand-builder/calendar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          aestheticVibe,
          niche,
          platform,
          weekNumber,
          regenerateDayIndex: dayIndex,
          existingDays: calendarDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.days)) {
        setCalendarDays(data.days);
      } else {
        toast({ title: "Regenerate failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setRegeneratingDay(null);
    }
  };

  const handleSaveWeek = async () => {
    if (calendarDays.length === 0) {
      toast({ title: "No content to save", description: "Generate a week first.", variant: "destructive" });
      return;
    }
    setSavingWeek(true);
    try {
      const res = await fetch("/api/brand-builder/calendar/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          weekNumber,
          daysJson: calendarDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Week saved", description: `Week ${weekNumber} saved to your calendar.` });
      } else {
        toast({ title: "Save failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setSavingWeek(false);
    }
  };

  const handleGenerateCaption = async () => {
    setCaptionGenerating(true);
    setCaptionResult(null);
    try {
      const res = await fetch("/api/brand-builder/caption/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          postConcept,
          vibe: aestheticVibe,
          platform,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.caption !== undefined) {
        setCaptionResult({
          caption: typeof data.caption === "string" ? data.caption : "",
          text_overlay: typeof data.text_overlay === "string" ? data.text_overlay : "",
          hashtags: typeof data.hashtags === "string" ? data.hashtags : "",
          alt_text: typeof data.alt_text === "string" ? data.alt_text : "",
        });
      } else {
        toast({ title: "Generation failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setCaptionGenerating(false);
    }
  };

  const handleCopyCaptionField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCaptionCopiedField(field);
      toast({ title: "Copied" });
      setTimeout(() => setCaptionCopiedField(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleCopyAllCaption = async () => {
    if (!captionResult) return;
    const all = [
      `Caption: ${captionResult.caption}`,
      `Text overlay: ${captionResult.text_overlay}`,
      `Hashtags: ${captionResult.hashtags}`,
      `Alt text: ${captionResult.alt_text}`,
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(all);
      toast({ title: "All fields copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const DROP_SCRIPT_TYPES = ["Teaser Script", "Countdown Script", "Launch Day Script", "Sold Out/Next Drop Script"] as const;

  const handleGenerateDropScript = async (scriptType: string) => {
    setDropScriptGeneratingType(scriptType);
    setDropScriptResult(null);
    try {
      const res = await fetch("/api/brand-builder/drop-scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          dropType,
          vibe: aestheticVibe,
          milestone: milestone || undefined,
          scriptType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.hook !== undefined) {
        setDropScriptResult({
          scriptType,
          hook: typeof data.hook === "string" ? data.hook : "",
          middle: typeof data.middle === "string" ? data.middle : "",
          cta: typeof data.cta === "string" ? data.cta : "",
          text_overlays: Array.isArray(data.text_overlays) ? data.text_overlays.map(String) : [],
          suggested_audio: typeof data.suggested_audio === "string" ? data.suggested_audio : "",
        });
      } else {
        toast({ title: "Generation failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setDropScriptGeneratingType(null);
    }
  };

  const handleCopyDropScript = async () => {
    if (!dropScriptResult) return;
    const lines = [
      `[${dropScriptResult.scriptType}]`,
      "",
      "HOOK (first 3s):",
      dropScriptResult.hook,
      "",
      "MIDDLE (10-15s):",
      dropScriptResult.middle,
      "",
      "CTA (final 3s):",
      dropScriptResult.cta,
      "",
      "TEXT OVERLAYS:",
      dropScriptResult.text_overlays.length ? dropScriptResult.text_overlays.join("\n") : "—",
      "",
      "AUDIO:",
      dropScriptResult.suggested_audio || "—",
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Script copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSaveDropScript = async () => {
    if (!dropScriptResult) return;
    setDropScriptSaving(true);
    try {
      const res = await fetch("/api/brand-builder/drop-scripts/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          dropType,
          vibe: aestheticVibe,
          milestone: milestone || undefined,
          scriptType: dropScriptResult.scriptType,
          hook: dropScriptResult.hook,
          middle: dropScriptResult.middle,
          cta: dropScriptResult.cta,
          text_overlays: dropScriptResult.text_overlays,
          suggested_audio: dropScriptResult.suggested_audio || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Script saved" });
      } else {
        toast({ title: "Save failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setDropScriptSaving(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    setRoadmapGenerating(true);
    setRoadmap(null);
    setCompletedTasks(new Set());
    try {
      const res = await fetch("/api/brand-builder/launch-checklist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          followerCount,
          podPlatform,
          sellingPlatform,
          stage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.milestone_to_launch !== undefined) {
        setRoadmap({
          milestone_to_launch: data.milestone_to_launch ?? "",
          checklist: Array.isArray(data.checklist) ? data.checklist : [],
          waitlist_email: data.waitlist_email ?? { subject: "", body: "" },
          first_drop_pricing: data.first_drop_pricing ?? { suggested_products: [], pricing_notes: "" },
        });
      } else {
        const msg = (data && typeof data.error === "string" && data.error.trim()) || (res.status === 503 ? "AI is not configured. Add OPENAI_API_KEY." : res.status === 429 ? "Rate limit. Wait a minute and try again." : `Request failed (${res.status}).`);
        toast({ title: "Generation failed", description: msg, variant: "destructive" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network or request failed.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setRoadmapGenerating(false);
    }
  };

  const taskKey = (phaseIndex: number, taskIndex: number) => `${phaseIndex}.${taskIndex}`;

  const handleToggleTask = (phaseIndex: number, taskIndex: number) => {
    const key = taskKey(phaseIndex, taskIndex);
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveRoadmap = async () => {
    if (!roadmap) return;
    setRoadmapSaving(true);
    try {
      const res = await fetch("/api/brand-builder/launch-checklist/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          followerCount,
          podPlatform,
          sellingPlatform,
          stage,
          milestone_to_launch: roadmap.milestone_to_launch,
          checklist: roadmap.checklist,
          completed_tasks: Array.from(completedTasks),
          waitlist_email: roadmap.waitlist_email,
          first_drop_pricing: roadmap.first_drop_pricing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({ title: "Progress saved" });
      } else {
        toast({ title: "Save failed", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" });
    } finally {
      setRoadmapSaving(false);
    }
  };

  const handleLoadSavedRoadmap = async () => {
    try {
      const res = await fetch("/api/brand-builder/launch-checklist");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.saved) {
        const s = data.saved;
        if (s.brandName) setBrandName(s.brandName);
        if (s.followerCount) setFollowerCount(s.followerCount);
        if (s.podPlatform) setPodPlatform(s.podPlatform);
        if (s.sellingPlatform) setSellingPlatform(s.sellingPlatform);
        if (s.stage) setStage(s.stage);
        if (s.milestone_to_launch != null || s.checklist?.length) {
          setRoadmap({
            milestone_to_launch: s.milestone_to_launch ?? "",
            checklist: s.checklist ?? [],
            waitlist_email: s.waitlist_email ?? { subject: "", body: "" },
            first_drop_pricing: s.first_drop_pricing ?? { suggested_products: [], pricing_notes: "" },
          });
        }
        if (Array.isArray(s.completed_tasks)) setCompletedTasks(new Set(s.completed_tasks));
        toast({ title: "Saved roadmap loaded" });
      } else {
        toast({ title: "No saved roadmap", description: "Generate one first, then save.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load", variant: "destructive" });
    }
  };

  const handleCopyWaitlistEmail = async () => {
    if (!roadmap?.waitlist_email) return;
    const { subject = "", body = "" } = roadmap.waitlist_email;
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setWaitlistEmailCopied(true);
      toast({ title: "Waitlist email copied" });
      setTimeout(() => setWaitlistEmailCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  // Password gate
  if (!unlocked) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-card/80 p-8 shadow-xl backdrop-blur">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-white/10 p-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-center text-foreground mb-1">Brand Builder</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Enter the access password to continue.</p>
          <form onSubmit={handleVerify} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 text-foreground placeholder:text-muted-foreground"
              autoFocus
              disabled={verifying}
            />
            {verifyError && (
              <p className="text-sm text-destructive">{verifyError}</p>
            )}
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Full tool: 4 tabs
  const sharedInputs = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <div className="space-y-2">
        <Label htmlFor="brandName" className="text-muted-foreground">Brand name</Label>
        <Input
          id="brandName"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="Your brand"
          className="bg-white/5 border-white/10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="aestheticVibe" className="text-muted-foreground">Aesthetic vibe</Label>
        <Input
          id="aestheticVibe"
          value={aestheticVibe}
          onChange={(e) => setAestheticVibe(e.target.value)}
          placeholder="e.g. minimal, bold, cozy"
          className="bg-white/5 border-white/10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="niche" className="text-muted-foreground">Niche</Label>
        <Input
          id="niche"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="e.g. fitness, skincare"
          className="bg-white/5 border-white/10"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="platform" className="text-muted-foreground">Platform</Label>
        <select
          id="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as "TikTok" | "Instagram")}
          className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Brand Builder</h1>
      <p className="text-muted-foreground mb-8">Content calendar, captions, drop scripts, and launch checklist — all in your brand voice.</p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 flex flex-wrap h-auto gap-1">
          {TAB_TYPES.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-white/10 data-[state=active]:text-foreground text-muted-foreground"
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Content Calendar: week selector, Generate Week, day cards, Save Week */}
        <TabsContent value="content-calendar" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">{TAB_TYPES[0].description}</p>
          {sharedInputs}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Week</Label>
              <select
                value={weekNumber}
                onChange={(e) => setWeekNumber(Number(e.target.value))}
                className="flex h-10 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[1, 2, 3, 4].map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleGenerateWeek} disabled={calendarGenerating}>
                {calendarGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Generate Week
              </Button>
              {calendarDays.length > 0 && (
                <Button variant="outline" onClick={handleSaveWeek} disabled={savingWeek} className="border-white/10">
                  {savingWeek ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Week
                </Button>
              )}
            </div>
          </div>

          {calendarDays.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
              {calendarDays.map((d, i) => (
                <div
                  key={d.day}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Day {d.day}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegenerateDay(i)}
                      disabled={regeneratingDay !== null}
                      className="text-muted-foreground h-8"
                    >
                      {regeneratingDay === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-1">Regenerate Day</span>
                    </Button>
                  </div>
                  {d.post_type && (
                    <p className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{d.post_type}</p>
                  )}
                  {d.concept && <p className="text-sm text-foreground">{d.concept}</p>}
                  {d.text_overlay && (
                    <p className="text-sm text-foreground/90 border-l-2 border-white/20 pl-2">&ldquo;{d.text_overlay}&rdquo;</p>
                  )}
                  {d.hook && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Hook:</span> {d.hook}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Caption Generator: brand, post concept, vibe, platform → copyable fields + Regenerate / Copy All */}
        <TabsContent value="caption-generator" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">{TAB_TYPES[1].description}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="capBrandName" className="text-muted-foreground">Brand name</Label>
              <Input
                id="capBrandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Your brand"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="postConcept" className="text-muted-foreground">Post concept</Label>
              <Input
                id="postConcept"
                value={postConcept}
                onChange={(e) => setPostConcept(e.target.value)}
                placeholder="e.g. new drop try-on"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capVibe" className="text-muted-foreground">Vibe</Label>
              <Input
                id="capVibe"
                value={aestheticVibe}
                onChange={(e) => setAestheticVibe(e.target.value)}
                placeholder="e.g. minimal, bold"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capPlatform" className="text-muted-foreground">Platform</Label>
              <select
                id="capPlatform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as "TikTok" | "Instagram")}
                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="TikTok">TikTok</option>
                <option value="Instagram">Instagram</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mb-6">
            <Button onClick={handleGenerateCaption} disabled={captionGenerating}>
              {captionGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate Caption
            </Button>
            {captionResult && (
              <>
                <Button variant="outline" onClick={handleGenerateCaption} disabled={captionGenerating} className="border-white/10">
                  {captionGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Regenerate
                </Button>
                <Button variant="outline" onClick={handleCopyAllCaption} className="border-white/10">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </>
            )}
          </div>

          {captionResult && (
            <div className="space-y-4">
              {[
                { key: "caption", label: "Caption", value: captionResult.caption },
                { key: "text_overlay", label: "Text overlay", value: captionResult.text_overlay },
                { key: "hashtags", label: "Hashtags", value: captionResult.hashtags },
                { key: "alt_text", label: "Alt text", value: captionResult.alt_text },
              ].map(({ key, label, value }) => (
                <div key={key} className="rounded-lg border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCaptionField(key, value)}
                      className="h-7 text-muted-foreground"
                    >
                      {captionCopiedField === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span className="ml-1">Copy</span>
                    </Button>
                  </div>
                  <textarea
                    readOnly
                    value={value}
                    rows={key === "caption" ? 3 : key === "hashtags" ? 2 : 1}
                    className="w-full resize-none rounded bg-black/20 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Drop Scripts: brand, drop type, vibe, milestone → 4 script buttons → script card + Copy / Save */}
        <TabsContent value="drop-scripts" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">{TAB_TYPES[2].description}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="dsBrandName" className="text-muted-foreground">Brand name</Label>
              <Input
                id="dsBrandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Your brand"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dropType" className="text-muted-foreground">Drop type</Label>
              <select
                id="dropType"
                value={dropType}
                onChange={(e) => setDropType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="first drop">First drop</option>
                <option value="restock">Restock</option>
                <option value="collab">Collab</option>
                <option value="limited edition">Limited edition</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dsVibe" className="text-muted-foreground">Vibe</Label>
              <Input
                id="dsVibe"
                value={aestheticVibe}
                onChange={(e) => setAestheticVibe(e.target.value)}
                placeholder="e.g. minimal, bold"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone" className="text-muted-foreground">Follower milestone (optional)</Label>
              <Input
                id="milestone"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                placeholder="e.g. 10k"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {DROP_SCRIPT_TYPES.map((scriptType) => (
              <Button
                key={scriptType}
                variant="outline"
                onClick={() => handleGenerateDropScript(scriptType)}
                disabled={dropScriptGeneratingType !== null}
                className="border-white/10"
              >
                {dropScriptGeneratingType === scriptType ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {scriptType}
              </Button>
            ))}
          </div>

          {dropScriptResult && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {dropScriptResult.scriptType}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyDropScript} className="border-white/10">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Script
                  </Button>
                  <Button size="sm" onClick={handleSaveDropScript} disabled={dropScriptSaving}>
                    {dropScriptSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Hook (first 3s)</p>
                  <p className="text-foreground">{dropScriptResult.hook}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Middle (10–15s)</p>
                  <p className="text-foreground">{dropScriptResult.middle}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">CTA (final 3s)</p>
                  <p className="text-foreground">{dropScriptResult.cta}</p>
                </div>
                {dropScriptResult.text_overlays.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Text overlays</p>
                    <ul className="list-disc list-inside text-foreground space-y-0.5">
                      {dropScriptResult.text_overlays.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {dropScriptResult.suggested_audio && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Suggested audio</p>
                    <p className="text-foreground">{dropScriptResult.suggested_audio}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Launch Checklist: brand, followers, POD, selling, stage → roadmap + checkboxes + Save */}
        <TabsContent value="launch-checklist" className="mt-0 space-y-4">
          <p className="text-sm text-muted-foreground">{TAB_TYPES[3].description}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
            <div className="space-y-2">
              <Label htmlFor="lcBrandName" className="text-muted-foreground">Brand name</Label>
              <Input
                id="lcBrandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Your brand"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="followerCount" className="text-muted-foreground">Current follower count</Label>
              <Input
                id="followerCount"
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="e.g. 2.5k"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="podPlatform" className="text-muted-foreground">POD platform</Label>
              <select
                id="podPlatform"
                value={podPlatform}
                onChange={(e) => setPodPlatform(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Printify">Printify</option>
                <option value="Printful">Printful</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPlatform" className="text-muted-foreground">Selling platform</Label>
              <select
                id="sellingPlatform"
                value={sellingPlatform}
                onChange={(e) => setSellingPlatform(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Shopify">Shopify</option>
                <option value="Etsy">Etsy</option>
                <option value="Both">Both</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage" className="text-muted-foreground">Current stage</Label>
              <select
                id="stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="idea">Idea</option>
                <option value="designing">Designing</option>
                <option value="store setup">Store setup</option>
                <option value="ready to launch">Ready to launch</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            <Button onClick={handleGenerateRoadmap} disabled={roadmapGenerating}>
              {roadmapGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Generate My Roadmap
            </Button>
            <Button variant="outline" onClick={handleLoadSavedRoadmap} className="border-white/10">
              Load saved
            </Button>
          </div>

          {roadmap && (
            <div className="space-y-6">
              {roadmap.milestone_to_launch && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Milestone to launch</p>
                  <p className="text-foreground">{roadmap.milestone_to_launch}</p>
                </div>
              )}

              {roadmap.checklist.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Checklist</p>
                  {roadmap.checklist.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-medium text-foreground">{phase.phase || `Phase ${phaseIndex + 1}`}</span>
                        {phase.estimated_time && (
                          <span className="text-xs text-muted-foreground">{phase.estimated_time}</span>
                        )}
                      </div>
                      <ul className="space-y-2 pl-1">
                        {(phase.tasks ?? []).map((task, taskIndex) => {
                          const key = taskKey(phaseIndex, taskIndex);
                          const checked = completedTasks.has(key);
                          return (
                            <li key={taskIndex} className="flex items-start gap-3 text-sm">
                              <Checkbox
                                id={key}
                                checked={checked}
                                onCheckedChange={() => handleToggleTask(phaseIndex, taskIndex)}
                                className="mt-0.5 border-white/20 data-[state=checked]:bg-primary"
                              />
                              <label
                                htmlFor={key}
                                className={`flex-1 cursor-pointer select-none ${checked ? "text-muted-foreground line-through" : "text-foreground"}`}
                              >
                                {task}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleSaveRoadmap} disabled={roadmapSaving} className="border-white/10 mt-2">
                    {roadmapSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save progress
                  </Button>
                </div>
              )}

              {(roadmap.waitlist_email?.subject != null || roadmap.waitlist_email?.body) && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Waitlist email</p>
                    <Button variant="outline" size="sm" onClick={handleCopyWaitlistEmail} className="border-white/10">
                      {waitlistEmailCopied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      Copy Waitlist Email
                    </Button>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Subject: {roadmap.waitlist_email.subject || "—"}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{roadmap.waitlist_email.body || "—"}</p>
                </div>
              )}

              {roadmap.first_drop_pricing && (roadmap.first_drop_pricing.suggested_products?.length || roadmap.first_drop_pricing.pricing_notes) && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">First drop pricing</p>
                  {roadmap.first_drop_pricing.suggested_products?.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-foreground mb-2">
                      {roadmap.first_drop_pricing.suggested_products.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {roadmap.first_drop_pricing.pricing_notes && (
                    <p className="text-sm text-foreground">{roadmap.first_drop_pricing.pricing_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
