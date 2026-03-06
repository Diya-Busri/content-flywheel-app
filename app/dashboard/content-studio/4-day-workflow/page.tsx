"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const STEP_TITLES: Record<number, string> = {
  1: "Find Your Niche",
  2: "Generate Video Topics",
  3: "Analyze Trends",
  4: "Generate Script",
  5: "Scene Breakdown",
  6: "Build on Timeline",
  7: "Optimize Metadata",
  8: "Publish",
};

type WorkflowData = {
  currentStep: number;
  hasNiche: boolean;
  niche: string | null;
  nicheDescription: string;
  topic: string | null;
  topicIdea: Record<string, unknown>;
  trends: unknown[];
  script: { hook: string; body: string; cta: string };
  scriptLength: string;
  voiceoverUrl: string | null;
  scenes: unknown[];
  sceneAssets: unknown[];
  title: string;
  description: string;
  hashtags: string[];
  keywords: string[];
  thumbnail: string | null;
  publishTo: { youtube: boolean; tiktok: boolean; instagram: boolean };
};

const initialWorkflowData: WorkflowData = {
  currentStep: 1,
  hasNiche: false,
  niche: null,
  nicheDescription: "",
  topic: null,
  topicIdea: {},
  trends: [],
  script: { hook: "", body: "", cta: "" },
  scriptLength: "30s",
  voiceoverUrl: null,
  scenes: [],
  sceneAssets: [],
  title: "",
  description: "",
  hashtags: [],
  keywords: [],
  thumbnail: null,
  publishTo: { youtube: false, tiktok: false, instagram: false },
};

// Placeholder step components
function StepNicheResearch() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Find Your Niche</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 1 content coming soon...</p>
    </div>
  );
}

function StepTopicGeneration() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Generate Video Topics</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 2 content coming soon...</p>
    </div>
  );
}

function StepTrendAnalysis() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Analyze Trends</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 3 content coming soon...</p>
    </div>
  );
}

function StepScriptGeneration() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Generate Script with Voiceover</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 4 content coming soon...</p>
    </div>
  );
}

function StepSceneBreakdown() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Scene Breakdown & Visual Prompts</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 5 content coming soon...</p>
    </div>
  );
}

function StepTimeline() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Build on Timeline</h2>
      <p className="text-gray-600 dark:text-gray-400">Redirecting to Video Timeline to build your video...</p>
    </div>
  );
}

function StepMetadata() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Generate Metadata</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 7 content coming soon...</p>
    </div>
  );
}

function StepPublish() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Publish to Platforms</h2>
      <p className="text-gray-600 dark:text-gray-400">Step 8 content coming soon...</p>
    </div>
  );
}

export default function FourDayWorkflowPage() {
  const router = useRouter();
  const [workflowData, setWorkflowData] = useState<WorkflowData>(() => ({ ...initialWorkflowData }));
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const validateStep = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 1:
          return workflowData.hasNiche || workflowData.niche !== null;
        case 2:
          return workflowData.topic !== null;
        case 3:
          return true;
        case 4:
          return Boolean(workflowData.script.hook && workflowData.voiceoverUrl);
        case 5:
          return workflowData.scenes.length > 0;
        case 6:
          return true;
        case 7:
          return Boolean(workflowData.title && workflowData.description);
        case 8:
          return Object.values(workflowData.publishTo).some((v) => v === true);
        default:
          return true;
      }
    },
    [workflowData]
  );

  const saveProgress = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/workflow-progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowData: { ...workflowData, currentStep },
          currentStep,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err) {
      console.error("Save progress:", err);
    } finally {
      setSaving(false);
    }
  }, [workflowData, currentStep]);

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow-progress");
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      const data = json.data;

      if (data?.workflowData && data?.currentStep != null) {
        const resume = window.confirm("You have a workflow in progress. Resume where you left off?");
        if (resume) {
          setWorkflowData((prev) => ({ ...initialWorkflowData, ...data.workflowData }));
          setCurrentStep(Math.min(Math.max(1, data.currentStep), 8));
        }
      } else {
        const hasNiche = window.confirm("Do you already know what niche you want to create content in?");
        setWorkflowData((prev) => ({ ...prev, hasNiche }));
        setCurrentStep(hasNiche ? 2 : 1);
      }
    } catch (err) {
      console.error("Load progress:", err);
      const hasNiche = window.confirm("Do you already know what niche you want to create content in?");
      setWorkflowData((prev) => ({ ...prev, hasNiche }));
      setCurrentStep(hasNiche ? 2 : 1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const nextStep = useCallback(() => {
    if (!validateStep(currentStep)) {
      alert("Please complete this step before continuing");
      return;
    }

    saveProgress();

    if (currentStep === 1 && workflowData.hasNiche) {
      setCurrentStep(2);
    } else if (currentStep === 6) {
      router.push("/dashboard/video-timeline");
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, 8));
    }
  }, [currentStep, workflowData.hasNiche, validateStep, saveProgress, router]);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const saveAndExit = useCallback(async () => {
    await saveProgress();
    router.push("/dashboard");
  }, [saveProgress, router]);

  const skipToTimeline = useCallback(() => {
    router.push("/dashboard/video-timeline");
  }, [router]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <StepNicheResearch />;
      case 2:
        return <StepTopicGeneration />;
      case 3:
        return <StepTrendAnalysis />;
      case 4:
        return <StepScriptGeneration />;
      case 5:
        return <StepSceneBreakdown />;
      case 6:
        return <StepTimeline />;
      case 7:
        return <StepMetadata />;
      case 8:
        return <StepPublish />;
      default:
        return <StepNicheResearch />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <p className="text-gray-600 dark:text-gray-400">Loading workflow...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <Link
        href="/dashboard/content-studio"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Content Studio
      </Link>
      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Step {currentStep} of 8
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {STEP_TITLES[currentStep]}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 8) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Content Card */}
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 min-h-[500px]">
        {renderCurrentStep()}
      </div>

      {/* Navigation Footer */}
      <div className="max-w-4xl mx-auto mt-6 flex justify-between items-center flex-wrap gap-4">
        <button
          type="button"
          onClick={previousStep}
          disabled={currentStep === 1}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
        >
          ← Back
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveAndExit}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            {saving ? "Saving…" : "💾 Save & Exit"}
          </button>
          <button
            type="button"
            onClick={skipToTimeline}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            ⚡ Skip to Timeline
          </button>
        </div>

        <button
          type="button"
          onClick={nextStep}
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
