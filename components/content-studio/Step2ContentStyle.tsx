"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Bot, Video, ArrowRight } from "lucide-react";
import type { WizardData } from "./Step1AboutYou";
import { useContentStudio } from "@/app/dashboard/content-studio/create/ContentStudioContext";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

type ContentStyleId = "faceless" | "ai-generated" | "personal-brand";

const CONTENT_STYLES: Array<{
  id: ContentStyleId;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  bestFor: string;
  videoStyles: string;
  bullets: string[];
  examples?: string;
  buttonLabel: string;
}> = [
  {
    id: "faceless",
    icon: User,
    title: "Faceless Content",
    bestFor: "Privacy & anonymity, testing multiple niches, scalable content production",
    videoStyles: "Text overlays on B-roll, screen recordings, animations & graphics",
    bullets: [
      "Value privacy and don't want to show your face",
      "Want to test multiple content ideas quickly",
      "Plan to hire editors/scale production",
      "Prefer animation or stock footage style",
    ],
    buttonLabel: "Select Faceless",
  },
  {
    id: "ai-generated",
    icon: Bot,
    title: "AI-Generated Videos",
    badge: "🔥 Trending",
    bestFor: "Fully automated content, viral AI avatars, zero editing skills needed",
    videoStyles: "AI talking avatars, AI voiceovers, AI-generated B-roll & animations",
    bullets: [
      "Want to create videos without filming or editing",
      "Love viral AI avatar content (HeyGen, D-ID style)",
      "Need to scale to 10+ videos/week with minimal work",
      "Prefer script-to-video automation",
    ],
    buttonLabel: "Select AI-Generated",
  },
  {
    id: "personal-brand",
    icon: Video,
    title: "Personal Brand",
    bestFor: "Building authority, long-term brand growth, trust & connection",
    videoStyles: "Talking head (you on camera), behind-the-scenes, story-driven content",
    bullets: [
      "Want to build a recognizable personal brand",
      "Comfortable being on camera",
      "Value deep audience connection",
      "Building long-term trust and authority",
    ],
    buttonLabel: "Select Personal Brand",
  },
];

const CARD_BASE =
  "rounded-xl border-2 transition-all text-left cursor-pointer " +
  "border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] " +
  "hover:border-orange-500/50 ";
const CARD_SELECTED = "border-orange-500 bg-orange-500/10 dark:bg-orange-500/10";

export function Step2ContentStyle({ wizardData, onNext, onBack }: Props) {
  const router = useRouter();
  const { updateWizardData } = useContentStudio();
  const contentStyleValue = wizardData.content_style ?? (wizardData as { contentStyle?: string }).contentStyle;
  const [selected, setSelected] = useState<ContentStyleId | null>(
    (contentStyleValue as ContentStyleId) ?? null
  );

  const handleNext = async () => {
    if (!selected) return;
    try {
      await fetch("/api/content-studio/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_style: selected }),
      });
    } catch {
      // continue to next step
    }
    console.log("Saving content style:", selected);
    await updateWizardData({
      content_style: selected,
      current_step: 3,
    });
    router.push("/dashboard/content-studio/create?step=3");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Step 2 of 7 — Your Content Style
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Faceless, AI-Generated, or Personal Brand?
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {CONTENT_STYLES.map((s) => {
          const Icon = s.icon;
          const isSelected = selected === s.id;
          return (
            <Card
              key={s.id}
              className={`${CARD_BASE} ${isSelected ? CARD_SELECTED : ""}`}
              onClick={() => setSelected(s.id)}
            >
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Icon className="w-8 h-8 text-orange-500 shrink-0" />
                  <div className="flex items-center gap-1 shrink-0">
                    {s.badge && isSelected && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        {s.badge}
                      </span>
                    )}
                    {!s.badge && isSelected && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md border border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
                        ✨ Selected
                      </span>
                    )}
                  </div>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Best for:</span>{" "}
                  {s.bestFor}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Video styles:</span>{" "}
                  {s.videoStyles}
                </p>
                <div className="rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-gray-50 dark:bg-gray-800/50 px-4 py-3 mb-4">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Perfect if you:
                  </p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                    {s.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {s.examples != null && s.examples !== "" && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      <span className="font-medium">Examples:</span> {s.examples}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={
                    isSelected
                      ? "bg-orange-500 hover:bg-orange-600 text-white"
                      : "border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                  }
                  variant={isSelected ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(s.id);
                  }}
                >
                  {s.buttonLabel}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!selected && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Select a content style to continue
        </p>
      )}

      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={!selected}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-500"
        >
          Next: Pick Niche
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
