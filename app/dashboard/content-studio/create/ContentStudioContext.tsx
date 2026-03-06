"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

/** Script config from Step 4.5 (duration, angles to generate). */
export interface ScriptConfig {
  duration?: string;
  angles?: string[];
  estimated_cost?: number;
}

/** Wizard data uses snake_case to match DB column names (content_style, selected_niche, etc.). */
export interface WizardData {
  topics?: string | null;
  content_style?: string | null;
  selected_niche?: string | null;
  selected_topic?: { title?: string; hook_angle?: string; id?: string } | null;
  current_step?: number;
  script_strategy?: Record<string, unknown> | null;
  script_config?: ScriptConfig | null;
}

interface ContentStudioContextType {
  wizardData: WizardData;
  updateWizardData: (data: Partial<WizardData>) => Promise<void>;
  loading: boolean;
}

const ContentStudioContext = createContext<ContentStudioContextType | undefined>(undefined);

/** Map API response (camelCase) to context state (snake_case). */
function apiToWizardData(data: {
  currentStep?: number;
  topics?: string | null;
  contentStyle?: string | null;
  selectedNiche?: string | null;
  scriptStrategy?: Record<string, unknown> | null;
}): WizardData {
  const strategy = data.scriptStrategy ?? null;
  const selected_topic = (strategy && typeof strategy === "object" && strategy.selected_topic != null)
    ? (strategy.selected_topic as { title?: string; hook_angle?: string; id?: string })
    : null;
  const script_config = (strategy && typeof strategy === "object" && strategy.script_config != null)
    ? (strategy.script_config as ScriptConfig)
    : null;
  return {
    topics: data.topics ?? null,
    content_style: data.contentStyle ?? null,
    selected_niche: data.selectedNiche ?? null,
    selected_topic,
    current_step: data.currentStep ?? 1,
    script_strategy: strategy,
    script_config: script_config ?? null,
  };
}

/** Build API payload (camelCase) from context state (snake_case). Persist selected_topic and script_config inside scriptStrategy. */
function wizardDataToPayload(updated: WizardData): Record<string, unknown> {
  const scriptStrategy =
    updated.selected_topic != null ||
    updated.script_config != null ||
    (updated.script_strategy != null && Object.keys(updated.script_strategy).length > 0)
      ? {
          ...(updated.script_strategy ?? {}),
          ...(updated.selected_topic != null && { selected_topic: updated.selected_topic }),
          ...(updated.script_config != null && { script_config: updated.script_config }),
        }
      : undefined;
  return {
    ...(updated.current_step != null && { currentStep: updated.current_step }),
    ...(updated.topics !== undefined && { topics: updated.topics }),
    ...(updated.content_style !== undefined && { contentStyle: updated.content_style }),
    ...(updated.selected_niche !== undefined && { selectedNiche: updated.selected_niche }),
    ...(scriptStrategy !== undefined && { scriptStrategy }),
  };
}

export function ContentStudioProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [wizardData, setWizardData] = useState<WizardData>({});
  const [loading, setLoading] = useState(true);

  const loadWizardData = useCallback(async () => {
    try {
      const res = await fetch("/api/content-studio/wizard-progress");
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;
      if (data) {
        setWizardData(apiToWizardData(data));
      }
    } catch (err) {
      console.error("Error loading wizard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadWizardData();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, loadWizardData]);

  const updateWizardData = useCallback(
    async (newData: Partial<WizardData>) => {
      const updated: WizardData = {
        ...wizardData,
        ...newData,
      };
      setWizardData(updated);

      const payload = wizardDataToPayload(updated);
      try {
        const res = await fetch("/api/content-studio/wizard-progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save progress");
      } catch (err) {
        console.error("Error saving wizard data:", err);
      }
    },
    [wizardData]
  );

  return (
    <ContentStudioContext.Provider value={{ wizardData, updateWizardData, loading }}>
      {children}
    </ContentStudioContext.Provider>
  );
}

export function useContentStudio() {
  const context = useContext(ContentStudioContext);
  if (context === undefined) {
    throw new Error("useContentStudio must be used within ContentStudioProvider");
  }
  return context;
}
