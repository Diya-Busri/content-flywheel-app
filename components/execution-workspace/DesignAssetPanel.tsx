"use client";

/**
 * DesignAssetPanel
 * ─────────────────
 * Displayed in the workspace after the Design Agent completes.
 *
 * Shows:
 *   • Cover Concepts (1-3 style variations) — selectable; click to set as Product Cover
 *   • Mockup, Thumbnail, Social — with role badges
 *   • "Open in Design Studio" carousel link (when carouselBundleId exists)
 *
 * Roles:
 *   Product Cover  → coverThumbnailUrl
 *   Store Thumbnail → thumbnailUrl  (used by marketplace cards)
 *   Social Preview  → socialPreviewUrl
 *   3D Mockup       → bookMockupUrl
 *
 * Saving: PATCH /api/products/[productId]/marketing-assets with the chosen URLs.
 */

import { useState, useCallback } from "react";
import { Check, Star, ExternalLink, Loader2, Layout } from "lucide-react";
import type { LaunchStageResults } from "@/db/schema/launch-schema";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type DesignResult = NonNullable<LaunchStageResults["design"]>;

interface AssetRoles {
  coverThumbnailUrl?: string | null;
  thumbnailUrl?:      string | null;
  socialPreviewUrl?:  string | null;
  bookMockupUrl?:     string | null;
}

interface Props {
  design:    DesignResult;
  productId: string;
}

/* ─── Role label config ──────────────────────────────────────────────────────── */

const ROLE_CONFIG = {
  cover: {
    key:   "coverThumbnailUrl" as keyof AssetRoles,
    label: "Product Cover",
    emoji: "🖼",
    tip:   "Shown on your product page and document",
  },
  thumbnail: {
    key:   "thumbnailUrl" as keyof AssetRoles,
    label: "Store Thumbnail",
    emoji: "🛍",
    tip:   "Shown on marketplace listing cards",
  },
  social: {
    key:   "socialPreviewUrl" as keyof AssetRoles,
    label: "Social Preview",
    emoji: "📱",
    tip:   "Used for social media sharing",
  },
  mockup: {
    key:   "bookMockupUrl" as keyof AssetRoles,
    label: "3D Mockup",
    emoji: "📦",
    tip:   "Realistic product mockup scene",
  },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;

/* ─── Utility ────────────────────────────────────────────────────────────────── */

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Asset image card ───────────────────────────────────────────────────────── */

interface AssetCardProps {
  url:          string;
  label:        string;
  activeRoles:  RoleKey[];
  isConcept?:   boolean;
  conceptIndex?: number;
  isSelected?:  boolean;
  onAssign:     (role: RoleKey) => void;
  saving:       boolean;
}

function AssetCard({
  url,
  label,
  activeRoles,
  isConcept,
  isSelected,
  onAssign,
  saving,
}: AssetCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all duration-200 group",
        isSelected
          ? "border-primary shadow-lg shadow-primary/20"
          : hovered
            ? "border-border/60"
            : "border-border/30",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative bg-muted/20 aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Selected overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-start justify-end p-2">
            <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-md">
              <Check className="w-3 h-3" />
            </div>
          </div>
        )}

        {/* Active role badges */}
        {activeRoles.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-1 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
            {activeRoles.map(role => (
              <span
                key={role}
                className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5"
              >
                {ROLE_CONFIG[role].emoji} {ROLE_CONFIG[role].label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Label row */}
      <div className="bg-card px-2 pt-1.5 pb-0.5">
        <p className="text-[10px] font-semibold text-foreground/80 truncate">{label}</p>
      </div>

      {/* Role buttons */}
      <div className="bg-card px-2 pb-2 flex flex-wrap gap-1">
        {(Object.keys(ROLE_CONFIG) as RoleKey[]).map(role => {
          const isActive = activeRoles.includes(role);
          return (
            <button
              key={role}
              onClick={() => onAssign(role)}
              disabled={saving || isActive}
              title={isActive ? `Currently set as ${ROLE_CONFIG[role].label}` : `Set as ${ROLE_CONFIG[role].label}`}
              className={cn(
                "text-[9px] font-medium rounded-full px-1.5 py-0.5 transition-all border",
                isActive
                  ? "bg-primary/10 text-primary border-primary/30 cursor-default"
                  : "bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground cursor-pointer",
              )}
            >
              {isActive ? (
                <span className="flex items-center gap-0.5">
                  <Check className="w-2 h-2" />
                  {ROLE_CONFIG[role].label}
                </span>
              ) : (
                <span className="flex items-center gap-0.5">
                  <Star className="w-2 h-2" />
                  {ROLE_CONFIG[role].label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────────── */

export function DesignAssetPanel({ design, productId }: Props) {
  /* Initialise role assignments from current design result */
  const initRoles = (): AssetRoles => {
    const firstConceptUrl = design.concepts?.[0]?.url ?? design.coverUrl ?? null;
    return {
      coverThumbnailUrl: firstConceptUrl,
      thumbnailUrl:      design.thumbnailUrl ?? null,
      socialPreviewUrl:  design.socialUrl    ?? null,
      bookMockupUrl:     design.mockupUrl    ?? null,
    };
  };

  const [roles,   setRoles]   = useState<AssetRoles>(initRoles);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* Derive which roles are active for a given URL */
  const getActiveRoles = useCallback((url: string): RoleKey[] => {
    return (Object.keys(ROLE_CONFIG) as RoleKey[]).filter(
      role => roles[ROLE_CONFIG[role].key] === url,
    );
  }, [roles]);

  /* Assign a role to a URL */
  const assignRole = useCallback(async (role: RoleKey, url: string) => {
    const newRoles = { ...roles, [ROLE_CONFIG[role].key]: url };
    setRoles(newRoles);
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const body: Record<string, string | null> = {
        coverThumbnailUrl: newRoles.coverThumbnailUrl ?? null,
        thumbnailUrl:      newRoles.thumbnailUrl      ?? null,
        socialPreviewUrl:  newRoles.socialPreviewUrl  ?? null,
        bookMockupUrl:     newRoles.bookMockupUrl     ?? null,
      };

      const res = await fetch(`/api/products/${productId}/marketing-assets`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [roles, productId]);

  /* Build asset list */
  const hasConcepts  = Array.isArray(design.concepts) && design.concepts.length > 0;
  const coverAssets: Array<{ url: string; label: string; isConcept: boolean }> = hasConcepts
    ? design.concepts!.map(c => ({ url: c.url, label: `${c.label} Cover`, isConcept: true }))
    : design.coverUrl
      ? [{ url: design.coverUrl, label: "Product Cover", isConcept: false }]
      : [];

  const otherAssets: Array<{ url: string; label: string; isConcept: boolean }> = [
    design.mockupUrl    ? { url: design.mockupUrl,    label: "3D Mockup",       isConcept: false } : null,
    design.thumbnailUrl ? { url: design.thumbnailUrl, label: "Store Thumbnail", isConcept: false } : null,
    design.socialUrl    ? { url: design.socialUrl,    label: "Social Preview",  isConcept: false } : null,
  ].filter((a): a is { url: string; label: string; isConcept: false } => a !== null);

  const allAssets = [...coverAssets, ...otherAssets];

  if (allAssets.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          Click <Star className="inline w-3 h-3 mx-0.5" /> to assign roles — changes save instantly
        </p>
        <div className="flex items-center gap-1.5 h-5">
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {error && (
            <span className="text-[10px] text-destructive">{error}</span>
          )}
        </div>
      </div>

      {/* Section label for concepts */}
      {hasConcepts && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Cover Concepts
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
      )}

      {/* Cover concept grid */}
      {coverAssets.length > 0 && (
        <div className={cn(
          "grid gap-2",
          coverAssets.length === 1 ? "grid-cols-1" :
          coverAssets.length === 2 ? "grid-cols-2" :
          "grid-cols-3"
        )}>
          {coverAssets.map(({ url, label }) => {
            const activeRoles = getActiveRoles(url);
            const isSelected  = activeRoles.includes("cover");
            return (
              <AssetCard
                key={url}
                url={url}
                label={label}
                activeRoles={activeRoles}
                isConcept
                isSelected={isSelected}
                onAssign={role => assignRole(role, url)}
                saving={saving}
              />
            );
          })}
        </div>
      )}

      {/* Divider before other assets */}
      {hasConcepts && otherAssets.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Other Assets
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>
      )}

      {/* Other assets grid */}
      {otherAssets.length > 0 && (
        <div className={cn(
          "grid gap-2",
          otherAssets.length === 1 ? "grid-cols-1" :
          otherAssets.length === 2 ? "grid-cols-2" :
          "grid-cols-3"
        )}>
          {otherAssets.map(({ url, label }) => {
            const activeRoles = getActiveRoles(url);
            return (
              <AssetCard
                key={url}
                url={url}
                label={label}
                activeRoles={activeRoles}
                onAssign={role => assignRole(role, url)}
                saving={saving}
              />
            );
          })}
        </div>
      )}

      {/* Carousel link */}
      {design.carouselBundleId && (
        <a
          href={`/dashboard/design-studio?bundleId=${design.carouselBundleId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors group"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Layout className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground">Instagram Carousel Ready</p>
            <p className="text-[10px] text-muted-foreground">5 slides auto-created in Design Studio — click to edit</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors flex-shrink-0" />
        </a>
      )}
    </div>
  );
}
