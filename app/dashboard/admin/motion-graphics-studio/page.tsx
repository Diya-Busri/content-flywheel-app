"use client";

/**
 * Admin → Motion Graphics Studio
 *
 * ADMIN ONLY. Access control:
 *   - Page-level: inherited from app/dashboard/admin/layout.tsx, which
 *     redirects any non-admin (or signed-out) user to /dashboard before this
 *     component ever renders.
 *   - Nav-level: only rendered in components/sidebar.tsx when isAdminUser is
 *     true, so non-admins never even see a link to this page.
 *   - API-level: every /api/admin/motion-graphics/* route re-checks
 *     lib/motion-graphics/guard.ts server-side, so a direct API call can't
 *     bypass admin-only access either.
 *
 * Four tabs:
 *   - Templates          — saved/reusable templates, opens the Template Builder
 *   - Animation Library   — all 31 reusable animation components, live preview
 *   - AI Script to Video  — paste a script, get a full draft template
 *   - Asset Library       — upload/manage images, video, logos, audio, music, SFX
 */

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clapperboard, Sparkles, LayoutTemplate, FolderOpen } from "lucide-react";
import { TemplatesList } from "@/components/motion-graphics-studio/TemplatesList";
import { AnimationLibraryGrid } from "@/components/motion-graphics-studio/AnimationLibraryGrid";
import { ScriptToVideoPanel } from "@/components/motion-graphics-studio/ScriptToVideoPanel";
import { AssetLibraryPanel } from "@/components/motion-graphics-studio/AssetLibraryPanel";

export default function MotionGraphicsStudioPage() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clapperboard className="text-orange-500" size={26} />
          Motion Graphics Studio
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build reusable, animated video templates with Remotion — admin only.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate size={14} />
            Templates
          </TabsTrigger>
          <TabsTrigger value="animations" className="gap-1.5">
            <Sparkles size={14} />
            Animation Library
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5">
            <Sparkles size={14} />
            AI Script to Video
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <FolderOpen size={14} />
            Asset Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-5">
          <TemplatesList />
        </TabsContent>
        <TabsContent value="animations" className="mt-5">
          <AnimationLibraryGrid />
        </TabsContent>
        <TabsContent value="ai" className="mt-5">
          <ScriptToVideoPanel />
        </TabsContent>
        <TabsContent value="assets" className="mt-5">
          <AssetLibraryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
