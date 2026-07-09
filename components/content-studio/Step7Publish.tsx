"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Film, Save, Download, BarChart3 } from "lucide-react";
import type { WizardData } from "./Step1AboutYou";

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

export function Step7Publish({ wizardData, onBack }: Props) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Step 7 of 7 — Publish & Track
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Save to library, export MP4, or track performance
      </p>

      <Card className="rounded-xl border-2 border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] mb-8 max-w-md">
        <CardContent className="p-0">
          <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-t-xl flex items-center justify-center">
            <Film className="w-12 h-12 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {(wizardData.selected_niche ?? (wizardData as { selectedNiche?: string }).selectedNiche) ?? "Your Video"} — YouTube long-form
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Title / thumbnail placeholder</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3 mb-8 max-w-md">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white hover:bg-orange-500/10 hover:border-orange-500/50 gap-3 h-12"
        >
          <Save className="w-5 h-5 text-orange-500" />
          Save to Library
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">Creates video record in draft status</p>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white hover:bg-orange-500/10 hover:border-orange-500/50 gap-3 h-12"
        >
          <Download className="w-5 h-5 text-orange-500" />
          Export MP4
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">Triggers existing export function</p>

        <Button
          type="button"
          variant="outline"
          className="w-full justify-start border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-900 dark:text-white hover:bg-orange-500/10 hover:border-orange-500/50 gap-3 h-12"
        >
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Track Performance
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">Placeholder for future analytics</p>
      </div>

      <Link
        href="/dashboard/content-studio"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Content Studio
      </Link>
    </div>
  );
}
