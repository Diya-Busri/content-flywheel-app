"use client";

import React from "react";
import type { CreationMode, TemplateType, FontStyle, SlideItem, CaptionItem, AiStoryScene } from "./template-studio-shared";

export type TemplateStudioViewProps = {
  step: 1 | 2 | 3;
  setStep: (s: 1 | 2 | 3) => void;
  mode: CreationMode;
  setMode: (m: CreationMode) => void;
  brandName: string;
  setBrandName: (v: string) => void;
  niche: string;
  setNiche: (v: string) => void;
  templateType: TemplateType;
  setTemplateType: (v: TemplateType) => void;
  slideCount: 5 | 10 | 20;
  setSlideCount: (v: 5 | 10 | 20) => void;
  slideCountViral: 5 | 6 | 7 | 8 | 9 | 10;
  setSlideCountViral: (v: 5 | 6 | 7 | 8 | 9 | 10) => void;
  brandPrimary: string;
  setBrandPrimary: (v: string) => void;
  brandSecondary: string;
  setBrandSecondary: (v: string) => void;
  fontStyle: FontStyle;
  setFontStyle: (v: FontStyle) => void;
  productDescription: string;
  setProductDescription: (v: string) => void;
  targetAudience: string;
  setTargetAudience: (v: string) => void;
  painPoints: string;
  setPainPoints: (v: string) => void;
  brandVibe: string;
  setBrandVibe: (v: string) => void;
  postGoal: string;
  setPostGoal: (v: string) => void;
  hookAngle: string;
  setHookAngle: (v: string) => void;
  ctaGoal: string;
  setCtaGoal: (v: string) => void;
  aiStoryCharacters: string;
  setAiStoryCharacters: (v: string) => void;
  aiStoryTheme: string;
  setAiStoryTheme: (v: string) => void;
  aiStoryTone: "Sad" | "Dramatic" | "Shocking";
  setAiStoryTone: (v: "Sad" | "Dramatic" | "Shocking") => void;
  aiStoryEpisodeNumber: number;
  setAiStoryEpisodeNumber: (v: number) => void;
  aiStoryScenes: AiStoryScene[];
  aiStoryLoading: boolean;
  slides: SlideItem[];
  generating: boolean;
  regeneratingIndex: number | null;
  exporting: boolean;
  captions: CaptionItem[];
  captionsLoading: boolean;
  packName: string;
  setPackName: (v: string) => void;
  savingPack: boolean;
  slideRefs: React.RefObject<(HTMLDivElement | null)[]>;
  canProceedStep1: boolean;
  handleGenerateContent: () => Promise<void>;
  handleRegenerateSlide: (index: number) => Promise<void>;
  updateSlide: (index: number, field: "heading" | "body", value: string) => void;
  handleExportPack: () => Promise<void>;
  handleGetCaptions: () => Promise<void>;
  updateCaption: (index: number, field: keyof CaptionItem, value: string) => void;
  handleCopyAllCaptions: () => void;
  handleSavePack: () => Promise<void>;
  saveSetup: () => Promise<void>;
};

export function TemplateStudioView(_props: TemplateStudioViewProps) {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">Template Studio — full UI will be restored in the next step.</p>
    </div>
  );
}
