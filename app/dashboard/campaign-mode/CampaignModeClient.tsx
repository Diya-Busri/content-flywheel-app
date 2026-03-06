"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Video, LayoutGrid, Plus, RefreshCw, Copy, Mic, Film, LayoutTemplate, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { setVideoPrefill } from "@/lib/video-prefill";
import { setTemplateStudioPrefill } from "@/lib/template-studio-prefill";

const STORAGE_KEY = "campaign_access";

type Workspace = {
  id: string;
  brandName: string;
  brandType: string;
  aestheticVibe?: string;
  niche?: string;
  targetAudience?: string;
  platform?: string;
  colourPrimary?: string;
  colourSecondary?: string;
  createdAt?: string;
};

type Campaign = {
  id: string;
  workspaceId: string;
  contentType: string;
  postConcept?: string;
  title?: string;
  status: string;
  scheduledDate?: string;
  createdAt?: string;
};

const AESTHETIC_OPTIONS = [
  "Dark & Minimal",
  "Streetwear",
  "Clean & Neutral",
  "Bold",
];

const GOAL_OPTIONS = [
  "Tease product",
  "Build community",
  "Drive to store",
  "Announce drop",
  "General brand content",
];

type ConceptResult = {
  concept: string;
  angle: string;
  hook: string;
  format_confirmed: string;
};

type VideoScene = {
  scene_number: number;
  duration_seconds: number;
  visual: string;
  text_overlay: string;
  overlay_timing: string;
  voiceover_line: string;
};

type VideoScriptResult = {
  full_script: string;
  voiceover_text: string;
  scenes: VideoScene[];
  suggested_music: string;
  total_duration: string;
};

type CarouselSlideResult = {
  slide_number: number;
  type: string;
  heading: string;
  body: string;
  design_note: string;
};

type CarouselSlidesResult = {
  slides: CarouselSlideResult[];
  slide_count: number;
};

type CaptionSeoResult = {
  title: string;
  description: string;
  caption: string;
  hashtags: string;
  alt_text: string;
  best_time_to_post: string;
};

export default function CampaignModeClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [brandType, setBrandType] = useState("Clothing");
  const [aestheticVibe, setAestheticVibe] = useState("Dark & Minimal");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [platform, setPlatform] = useState("TikTok");
  const [colourPrimary, setColourPrimary] = useState("#000000");
  const [colourSecondary, setColourSecondary] = useState("#ffffff");
  const [creating, setCreating] = useState(false);

  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [goal, setGoal] = useState("Tease product");
  const [specificIdea, setSpecificIdea] = useState("");
  const [format, setFormat] = useState<"video" | "carousel">("video");
  const [conceptGenerating, setConceptGenerating] = useState(false);
  const [conceptResult, setConceptResult] = useState<ConceptResult | null>(null);

  const [campaignStep, setCampaignStep] = useState<1 | 2 | 3>(1);
  const [videoScriptLoading, setVideoScriptLoading] = useState(false);
  const [videoScriptResult, setVideoScriptResult] = useState<VideoScriptResult | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [chipCopiedScene, setChipCopiedScene] = useState<number | null>(null);

  const [carouselSlidesLoading, setCarouselSlidesLoading] = useState(false);
  const [carouselSlidesResult, setCarouselSlidesResult] = useState<CarouselSlidesResult | null>(null);

  const [captionSeoLoading, setCaptionSeoLoading] = useState(false);
  const [captionSeoResult, setCaptionSeoResult] = useState<CaptionSeoResult | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [copyField, setCopyField] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const hasAccess = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) === "1" : false;
      setUnlocked(!!hasAccess);
    } catch {
      setUnlocked(false);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    setWorkspacesLoading(true);
    fetch("/api/campaign-mode/workspaces")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkspaces(data);
          if (data.length > 0) setWorkspace(data[0]);
        }
      })
      .catch(() => toast({ title: "Failed to load workspaces", variant: "destructive" }))
      .finally(() => setWorkspacesLoading(false));
  }, [unlocked, toast]);

  useEffect(() => {
    if (!workspace?.id) return;
    setCampaignsLoading(true);
    fetch(`/api/campaign-mode/campaigns?workspaceId=${workspace.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCampaigns(data);
        else setCampaigns([]);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [workspace?.id]);

  const handleGenerateConcept = async () => {
    if (!workspace) return;
    setConceptGenerating(true);
    setConceptResult(null);
    try {
      const res = await fetch("/api/campaign-mode/concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: workspace.brandName,
          brandType: workspace.brandType,
          aestheticVibe: workspace.aestheticVibe ?? "",
          niche: workspace.niche ?? "",
          targetAudience: workspace.targetAudience ?? "",
          goal,
          specificIdea: specificIdea.trim() || undefined,
          format,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.concept != null) {
        setConceptResult({
          concept: data.concept ?? "",
          angle: data.angle ?? "",
          hook: data.hook ?? "",
          format_confirmed: data.format_confirmed ?? format,
        });
      } else {
        toast({ title: "Generation failed", description: data?.error ?? "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setConceptGenerating(false);
    }
  };

  const openNewCampaign = () => {
    setConceptResult(null);
    setVideoScriptResult(null);
    setCarouselSlidesResult(null);
    setCaptionSeoResult(null);
    setScheduleDate("");
    setCampaignStep(1);
    setNewCampaignOpen(true);
  };

  const handleConfirmConcept = async () => {
    if (!conceptResult || !workspace) return;
    const isVideo = conceptResult.format_confirmed === "video" || format === "video";
    const isCarousel = conceptResult.format_confirmed === "carousel" || format === "carousel";

    if (isVideo) {
      setVideoScriptLoading(true);
      setVideoScriptResult(null);
      setCarouselSlidesResult(null);
      try {
        const res = await fetch("/api/campaign-mode/video-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: workspace.brandName,
          vibe: workspace.aestheticVibe ?? "",
          concept: conceptResult.concept,
          hook: conceptResult.hook,
          platform: workspace.platform ?? "TikTok",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.full_script != null) {
        setVideoScriptResult({
          full_script: data.full_script ?? "",
          voiceover_text: data.voiceover_text ?? data.full_script ?? "",
          scenes: Array.isArray(data.scenes) ? data.scenes : [],
          suggested_music: data.suggested_music ?? "",
          total_duration: data.total_duration ?? "",
        });
        setCampaignStep(2);
      } else {
        toast({ title: "Script generation failed", description: data?.error ?? "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setVideoScriptLoading(false);
    }
    return;
    }

    if (isCarousel) {
      setCarouselSlidesLoading(true);
      setCarouselSlidesResult(null);
      setVideoScriptResult(null);
      try {
        const res = await fetch("/api/campaign-mode/carousel-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandName: workspace.brandName,
            vibe: workspace.aestheticVibe ?? "",
            concept: conceptResult.concept,
            colourPrimary: workspace.colourPrimary ?? "#000000",
            platform: workspace.platform ?? "Instagram",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data.slides)) {
          setCarouselSlidesResult({
            slides: data.slides,
            slide_count: typeof data.slide_count === "number" ? data.slide_count : data.slides.length,
          });
          setCampaignStep(2);
        } else {
          toast({ title: "Carousel generation failed", description: data?.error ?? "Try again.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Request failed", variant: "destructive" });
      } finally {
        setCarouselSlidesLoading(false);
      }
    } else {
      toast({ title: "Use this concept in the next step (coming soon)" });
    }
  };

  const handleCopyFullScript = async () => {
    if (!videoScriptResult?.full_script) return;
    try {
      await navigator.clipboard.writeText(videoScriptResult.full_script);
      setScriptCopied(true);
      toast({ title: "Script copied" });
      setTimeout(() => setScriptCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSendToVoiceover = () => {
    if (!videoScriptResult?.voiceover_text) return;
    setVideoPrefill({
      voiceoverText: videoScriptResult.voiceover_text,
      title: conceptResult?.concept?.slice(0, 80) ?? "Campaign script",
      source: "campaign-mode",
    });
    router.push("/dashboard/video-timeline");
    setNewCampaignOpen(false);
    toast({ title: "Opening Video Timeline with script" });
  };

  const handleSendToTimeline = () => {
    if (!videoScriptResult) return;
    setVideoPrefill({
      voiceoverText: videoScriptResult.voiceover_text,
      timelineScenes: videoScriptResult.scenes.map((s) => ({
        scene_number: s.scene_number,
        duration_seconds: s.duration_seconds,
        visual: s.visual,
        text_overlay: s.text_overlay,
        overlay_timing: s.overlay_timing,
        voiceover_line: s.voiceover_line,
      })),
      title: conceptResult?.concept?.slice(0, 80) ?? "Campaign script",
      source: "campaign-mode",
    });
    router.push("/dashboard/video-timeline");
    setNewCampaignOpen(false);
    toast({ title: "Opening Video Timeline with scenes" });
  };

  const handleCopyChip = async (sceneIndex: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setChipCopiedScene(sceneIndex);
      toast({ title: "Copied" });
      setTimeout(() => setChipCopiedScene(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleSendToTemplateStudio = () => {
    if (!carouselSlidesResult || !workspace) return;
    setTemplateStudioPrefill({
      slides: carouselSlidesResult.slides.map((s) => ({
        heading: s.heading,
        body: s.body,
        bg_color: workspace.colourPrimary ?? undefined,
      })),
      brandPrimary: workspace.colourPrimary ?? undefined,
      brandSecondary: workspace.colourSecondary ?? undefined,
    });
    router.push("/dashboard/template-studio");
    setNewCampaignOpen(false);
    toast({ title: "Opening Template Studio with slides" });
  };

  const handleCaptionSeo = async () => {
    if (!workspace || !conceptResult) return;
    setCaptionSeoLoading(true);
    setCaptionSeoResult(null);
    try {
      const res = await fetch("/api/campaign-mode/caption-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: workspace.brandName,
          niche: workspace.niche ?? "",
          concept: conceptResult.concept,
          platform: workspace.platform ?? "TikTok",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.title != null || data.caption != null)) {
        setCaptionSeoResult({
          title: data.title ?? "",
          description: data.description ?? "",
          caption: data.caption ?? "",
          hashtags: data.hashtags ?? "",
          alt_text: data.alt_text ?? "",
          best_time_to_post: data.best_time_to_post ?? "",
        });
        setCampaignStep(3);
      } else {
        toast({ title: "Caption & SEO failed", description: data?.error ?? "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setCaptionSeoLoading(false);
    }
  };

  const buildCampaignPayload = (opts: { scheduledDate?: string; status: "ready" | "draft" }) => {
    if (!workspace || !conceptResult) return null;
    const isVideo = !!videoScriptResult;
    const isCarousel = !!carouselSlidesResult;
    const contentType = isVideo ? "video" : "carousel";
    const payload: Record<string, unknown> = {
      workspaceId: workspace.id,
      contentType,
      postConcept: conceptResult.concept,
      caption: captionSeoResult?.caption ?? null,
      hashtags: captionSeoResult?.hashtags ?? null,
      title: captionSeoResult?.title ?? null,
      description: captionSeoResult?.description ?? null,
      status: opts.status,
    };
    if (opts.scheduledDate) payload.scheduledDate = opts.scheduledDate;
    if (isVideo && videoScriptResult) {
      payload.scriptJson = { full_script: videoScriptResult.full_script, scenes: videoScriptResult.scenes };
      payload.voiceoverText = videoScriptResult.voiceover_text;
      payload.timelineJson = videoScriptResult.scenes;
    }
    if (isCarousel && carouselSlidesResult) {
      payload.carouselJson = carouselSlidesResult.slides;
    }
    return payload;
  };

  const handleSaveCampaign = async () => {
    const payload = buildCampaignPayload({ status: "ready" });
    if (!payload) return;
    setSavingCampaign(true);
    try {
      const res = await fetch("/api/campaign-mode/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        toast({ title: "Campaign saved as ready" });
        setCampaigns((prev) => [
          {
            id: data.id,
            workspaceId: data.workspaceId,
            contentType: data.contentType,
            postConcept: data.postConcept,
            title: data.title,
            status: data.status,
            scheduledDate: data.scheduledDate,
            createdAt: data.createdAt,
          },
          ...prev,
        ]);
        setNewCampaignOpen(false);
      } else {
        toast({ title: "Save failed", description: data?.error ?? "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleSchedulePost = async () => {
    const dateStr = scheduleDate.trim();
    if (!dateStr) {
      toast({ title: "Pick a date and time", variant: "destructive" });
      return;
    }
    const payload = buildCampaignPayload({ status: "ready", scheduledDate: dateStr });
    if (!payload) return;
    setSavingCampaign(true);
    try {
      const res = await fetch("/api/campaign-mode/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        toast({ title: "Post scheduled and added to content calendar" });
        setCampaigns((prev) => [
          {
            id: data.id,
            workspaceId: data.workspaceId,
            contentType: data.contentType,
            postConcept: data.postConcept,
            title: data.title,
            status: data.status,
            scheduledDate: data.scheduledDate,
            createdAt: data.createdAt,
          },
          ...prev,
        ]);
        setNewCampaignOpen(false);
      } else {
        toast({ title: "Schedule failed", description: data?.error ?? "Try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleCopyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyField(field);
      toast({ title: "Copied" });
      setTimeout(() => setCopyField(null), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/campaign-mode/verify", {
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
        setError(data?.error || "Incorrect password.");
      }
    } catch {
      setError("Verification failed. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) {
      toast({ title: "Enter a brand name", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/campaign-mode/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName.trim(),
          brandType,
          aestheticVibe,
          niche: niche.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          platform,
          colourPrimary,
          colourSecondary,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        toast({ title: "Workspace created" });
        const listRes = await fetch("/api/campaign-mode/workspaces");
        const list = await listRes.json();
        if (Array.isArray(list)) {
          setWorkspaces(list);
          const newWs = list.find((w: Workspace) => w.id === data.id) ?? list[0];
          setWorkspace(newWs);
        }
      } else {
        const msg = (data && typeof data.error === "string" && data.error.trim()) || "Something went wrong. Check the server console.";
        toast({ title: "Failed to create workspace", description: msg, variant: "destructive" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed.";
      toast({ title: "Failed to create workspace", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-card/90 p-8 shadow-xl backdrop-blur dark:bg-zinc-900/95">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-white/10 p-4">
              <Lock className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-center text-foreground mb-2">Campaign Mode</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">This feature is in private beta.</p>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={verifying}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (workspacesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Create your Brand Workspace</h1>
        <p className="text-muted-foreground mb-8">Set up your first workspace to start planning campaigns.</p>
        <form onSubmit={handleCreateWorkspace} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Your brand"
              className="bg-white/5 border-white/10"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brandType">Brand type</Label>
            <select
              id="brandType"
              value={brandType}
              onChange={(e) => setBrandType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Clothing">Clothing</option>
              <option value="Digital Products">Digital Products</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="aestheticVibe">Aesthetic vibe</Label>
            <select
              id="aestheticVibe"
              value={aestheticVibe}
              onChange={(e) => setAestheticVibe(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {AESTHETIC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="niche">Niche</Label>
            <Input
              id="niche"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. sustainable streetwear"
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target audience</Label>
            <Input
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. Gen Z, eco-conscious"
              className="bg-white/5 border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">Primary platform</Label>
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="TikTok">TikTok</option>
              <option value="Instagram">Instagram</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colourPrimary}
                  onChange={(e) => setColourPrimary(e.target.value)}
                  className="h-10 w-14 rounded border border-white/10 cursor-pointer bg-white/5"
                />
                <Input
                  value={colourPrimary}
                  onChange={(e) => setColourPrimary(e.target.value)}
                  className="bg-white/5 border-white/10 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colourSecondary}
                  onChange={(e) => setColourSecondary(e.target.value)}
                  className="h-10 w-14 rounded border border-white/10 cursor-pointer bg-white/5"
                />
                <Input
                  value={colourSecondary}
                  onChange={(e) => setColourSecondary(e.target.value)}
                  className="bg-white/5 border-white/10 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Workspace
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Campaign Mode</h1>
          <p className="text-muted-foreground">
            Workspace: <span className="font-medium text-foreground">{workspace?.brandName}</span>
          </p>
        </div>
        <Button onClick={openNewCampaign}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">Campaigns</h2>
      {campaignsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
          No campaigns yet. Create your first campaign to see it here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                {c.contentType === "video" ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs font-medium uppercase text-muted-foreground">{c.contentType}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-white/10 text-foreground">{c.status}</span>
              </div>
              <p className="text-sm font-medium text-foreground line-clamp-1">
                {c.title || c.postConcept || "Untitled"}
              </p>
              {c.createdAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen}>
        <DialogContent className="max-w-3xl border-white/10 bg-card text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Campaign — Step 1: Content Direction</DialogTitle>
            <DialogDescription>Set the goal and format, then generate a concept.</DialogDescription>
          </DialogHeader>

          {workspace && (
            <div className="space-y-6">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Brand (from workspace)</p>
                <p className="text-foreground font-medium">{workspace.brandName}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {workspace.aestheticVibe ?? "—"} · {workspace.niche ?? "—"} · {workspace.targetAudience ?? "—"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>What&apos;s the goal of this post?</Label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {GOAL_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Any specific idea? (optional)</Label>
                <Input
                  value={specificIdea}
                  onChange={(e) => setSpecificIdea(e.target.value)}
                  placeholder="Leave blank for AI to decide"
                  className="bg-white/5 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="video"
                      checked={format === "video"}
                      onChange={() => setFormat("video")}
                      className="rounded-full border-white/20"
                    />
                    <span className="text-sm">Video</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value="carousel"
                      checked={format === "carousel"}
                      onChange={() => setFormat("carousel")}
                      className="rounded-full border-white/20"
                    />
                    <span className="text-sm">Carousel</span>
                  </label>
                </div>
              </div>

              {!conceptResult ? (
                <Button onClick={handleGenerateConcept} disabled={conceptGenerating} className="w-full">
                  {conceptGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Generate Concept
                </Button>
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated concept</p>
                  <p className="text-foreground font-medium">{conceptResult.concept}</p>
                  {conceptResult.angle && (
                    <p className="text-sm text-muted-foreground">{conceptResult.angle}</p>
                  )}
                  {conceptResult.hook && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Hook (first 3s)</p>
                      <p className="text-sm text-foreground">&ldquo;{conceptResult.hook}&rdquo;</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Format: {conceptResult.format_confirmed}</p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleConfirmConcept} disabled={videoScriptLoading || carouselSlidesLoading}>
                      {(videoScriptLoading || carouselSlidesLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Use This
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleGenerateConcept} disabled={conceptGenerating} className="border-white/10">
                      {conceptGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}

              {campaignStep === 2 && videoScriptResult && (
                <div className="space-y-6 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Step 2: Video</p>
                    <Button variant="ghost" size="sm" onClick={() => { setCampaignStep(1); setVideoScriptResult(null); }} className="text-muted-foreground">
                      Back
                    </Button>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full script</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCopyFullScript} className="border-white/10 h-8">
                          {scriptCopied ? "Copied" : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" onClick={handleSendToVoiceover} className="h-8">
                          <Mic className="h-3.5 w-3.5 mr-1" />
                          Send to Voiceover
                        </Button>
                      </div>
                    </div>
                    <textarea
                      readOnly
                      value={videoScriptResult.full_script}
                      rows={6}
                      className="w-full resize-none rounded bg-black/20 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none"
                    />
                  </div>

                  {videoScriptResult.suggested_music && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Suggested music:</span> {videoScriptResult.suggested_music}</p>
                  )}
                  {videoScriptResult.total_duration && (
                    <p className="text-xs text-muted-foreground"><span className="font-medium">Est. duration:</span> {videoScriptResult.total_duration}</p>
                  )}

                  {videoScriptResult.scenes.length > 0 && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timeline breakdown</Label>
                        <div className="rounded border border-white/10 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-white/5 border-b border-white/10">
                                <th className="text-left p-2 font-medium">#</th>
                                <th className="text-left p-2 font-medium">Duration</th>
                                <th className="text-left p-2 font-medium">Visual</th>
                                <th className="text-left p-2 font-medium">Text overlay</th>
                                <th className="text-left p-2 font-medium">Timing</th>
                                <th className="text-left p-2 font-medium">Voiceover</th>
                              </tr>
                            </thead>
                            <tbody>
                              {videoScriptResult.scenes.map((s) => (
                                <tr key={s.scene_number} className="border-b border-white/5">
                                  <td className="p-2">{s.scene_number}</td>
                                  <td className="p-2">{s.duration_seconds}s</td>
                                  <td className="p-2">{s.visual}</td>
                                  <td className="p-2">{s.text_overlay}</td>
                                  <td className="p-2">{s.overlay_timing}</td>
                                  <td className="p-2 text-muted-foreground max-w-[200px] truncate" title={s.voiceover_line}>{s.voiceover_line}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Stock footage keywords:</span>
                        {videoScriptResult.scenes.map((s, i) => (
                          <button
                            key={s.scene_number}
                            type="button"
                            onClick={() => handleCopyChip(i, s.visual)}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground hover:bg-white/10 transition-colors"
                          >
                            {chipCopiedScene === i ? "Copied" : <Copy className="h-3 w-3" />}
                            <span>Scene {s.scene_number}</span>
                          </button>
                        ))}
                      </div>

                      <Button size="sm" onClick={handleSendToTimeline} className="border-white/10">
                        <Film className="h-4 w-4 mr-2" />
                        Send to Video Timeline
                      </Button>
                    </>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleCaptionSeo} disabled={captionSeoLoading}>
                      {captionSeoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Next: Caption & SEO
                    </Button>
                  </div>
                </div>
              )}

              {campaignStep === 2 && carouselSlidesResult && (
                <div className="space-y-6 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Step 2: Carousel</p>
                    <Button variant="ghost" size="sm" onClick={() => { setCampaignStep(1); setCarouselSlidesResult(null); }} className="text-muted-foreground">
                      Back
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{carouselSlidesResult.slide_count} slides</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {carouselSlidesResult.slides.map((s) => (
                      <div
                        key={s.slide_number}
                        className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Slide {s.slide_number}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10 capitalize">{s.type}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{s.heading}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{s.body}</p>
                        {s.design_note && (
                          <p className="text-xs text-muted-foreground/80 italic">{s.design_note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={handleSendToTemplateStudio} className="border-white/10">
                    <LayoutTemplate className="h-4 w-4 mr-2" />
                    Send to Template Studio
                  </Button>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleCaptionSeo} disabled={captionSeoLoading}>
                      {captionSeoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Next: Caption & SEO
                    </Button>
                  </div>
                </div>
              )}

              {campaignStep === 3 && captionSeoResult && (
                <div className="space-y-6 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Step 3: Caption & SEO</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCampaignStep(2); setCaptionSeoResult(null); }}
                      className="text-muted-foreground"
                    >
                      Back
                    </Button>
                  </div>

                  {[
                    { key: "title", label: "Title (max 60 chars)", value: captionSeoResult.title },
                    { key: "description", label: "SEO description (150 chars)", value: captionSeoResult.description },
                    { key: "caption", label: "Caption (with CTA)", value: captionSeoResult.caption },
                    { key: "hashtags", label: "Hashtags", value: captionSeoResult.hashtags },
                    { key: "alt_text", label: "Alt text (accessibility)", value: captionSeoResult.alt_text },
                    { key: "best_time_to_post", label: "Best time to post", value: captionSeoResult.best_time_to_post },
                  ].map(({ key, label, value }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
                      <div className="flex gap-2 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                        <textarea
                          readOnly
                          value={value}
                          rows={key === "caption" ? 4 : key === "hashtags" ? 2 : 1}
                          className="flex-1 min-w-0 resize-none border-0 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-0"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="shrink-0 h-8"
                          onClick={() => handleCopyField(key, value)}
                        >
                          {copyField === key ? "Copied" : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap items-center gap-3 pt-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="schedule-date" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        Schedule date & time
                      </Label>
                      <input
                        id="schedule-date"
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="flex h-9 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <Button size="sm" onClick={handleSchedulePost} disabled={savingCampaign}>
                      {savingCampaign ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
                      Schedule Post
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleSaveCampaign} disabled={savingCampaign}>
                      {savingCampaign ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Save Campaign
                    </Button>
                  </div>
                  {captionSeoResult.best_time_to_post && (
                    <p className="text-xs text-muted-foreground">
                      Suggestion: {captionSeoResult.best_time_to_post}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
