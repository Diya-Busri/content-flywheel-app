"use client";

import { useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import {
  Step1AboutYou,
  Step2ContentStyle,
  Step3PickNiche,
  Step4PickTopic,
  Step5RedirectToScripts,
  Step6Timeline,
  Step7Publish,
  type WizardData,
} from "@/components/content-studio";
import { useContentStudio } from "./ContentStudioContext";

const STEP_TITLES: Record<number, string> = {
  1: "About You",
  2: "Content Style",
  3: "Pick Niche",
  4: "Pick Trending Topic",
  5: "Scripts",
  6: "Video Timeline",
  7: "Publish & Track",
};

const TOTAL_STEPS = 7;

function getStepFromParams(searchParams: ReturnType<typeof useSearchParams>): number {
  const step = searchParams.get("step");
  const n = step ? parseInt(step, 10) : NaN;
  if (Number.isInteger(n) && n >= 1 && n <= TOTAL_STEPS) return n;
  return 1;
}

export default function CreateWizardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepFromUrl = getStepFromParams(searchParams);
  const { wizardData: contextWizardData, updateWizardData, loading } = useContentStudio();

  const wizardData: WizardData = useMemo(
    () => ({ ...contextWizardData, current_step: stepFromUrl }),
    [contextWizardData, stepFromUrl]
  );

  const currentStep = stepFromUrl;

  useEffect(() => {
    const hasStepInUrl = searchParams.get("step");
    const savedStep = contextWizardData.current_step ?? 1;
    if (!hasStepInUrl && savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      router.replace(`/dashboard/content-studio/create?step=${savedStep}`);
    }
  }, [contextWizardData.current_step, router, searchParams]);

  const nextStep = useCallback(
    async (overrides?: Partial<WizardData>) => {
      const next = Math.min(currentStep + 1, TOTAL_STEPS);
      await updateWizardData({
        current_step: next,
        ...(overrides?.topics !== undefined && { topics: overrides.topics }),
        ...(overrides?.selected_niche !== undefined && { selected_niche: overrides.selected_niche }),
        ...(overrides?.content_style !== undefined && { content_style: overrides.content_style }),
        ...(overrides?.selected_topic !== undefined && { selected_topic: overrides.selected_topic }),
        ...(overrides?.script_strategy !== undefined && { script_strategy: overrides.script_strategy }),
      });
      router.push(`/dashboard/content-studio/create?step=${next}`);
    },
    [currentStep, router, updateWizardData]
  );

  const prevStep = useCallback(() => {
    const prev = Math.max(currentStep - 1, 1);
    router.push(`/dashboard/content-studio/create?step=${prev}`);
  }, [currentStep, router]);

  const startOver = useCallback(async () => {
    await updateWizardData({ current_step: 1 });
    router.push("/dashboard/content-studio/create?step=1");
  }, [router, updateWizardData]);

  const renderStep = () => {
    const shared = {
      wizardData,
      onNext: nextStep,
      onBack: prevStep,
    };
    switch (currentStep) {
      case 1:
        return <Step1AboutYou {...shared} />;
      case 2:
        return <Step2ContentStyle {...shared} />;
      case 3:
        return <Step3PickNiche {...shared} />;
      case 4:
        return <Step4PickTopic {...shared} />;
      case 5:
        return <Step5RedirectToScripts {...shared} />;
      case 6:
        return <Step6Timeline {...shared} />;
      case 7:
        return <Step7Publish {...shared} />;
      default:
        return <Step1AboutYou {...shared} />;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-6 md:p-10">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        {/* Top bar: Back to Content Studio (left) | Start over (right) */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/content-studio"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Content Studio
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="text-sm text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 font-medium"
          >
            Start over
          </button>
        </div>

        {/* Breadcrumb: Dashboard > Content Studio > Create */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#A0A0A0] mb-8">
          <Link href="/dashboard" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <Link href="/dashboard/content-studio" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Content Studio
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-[#666]" />
          <span className="text-gray-900 dark:text-white">Create</span>
        </nav>

        {/* Progress bar: Step X of 7 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {STEP_TITLES[currentStep]}
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 sm:p-8 min-h-[400px]">
          {renderStep()}
        </div>
      </div>
    </main>
  );
}
