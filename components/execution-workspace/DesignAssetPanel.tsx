"use client";

/**
 * DesignAssetPanel
 * ─────────────────
 * Displayed in the workspace after the Design Agent completes.
 *
 * Sections:
 *   1. Cover Concepts — 6 rendered designs, click to set as Product Cover
 *   2. Store Thumbnail — radio selector (AI image / Mockup / Social) +
 *      editable 800×800 design link
 *   3. Other Assets — Mockup + Social with labels
 *   4. Carousel — Instagram carousel link
 *
 * Roles saved to marketingAssets via PATCH /api/products/[id]/marketing-assets:
 *   coverThumbnailUrl  — cover image URL (legacy / used by product editor)
 *   coverDesignId      — cover design record (Design Studio editable version)
 *   thumbnailUrl       — store thumbnail URL (shown in marketplace cards everywhere)
 *   thumbnailDesignId  — dedicated 800×800 thumbnail design ID
 *   socialPreviewUrl   — social preview URL
 *   bookMockupUrl      — 3D mockup URL
 */

import { useState, useCallback, useEffect } from "react";
import {
  Check, Star, ExternalLink, Loader2, Layout, Pencil, Image as ImageIcon,
} from "lucide-react";
import type { LaunchStageResults } from "@/db/schema/launch-schema";
import type { DesignData } from "@/db/schema/designs-schema";
import { SlidePreview } from "@/app/dashboard/design-studio/SlidePreview";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type DesignResult = NonNullable<LaunchStageResults["design"]>;
type Concept      = NonNullable<DesignResult["concepts"]>[number];

interface AssetRoles {
  coverThumbnailUrl?: string | null;
  coverDesignId?:     string | null;
  thumbnailUrl?:      string | null;
  thumbnailDesignId?: string | null;
  socialPreviewUrl?:  string | null;
  bookMockupUrl?:     string | null;
}

interface Props {
  design:    DesignResult;
  productId: string;
  launchId?: string;
}

/* ─── Utility ────────────────────────────────────────────────────────────────── */

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Cover design preview sizes (1080 × 1350 → 196px wide) ─────────────────── */

const COVER_W  = 1080;
const COVER_H  = 1350;
const PREV_W   = 196;
const PREV_H   = Math.round((COVER_H / COVER_W) * PREV_W); // ≈ 245
const SCALE    = PREV_W / COVER_W;

/* ─── Thumbnail design preview sizes (800 × 800 → 180px square) ──────────────── */

const THUMB_SRC_W  = 800;
const THUMB_PREV_W = 180;
const THUMB_SCALE  = THUMB_PREV_W / THUMB_SRC_W;

/* ─── DesignPreview — fetches one design and renders it ──────────────────────── */

function DesignPreview({
  designId,
  srcWidth,
  srcHeight,
}: {
  designId:  string;
  srcWidth:  number;
  srcHeight: number;
}) {
  const [data,  setData]  = useState<DesignData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/designs/${designId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((json: { design?: { data?: DesignData } }) => {
        if (!cancelled && json.design?.data) { setData(json.design.data); setReady(true); }
      })
      .catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [designId]);

  if (!ready) {
    return (
      <div
        style={{ width: srcWidth, height: srcHeight, background: "#1e1b4b" }}
        className="animate-pulse"
      />
    );
  }
  if (!data) {
    return <div style={{ width: srcWidth, height: srcHeight, background: "linear-gradient(135deg,#4f46e5,#1e1b4b)" }} />;
  }
  return <SlidePreview data={data} scale={1} />;
}

/* ─── ConceptCard — one cover concept with preview + actions ─────────────────── */

function ConceptCard({
  concept,
  isSelected,
  saving,
  onSelect,
}: {
  concept:    Concept;
  isSelected: boolean;
  saving:     boolean;
  onSelect:   () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer",
        isSelected
          ? "border-primary shadow-lg shadow-primary/20"
          : hovered ? "border-border/60" : "border-border/30",
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!saving) onSelect(); }}
      onKeyDown={e => { if (e.key === "Enter" && !saving) onSelect(); }}
    >
      {/* Scaled preview */}
      <div
        className="relative overflow-hidden bg-[#0f0f12]"
        style={{ width: PREV_W, height: PREV_H }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          {concept.designId ? (
            <DesignPreview designId={concept.designId} srcWidth={COVER_W} srcHeight={COVER_H} />
          ) : concept.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={concept.url} alt={concept.label} style={{ width: COVER_W, height: COVER_H, objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ width: COVER_W, height: COVER_H, background: "#1e1b4b" }} />
          )}
        </div>
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-start justify-end p-2 z-10 pointer-events-none">
            <div className="bg-primary text-primary-foreground rounded-full p-1 shadow-md">
              <Check className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>

      {/* Label + actions */}
      <div className="bg-card px-2 pt-1.5 pb-2 space-y-1">
        <p className="text-[10px] font-semibold text-foreground/80 truncate">{concept.label}</p>
        <div className="flex gap-1 flex-wrap">
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
    </div>
  );
}

/* ─── ThumbnailOption — one radio option in the Store Thumbnail selector ─────── */

type ThumbSource = "ai" | "mockup" | "social";

const THUMB_META: Record<ThumbSource, { label: string; emoji: string }> = {
  ai:     { label: "Auto-generated",  emoji: "✨" },
  mockup: { label: "3D Mockup",       emoji: "📦" },
  social: { label: "Social Preview",  emoji: "📱" },
};

function ThumbnailOption({
  source,
  url,
  active,
  onSelect,
  saving,
}: {
  source:   ThumbSource;
  url:      string;
  active:   boolean;
  onSelect: () => void;
  saving:   boolean;
}) {
  const meta = THUMB_META[source];
  return (
    <button
      onClick={onSelect}
      disabled={saving}
      className={cn(
        "flex-1 min-w-0 rounded-xl border-2 overflow-hidden transition-all duration-150 text-left",
        active ? "border-primary shadow-sm shadow-primary/20" : "border-border/30 hover:border-border/60",
      )}
    >
      {/* Image */}
      <div className="relative bg-[#0f0f12]" style={{ aspectRatio: "1/1" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={meta.label}
          className="w-full h-full object-contain"
        />
        {active && (
          <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5">
            <Check className="w-2.5 h-2.5" />
          </div>
        )}
      </div>
      {/* Label */}
      <div className="bg-card px-2 py-1.5">
        <p className="text-[10px] font-semibold text-foreground/80">{meta.emoji} {meta.label}</p>
      </div>
    </button>
  );
}

/* ─── Main panel ─────────────────────────────────────────────────────────────── */

export function DesignAssetPanel({ design, productId, launchId }: Props) {
  /* Derive initial cover selection */
  const initCoverKey = (): string | null => {
    const first = design.concepts?.[0];
    return first?.designId ?? first?.url ?? null;
  };

  /* Derive initial thumbnail source */
  const initThumbSource = (): ThumbSource | null => {
    if (design.thumbnailUrl)                   return "ai";
    if (design.mockupUrl && !design.thumbnailUrl) return "mockup";
    return null;
  };

  const [coverKey,     setCoverKey]     = useState<string | null>(initCoverKey);
  const [thumbSource,  setThumbSource]  = useState<ThumbSource | null>(initThumbSource);
  const [roles, setRoles] = useState<AssetRoles>({
    coverThumbnailUrl: design.concepts?.[0]?.url ?? null,
    coverDesignId:     design.concepts?.[0]?.designId ?? null,
    thumbnailUrl:      design.thumbnailUrl      ?? null,
    thumbnailDesignId: design.thumbnailDesignId ?? null,
    socialPreviewUrl:  design.socialUrl         ?? null,
    bookMockupUrl:     design.mockupUrl         ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  /* Persist to DB */
  const persist = useCallback(async (next: AssetRoles) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/products/${productId}/marketing-assets`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          coverThumbnailUrl: next.coverThumbnailUrl  ?? null,
          coverDesignId:     next.coverDesignId      ?? null,
          thumbnailUrl:      next.thumbnailUrl       ?? null,
          thumbnailDesignId: next.thumbnailDesignId  ?? null,
          socialPreviewUrl:  next.socialPreviewUrl   ?? null,
          bookMockupUrl:     next.bookMockupUrl      ?? null,
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

  /* Select a cover concept */
  const selectConcept = useCallback(async (concept: Concept) => {
    const key = concept.designId ?? concept.url ?? null;
    setCoverKey(key);
    const next: AssetRoles = {
      ...roles,
      coverThumbnailUrl: concept.url     ?? null,
      coverDesignId:     concept.designId ?? null,
    };
    setRoles(next);
    await persist(next);
    // Also persist selectedConceptUrl to the launch project stageResults
    if (launchId && concept.url) {
      fetch(`/api/launch/${launchId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          stageResults: { design: { selectedConceptUrl: concept.url } },
        }),
      }).catch(() => { /* non-fatal */ });
    }
    // Apply the selected concept as the product editor cover page background so the
    // PDF preview shows the designed cover, not a blank white page.
    if (concept.url && productId) {
      fetch(`/api/products/${productId}/apply-cover-concept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ conceptUrl: concept.url }),
      }).catch(() => { /* non-fatal */ });
    }
  }, [roles, persist, launchId, productId]);

  /* Select a thumbnail source */
  const selectThumb = useCallback(async (source: ThumbSource) => {
    setThumbSource(source);
    const urlMap: Record<ThumbSource, string | null | undefined> = {
      ai:     design.thumbnailUrl,
      mockup: design.mockupUrl,
      social: design.socialUrl,
    };
    const next: AssetRoles = { ...roles, thumbnailUrl: urlMap[source] ?? null };
    setRoles(next);
    await persist(next);
  }, [roles, persist, design.thumbnailUrl, design.mockupUrl, design.socialUrl]);

  /* Derived data */
  const hasConcepts    = Array.isArray(design.concepts) && design.concepts.length > 0;
  const thumbOptions: Array<{ source: ThumbSource; url: string }> = [
    design.thumbnailUrl ? { source: "ai",     url: design.thumbnailUrl } : null,
    design.mockupUrl    ? { source: "mockup", url: design.mockupUrl    } : null,
    design.socialUrl    ? { source: "social", url: design.socialUrl    } : null,
  ].filter((o): o is { source: ThumbSource; url: string } => o !== null);
  const hasThumbSelector  = thumbOptions.length > 0;
  const hasThumbnailDesign = !!design.thumbnailDesignId;

  if (!hasConcepts && !hasThumbSelector && !hasThumbnailDesign) return null;

  return (
    <div className="space-y-4">

      {/* Status bar */}
      <div className="flex items-center justify-between min-h-[18px]">
        <p className="text-[11px] text-muted-foreground">
          {hasConcepts ? "Select a concept — it will be applied as your product cover and marketing thumbnail" : "Assign assets below"}
        </p>
        <div className="flex items-center gap-1.5">
          {saving && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
          {saved  && <span className="flex items-center gap-1 text-[10px] text-emerald-500"><Check className="w-3 h-3" /> Saved</span>}
          {error  && <span className="text-[10px] text-destructive">{error}</span>}
        </div>
      </div>

      {/* ── Cover Concepts ── */}
      {hasConcepts && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Cover Concepts</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {design.concepts!.map(concept => {
              const key        = concept.designId ?? concept.url ?? concept.style;
              const isSelected = coverKey === (concept.designId ?? concept.url ?? null);
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
        </div>
      )}

      {/* ── Store Thumbnail Selector ── */}
      {(hasThumbSelector || hasThumbnailDesign) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Store Thumbnail</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>

          {/* Helper text */}
          <p className="text-[10px] text-muted-foreground">
            Choose which image appears in marketplace listings and product cards:
          </p>

          {/* Radio options — URL-based images */}
          {hasThumbSelector && (
            <div className="flex gap-2">
              {thumbOptions.map(({ source, url }) => (
                <ThumbnailOption
                  key={source}
                  source={source}
                  url={url}
                  active={thumbSource === source}
                  onSelect={() => selectThumb(source)}
                  saving={saving}
                />
              ))}
            </div>
          )}

          {/* Editable design option */}
          {hasThumbnailDesign && (
            <div className="rounded-xl border border-border/30 overflow-hidden">
              <div className="flex gap-3 p-3">
                {/* Scaled thumbnail design preview */}
                <div
                  className="relative overflow-hidden rounded-lg shrink-0 bg-[#0f0f12]"
                  style={{ width: THUMB_PREV_W, height: THUMB_PREV_W }}
                >
                  <div style={{
                    position:        "absolute",
                    top:             0,
                    left:            0,
                    transform:       `scale(${THUMB_SCALE})`,
                    transformOrigin: "top left",
                  }}>
                    <DesignPreview
                      designId={design.thumbnailDesignId!}
                      srcWidth={THUMB_SRC_W}
                      srcHeight={THUMB_SRC_W}
                    />
                  </div>
                </div>

                {/* Text + action */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">Editable Store Thumbnail</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      800×800 square design — fully editable in Design Studio.
                    </p>
                  </div>
                  <a
                    href={`/dashboard/design-studio/${design.thumbnailDesignId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Open in Design Studio
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Other Assets (Mockup + Social) ── */}
      {(design.mockupUrl || design.socialUrl) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Other Assets</span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="flex gap-2">
            {design.mockupUrl && (
              <div className="flex-1 rounded-xl border border-border/30 overflow-hidden">
                <div className="aspect-square bg-[#0f0f12]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={design.mockupUrl} alt="3D Mockup" className="w-full h-full object-contain" />
                </div>
                <div className="bg-card px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-foreground/70">📦 3D Mockup</p>
                </div>
              </div>
            )}
            {design.socialUrl && (
              <div className="flex-1 rounded-xl border border-border/30 overflow-hidden">
                <div className="aspect-square bg-[#0f0f12]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={design.socialUrl} alt="Social Preview" className="w-full h-full object-contain" />
                </div>
                <div className="bg-card px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-foreground/70">📱 Social Preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Carousel Link ── */}
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
