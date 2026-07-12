import { Video, LayoutGrid, Mail } from "lucide-react";
import type { ContentAssetType } from "@/db/schema/jarvis-schema";

/**
 * Shared per-asset-type display metadata (label, plural label, icon) used
 * across the plan, review, and results screens so the "campaign" framing
 * stays visually consistent everywhere the three asset types show up.
 */
export const ASSET_TYPE_META: Record<
  ContentAssetType,
  { label: string; pluralLabel: string; icon: typeof Video }
> = {
  video_script: { label: "Video script", pluralLabel: "Video scripts", icon: Video },
  carousel: { label: "Carousel post", pluralLabel: "Carousel posts", icon: LayoutGrid },
  email: { label: "Email", pluralLabel: "Emails", icon: Mail },
};

export function assetLabel(type: ContentAssetType, count: number): string {
  return count === 1 ? ASSET_TYPE_META[type].label : ASSET_TYPE_META[type].pluralLabel;
}
