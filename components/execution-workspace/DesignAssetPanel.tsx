"use client";

/**
 * DesignAssetPanel
 * ─────────────────
 * Displayed in the workspace after the Design Agent completes.
 *
 * Shows:
 *   • Cover Concepts (6 style variations) — rendered via SlidePreview when
 *     element-based (new), or <img> for legacy DALL-E URLs
 *   • Mockup, Thumbnail, Social — with role badges
 *   • "Open in Design Studio" per concept + carousel link
 *
 * Roles:
 *   Product Cover   → coverThumbnailUrl
 *   Store Thumbnail → thumbnailUrl  (used by marketplace cards)
 *   Social Preview  → socialPreviewUrl
 *   3D Mockup       → bookMockupUrl
 *
 * Saving: PATCH /api/products/[productId]/marketing-assets with the chosen URLs.
 */

import { useState, useCallback, useEffect } from "react";
import { Check, Star, ExternalLink, Loader2, Layout, Pencil } from "lucide-react";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import type { DesignData } from "@/db/schema/designs-schema";
import { SlidePreview } from "@/app/dashboard/design-studio/SlidePreview";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type DesignResult = NonNullable<LaunchStageResults["design"]>;
type Concept      = NonNullable<DesignResult["concepts"]>[number];

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
  },
  thumbnail: {
    key:   "thumbnailUrl" as keyof AssetRoles,
    label: "Store Thumbnail",
    emoji: "🛍",
  },
  social: {
    key:   "socialPreviewUrl" as keyof AssetRoles,
    label: "Social Preview",
    emoji: "📱",
  },
  mockup: {
    key:   "bookMockupUrl" as keyof AssetRoles,
    label: "3D Mockup",
    emoji: "📦",
  },
} as const;

type RoleKey = keyof typeof ROLE_CONFIG;

/* ─── Utility ────────────────────────────────────────────────────────────────── */

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Cover design preview sizes ─────────────────────────────────────────────── */

const DESIGN_W  = 1080;
const DESIGN_H  = 1350;
const PREVIEW_W = 196;   // fits 3-up in the panel column (~200px each, with 2px gap)
const PREVIEW_H = Math.round((DESIGN_H / DESIGN_W) * PREVIEW_W); // ≈ 245
const SCALE     = PREVIEW_W / DESIGN_W;

/* ─── DesignPreview — fetches a single design and renders it ─────────────────── */

interface DesignPreviewProps {
  designId: string;
}

function DesignPreview({ designId }: DesignPreviewProps) {
  const [data,  setData]  = useState<DesignData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/designs/${designId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((json: { design?: { data?: DesignData } }) => {
        if (!cancelled && json.design?.data) {
          setData(json.design.data);
          setReady(true);
        }
      })
      .catch(() => { if (!cancelled) setReady(true); }); // show placeholder on error
    return () => { cancelled = true; };
  }, [designId]);

  if (!ready) {
    return (
      <div
        style={{ width: DESIGN_W, height: DESIGN_H, background: "#1e1b4b" }}
        className="animate-pulse"
      />
    );
  }

  if (!data) {
    // Error / not found — show a fallback gradient
    return (
      <div style={{ width: DESIGN_W, height: DESIGN_H, background: "linear-gradient(135deg,#4f46e5,#1e1b4b)" }} />
    );
  }

  return <SlidePreview data={data} scale={1} />;
}

/* ─── ConceptCard — single cover concept with SlidePreview ───────────────────── */

interface ConceptCardProps {
  concept:    Concept;
  isSelected: boolean;
  saving:     boolean;
  onSelect:   () => void;
}

function ConceptCard({ concept, isSelected, saving, onSelect }: ConceptCardProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = () => { if (!saving) onSelect(); };
  const handleKey   = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !saving) onSelect(); };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer",
        isSelected
          ? "border-primary shadow-lg shadow-primary/20"
          : hovered
            ? "border-border/60"
            : "border-border/30",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {/* Clipped, scaled preview container */}
      <div
        className="relative overflow-hidden bg-muted/20"
        style={{ width: PREVIEW_W, height: PREVIEW_H }}
      >
        {/* Scale wrapper — renders the 1080×1350 design at SCALE */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          {concept.designId ? (
            <DesignPreview designId={concept.designId} />
          ) : concept.url ? (
            // Legacy DALL-E image
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={concept.url}
              alt={concept.label}
              style={{ width: DESIGN_W, height: DESIGN_H, objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ width: DESIGN_W, height: DESIGN_H, background: "#1e1b4b" }} />
          )}
        </div>

        {/* Selected badge */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-start justify-end p-2 z-10 pointer-events-none">
            <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-md">
              <Check className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="bg-card px-2 pt-1.5 pb-0.5">
        <p className="text-[10px] font-semibold text-foreground/80 truncate">{concept.label}</p>
      </div>

      {/* Actions */}
      <div className="bg-card px-2 pb-2 flex gap-1 flex-wrap">
        <button
          onClick={e => { e.stopPropagation(); if (!saving) onSelect(); }}
          disabled={saving || isSelected}
          className={cn(
            "text-[9px] font-medium rounded-full px-1.5 py-0.5 transition-all border",
            isSelected
              ? "bg-primary/10 text-primary border-primary/30 cursor-default"
              : "bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground",
          )}
        >
          {isSelected
            ? <span className="flex items-center gap-0.5"><Check className="w-2 h-2" /> Selected</span>
            : <span className="flex items-center gap-0.5"><Star className="w-2 h-2" /> Use this</span>
          }
        </button>

        {concept.designId && (
          <a
            href={`/dashboard/design-studio/${concept.designId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-[9px] font-medium rounded-full px-1.5 py-0.5 border border-border/40 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-0.5 transition-all"
          >
            <Pencil className="w-2 h-2" /> Edit
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── AssetCard — for mockup / thumbnail / social (URL-based) ────────────────── */

interface AssetCardProps {
  url:         string;
  label:       string;
  activeRoles: RoleKey[];
  onAssign:    (role: RoleKey) => void;
  saving:      boolean;
}

function AssetCard({ url, label, activeRoles, onAssign, saving }: AssetCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all duration-200 group",
        hovered ? "border-border/60" : "border-border/30",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative bg-muted/20 aspect-square overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
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

      <div className="bg-card px-2 pt-1.5 pb-0.5">
        <p className="text-[10px] font-semibold text-foreground/80 truncate">{label}</p>
      </div>

      <div className="bg-card px-2 pb-2 flex flex-wrap gap-1">
        {(Object.keys(ROLE_CONFIG) as RoleKey[]).map(role => {
          const isActive = activeRoles.includes(role);
          return (
            <button
              key={role}
              onClick={() => onAssign(role)}
              disabled={saving || isActive}
              className={cn(
                "text-[9px] font-medium rounded-full px-1.5 py-0.5 transition-all border",
                isActive
                  ? "bg-primary/10 text-primary border-primary/30 cursor-default"
                  : "bg-muted/50 text-muted-foreground border-border/40 hover:bg-muted hover:text-foreground cursor-pointer",
              )}
            >
              {isActive
                ? <span className="flex items-center gap-0.5"><Check className="w-2 h-2" />{ROLE_CONFIG[role].label}</span>
                : <span className="flex items-center gap-0.5"><Star className="w-2 h-2" />{ROLE_CONFIG[role].label}</span>
              }
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────────── */

export function DesignAssetPanel({ design, productId }: Props) {
  const initSelectedConceptKey = (): string | null => {
    const first = design.concepts?.[0];
    return first?.designId ?? first?.url ?? null;
  };

  const [selectedKey, setSelectedKey] = useState<string | null>(initSelectedConceptKey);
  const [roles, setRoles] = useState<AssetRoles>({
    coverThumbnailUrl: design.selectedConceptUrl ?? design.concepts?.[0]?.url ?? null,
    thumbnailUrl:      design.thumbnailUrl ?? null,
    socialPreviewUrl:  design.socialUrl    ?? null,
    bookMockupUrl:     design.mockupUrl    ?? null,
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const getActiveRoles = useCallback((url: string): RoleKey[] =>
    (Object.keys(ROLE_CONFIG) as RoleKey[]).filter(role => roles[ROLE_CONFIG[role].key] === url),
  [roles]);

  const persistRoles = useCallback(async (next: AssetRoles & { coverDesignId?: string | null }) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/marketing-assets`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          coverThumbnailUrl: next.coverThumbnailUrl ?? null,
          thumbnailUrl:      next.thumbnailUrl      ?? null,
          socialPreviewUrl:  next.socialPreviewUrl  ?? null,
          bookMockupUrl:     next.bookMockupUrl     ?? null,
          ...(next.coverDesignId !== undefined ? { coverDesignId: next.coverDesignId } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [productId]);

  /* Assign a URL-based role (for mockup/thumbnail/social) */
  const assignRole = useCallback(async (role: RoleKey, url: string) => {
    const next = { ...roles, [ROLE_CONFIG[role].key]: url };
    setRoles(next);
    await persistRoles(next);
  }, [roles, persistRoles]);

  /* Select a cover concept */
  const selectConcept = useCallback(async (concept: Concept) => {
    const key = concept.designId ?? concept.url ?? null;
    setSelectedKey(key);
    const next: AssetRoles & { coverDesignId?: string | null } = {
      ...roles,
      coverThumbnailUrl: concept.url ?? null,
      coverDesignId:     concept.designId ?? null,
    };
    setRoles(next);
    await persistRoles(next);
  }, [roles, persistRoles]);

  /* Build asset lists */
  const hasConcepts = Array.isArray(design.concepts) && design.concepts.length > 0;
  const otherAssets: Array<{ url: string; label: string }> = [
    design.mockupUrl    ? { url: design.mockupUrl,    label: "3D Mockup"       } : null,
    design.thumbnailUrl ? { url: design.thumbnailUrl, label: "Store Thumbnail" } : null,
    design.socialUrl    ? { url: design.socialUrl,    label: "Social Preview"  } : null,
  ].filter((a): a is { url: string; label: string } => a !== null);

  if (!hasConcepts && otherAssets.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between min-h-[20px]">
        <p className="text-[11px] text-muted-foreground">
          {hasConcepts ? "Click a concept to select it — Edit to customise in Design Studio" : "Assign roles to each asset"}
        </p>
        <div className="flex items-center gap-1.5">
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

      {/* Cover concepts */}
      {hasConcepts && (
        <>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Cover Concepts</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {design.concepts!.map(concept => {
              const key        = concept.designId ?? concept.url ?? concept.style;
              const isSelected = selectedKey === (concept.designId ?? concept.url ?? null);
              return (
                <ConceptCard
                  key={key}
                  concept={concept}
                  isSelected={isSelected}
                  saving={saving}
                  onSelect={() => selectConcept(concept)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Other assets */}
      {otherAssets.length > 0 && (
        <>
          {hasConcepts && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Other Assets</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>
          )}
          <div className={cn(
            "grid gap-2",
            otherAssets.length === 1 ? "grid-cols-1" :
            otherAssets.length === 2 ? "grid-cols-2" :
            "grid-cols-3",
          )}>
            {otherAssets.map(({ url, label }) => (
              <AssetCard
                key={url}
                url={url}
                label={label}
                activeRoles={getActiveRoles(url)}
                onAssign={role => assignRole(role, url)}
                saving={saving}
              />
            ))}
          </div>
        </>
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
