/**
 * POST /api/launch/design
 * ─────────────────────────
 * Streaming design generation for the AI Execution pipeline (Phase 1.4b).
 *
 * Phase 1: Cover Concepts — 6 code-generated DesignData objects (NO DALL-E)
 *          Each concept is inserted into designsTable; no image generation cost.
 * Phase 2: Mockup, Thumbnail, Social — DALL-E (sequential, still image-based)
 * Phase 3: Instagram carousel (text-only DesignData, fast)
 * Phase 4: Save everything to DB
 *
 * Stream event sequence:
 *   step              — a named step is starting
 *   step-done         — a named step completed (may carry extra fields)
 *   asset-generating  — { assetId, label } — processing started
 *   asset-done        — { assetId, label, url?, designId? } — ready (show it)
 *   asset-error       — { assetId, label, message } — failed (non-fatal)
 *   done              — { assets, assetsCount, concepts, carouselBundleId }
 *   error             — fatal error
 *
 * Saves to productsTable.marketingAssets:
 *   bookMockupUrl      — 3D mockup
 *   thumbnailUrl       — store thumbnail (used by marketplace cards)
 *   socialPreviewUrl   — social preview
 *   coverConcepts      — 6 concept objects { style, label, designId }
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 300; // 3 covers parallel (~40s) + 3 sequential (~120s) + carousel (~15s) + saves

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { contentBundlesTable } from "@/db/schema/bundles-schema";
import { designsTable } from "@/db/schema/designs-schema";
import type { DesignData, DesignElement } from "@/db/schema/designs-schema";
import { eq, and, isNull } from "drizzle-orm";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { upload } from "@/lib/storage";
import {
  detectNiche,
  buildAllCoverConcepts,
  buildStoreThumbnailConcept,
  type CoverInput,
} from "@/lib/cover-templates";

/* ─── Regular asset definitions ──────────────────────────────────────────────── */

interface DesignAsset {
  id:    string;
  label: string;
  size:  "1024x1024" | "1024x1536";
}

const REGULAR_ASSETS: DesignAsset[] = [
  { id: "mockup",    label: "3D Mockup",       size: "1024x1024" },
  { id: "thumbnail", label: "Store Thumbnail", size: "1024x1024" },
  { id: "social",    label: "Social Preview",  size: "1024x1024" },
];

/* ─── Prompt builder ─────────────────────────────────────────────────────────── */

function buildImagePrompt(
  assetId: string,
  productName: string,
  niche:       string,
  format:      string,
): string {
  const name = productName.slice(0, 60);
  const n    = niche.slice(0, 40);
  const fmt  = format || "guide";

  switch (assetId) {
    case "mockup":
      return `Realistic 3D product mockup: a ${fmt} titled "${name}" resting on a minimal clean white desk. Soft drop shadow. Professional product photography. No people. Neutral background.`;

    case "thumbnail":
      return `Digital marketplace listing thumbnail for "${name}" (${n}). Minimalist design. Bold title text. Professional colour palette. Square format. Clean premium aesthetic. No people.`;

    case "social":
      return `Eye-catching square social media promotional image for "${name}". ${n} themed. Bold visual hierarchy. Shareable modern design. No real people. Clean contemporary aesthetic.`;

    case "banner":
      return `Wide landscape storefront hero banner for a digital creator in the "${n}" niche. Inspired by the product "${name}". Clean minimal workspace or lifestyle scene. Soft natural lighting. Muted premium colour palette. No text overlays. No people. Cinematic wide crop.`;

    default:
      return `Professional marketing image for "${name}" in ${n}`;
  }
}

/* ─── Image generation ───────────────────────────────────────────────────────── */

async function generateAndStoreImage(
  assetId:     string,
  productName: string,
  niche:       string,
  format:      string,
  userId:      string,
  apiKey:      string,
  size:        "1024x1024" | "1024x1536" = "1024x1024",
): Promise<string> {
  const prompt = buildImagePrompt(assetId, productName, niche, format);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:   "gpt-image-1",
      prompt,
      n:       1,
      size,
      quality: "auto",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { data?: Array<{ b64_json?: string }> };
  const b64  = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned");

  const buffer  = Buffer.from(b64, "base64");
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  if (useBlob) {
    try {
      const blob = await upload(
        `launch-design/${userId}/${assetId.replace(":", "-")}-${Date.now()}.png`,
        buffer,
        { access: "public", contentType: "image/png", addRandomSuffix: false },
      );
      return blob.url;
    } catch (blobErr) {
      console.warn(`[launch/design] Blob upload failed for ${assetId}:`, blobErr);
    }
  }

  return `data:image/png;base64,${b64}`;
}

/* ─── Carousel content generation ───────────────────────────────────────────── */

interface CarouselSlideContent {
  headline:    string;
  body:        string;
  accentColor: string;
}

const SLIDE_LABELS = [
  "Hook",
  "The Problem",
  "Why It Matters",
  "The Solution",
  "Take Action",
  "Proof",
  "Behind the Scenes",
  "Quick Win",
  "What You Get",
  "Final CTA",
];

async function generateCarouselContent(
  productName: string,
  niche:       string,
  apiKey:      string,
  slideCount = 5,
): Promise<CarouselSlideContent[]> {
  const count = Math.min(Math.max(slideCount, 3), 10);
  const slideTemplates = SLIDE_LABELS.slice(0, count);
  const arrayTemplate  = slideTemplates.map(() => `  { "headline": "...", "body": "...", "accentColor": "#hex" }`).join(",\n");
  const slideGuide     = slideTemplates.map((label, i) => `${i + 1}. ${label}`).join("\n");

  const prompt = `Create a ${count}-slide Instagram carousel promoting a digital product called "${productName}" in the ${niche} niche.

Return ONLY a valid JSON array with exactly ${count} items — no markdown, no code fences:
[
${arrayTemplate}
]

Slide order:
${slideGuide}

Rules:
- headline: 4-8 punchy words, sentence case
- body: 10-20 words, benefit-driven, conversational
- accentColor: vivid hex from: #e94560 #f59e0b #10b981 #3b82f6 #8b5cf6 — vary each slide`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:       "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return only valid JSON arrays. No markdown, no commentary." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.7,
      max_tokens:  Math.max(700, count * 120),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Carousel text gen ${res.status}`);

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  let text = data.choices?.[0]?.message?.content?.trim() ?? "[]";
  if (text.startsWith("```")) {
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  }

  const slides = JSON.parse(text) as CarouselSlideContent[];
  return slides.slice(0, count);
}

/* ─── Carousel DesignData builder ────────────────────────────────────────────── */

const SLIDE_BG_COLORS = ["#0f172a", "#1a1a2e", "#0f3460", "#1e1b4b", "#0c1a2e"];

function buildCarouselSlideData(
  slide:      CarouselSlideContent,
  index:      number,
  total:      number,
): DesignData {
  const bg = SLIDE_BG_COLORS[index % SLIDE_BG_COLORS.length];

  const elements: DesignElement[] = [
    // Accent bar
    {
      id:           `s${index}-bar`,
      type:         "shape",
      x:            80,
      y:            80,
      width:        80,
      height:       6,
      shapeType:    "rectangle",
      fill:         slide.accentColor,
      borderRadius: 3,
    },
    // Slide counter
    {
      id:         `s${index}-count`,
      type:       "text",
      x:          80,
      y:          112,
      width:      200,
      height:     36,
      content:    `${index + 1} / ${total}`,
      fontSize:   14,
      fontFamily: "Inter",
      color:      "#ffffff60",
      fontWeight: "400",
    },
    // Headline
    {
      id:          `s${index}-headline`,
      type:        "text",
      x:           80,
      y:           400,
      width:       920,
      height:      240,
      content:     slide.headline,
      fontSize:    66,
      fontFamily:  "Inter",
      color:       "#ffffff",
      fontWeight:  "700",
      lineHeight:  1.1,
    },
    // Body
    {
      id:          `s${index}-body`,
      type:        "text",
      x:           80,
      y:           660,
      width:       840,
      height:      120,
      content:     slide.body,
      fontSize:    28,
      fontFamily:  "Inter",
      color:       "#ffffffb3",
      fontWeight:  "400",
      lineHeight:  1.45,
    },
    // Bottom separator
    {
      id:        `s${index}-line`,
      type:      "shape",
      x:         80,
      y:         956,
      width:     920,
      height:    2,
      shapeType: "rectangle",
      fill:      "#ffffff18",
    },
    // Accent dot at bottom-right
    {
      id:           `s${index}-dot`,
      type:         "shape",
      x:            980,
      y:            944,
      width:        24,
      height:       24,
      shapeType:    "rectangle",
      fill:         slide.accentColor,
      borderRadius: 12,
    },
  ];

  return {
    width:      1080,
    height:     1080,
    background: bg,
    elements,
  };
}

/* ─── Carousel DB insert ─────────────────────────────────────────────────────── */

async function createCarouselBundle(
  userId:       string,
  productName:  string,
  slides:       CarouselSlideContent[],
): Promise<string> {
  // Insert bundle record
  const [bundle] = await db
    .insert(contentBundlesTable)
    .values({
      userId,
      title:      `${productName} — Instagram Carousel`,
      style:      "dark-pro",
      slideCount: slides.length,
    })
    .returning({ id: contentBundlesTable.id });

  const bundleId = bundle.id;

  // Insert slide designs
  await db.insert(designsTable).values(
    slides.map((slide, i) => ({
      userId,
      title:      `${SLIDE_LABELS[i] ?? `Slide ${i + 1}`}`,
      data:       buildCarouselSlideData(slide, i, slides.length),
      bundleId,
      slideIndex: i,
    })),
  );

  return bundleId;
}

/* ─── Streaming generator ────────────────────────────────────────────────────── */

function streamDesignGeneration(
  userId:       string,
  productId:    string,
  productName:  string,
  niche:        string,
  format:       string,
  apiKey:       string,
  carouselCount = 5,
): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer closed */ }
  };

  void (async () => {
    const generatedUrls: Record<string, string> = {};
    const successfulConcepts: Array<{ style: string; label: string; designId: string }> = [];
    let carouselBundleId: string | undefined;
    let thumbnailDesignId: string | undefined;
    let bannerUrl: string | undefined;

    try {
      /* ── Step 0: prep ── */
      await send({ type: "step", id: "prep", label: "Reading product details..." });
      await send({ type: "step-done", id: "prep" });

      /* ── Phase 1: Generate 6 cover concepts via template engine (no DALL-E) ── */
      await send({ type: "step", id: "concepts", label: "Creating 6 cover concepts..." });

      const detectedNiche = detectNiche(productName, niche);
      const coverInput: CoverInput = {
        title:    productName,
        subtitle: `Your complete ${format} on ${niche}`,
        author:   "The Author",   // will be overridden from product data when available
        category: niche || "Digital Product",
        niche:    detectedNiche,
      };

      const allConcepts = buildAllCoverConcepts(coverInput);

      // Announce all 6 as generating simultaneously
      await Promise.all(
        allConcepts.map(c =>
          send({ type: "asset-generating", assetId: `cover:${c.style}`, label: `${c.label} Cover` }),
        ),
      );

      // Insert all 6 into designsTable in parallel
      const conceptResults = await Promise.allSettled(
        allConcepts.map(async (concept) => {
          const [row] = await db
            .insert(designsTable)
            .values({
              userId,
              title:      `${productName} — ${concept.label}`,
              data:       concept.data,
              bundleId:   null,
              slideIndex: null,
            })
            .returning({ id: designsTable.id });

          const designId = row.id;

          await send({
            type:         "asset-done",
            assetId:      `cover:${concept.style}`,
            label:        `${concept.label} Cover`,
            designId,
            conceptStyle: concept.style,
          });

          return { style: concept.style, label: concept.label, designId };
        }),
      );

      for (const result of conceptResults) {
        if (result.status === "fulfilled") {
          successfulConcepts.push(result.value);
        }
      }

      if (successfulConcepts.length === 0) {
        await send({ type: "asset-error", assetId: "cover", label: "Cover", message: "All cover concepts failed" });
      }

      await send({ type: "step-done", id: "concepts" });

      /* ── Phase 1b: Generate dedicated store thumbnail design (800×800) ── */
      try {
        await send({ type: "asset-generating", assetId: "cover:thumbnail", label: "Store Thumbnail Design" });
        const thumbConcept = buildStoreThumbnailConcept(coverInput);
        const [thumbRow] = await db
          .insert(designsTable)
          .values({
            userId,
            title:      `${productName} — Store Thumbnail`,
            data:       thumbConcept.data,
            bundleId:   null,
            slideIndex: null,
          })
          .returning({ id: designsTable.id });
        thumbnailDesignId = thumbRow.id;
        await send({
          type:         "asset-done",
          assetId:      "cover:thumbnail",
          label:        "Store Thumbnail Design",
          designId:     thumbnailDesignId,
          conceptStyle: "thumbnail",
        });
      } catch (thumbErr) {
        console.warn("[launch/design] Thumbnail design failed (non-fatal):", thumbErr);
      }

      /* ── Phase 2: Generate mockup, thumbnail, social sequentially ── */
      for (const asset of REGULAR_ASSETS) {
        await send({ type: "asset-generating", assetId: asset.id, label: asset.label });

        try {
          const url = await generateAndStoreImage(
            asset.id, productName, niche, format, userId, apiKey, asset.size,
          );
          generatedUrls[asset.id] = url;
          await send({ type: "asset-done", assetId: asset.id, label: asset.label, url });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[launch/design] Asset ${asset.id} failed:`, msg);
          await send({ type: "asset-error", assetId: asset.id, label: asset.label, message: msg });
        }
      }

      /* ── Phase 2b: Generate storefront banner (1536×1024 landscape) ── */
      await send({ type: "asset-generating", assetId: "banner", label: "Store Banner" });
      try {
        bannerUrl = await generateAndStoreImage("banner", productName, niche, format, userId, apiKey, "1536x1024");
        await send({ type: "asset-done", assetId: "banner", label: "Store Banner", url: bannerUrl });
      } catch (bannerErr) {
        console.warn("[launch/design] Banner generation failed (non-fatal):", bannerErr);
        await send({ type: "asset-error", assetId: "banner", label: "Store Banner", message: String(bannerErr) });
      }

      /* ── Phase 3: Generate Instagram carousel ── */
      await send({ type: "step", id: "carousel", label: "Creating Instagram carousel..." });

      try {
        const slideContents = await generateCarouselContent(productName, niche, apiKey, carouselCount);
        carouselBundleId   = await createCarouselBundle(userId, productName, slideContents);
        await send({ type: "step-done", id: "carousel", bundleId: carouselBundleId });
      } catch (carouselErr) {
        console.warn("[launch/design] Carousel generation failed (non-fatal):", carouselErr);
        await send({ type: "step-done", id: "carousel" }); // non-fatal
      }

      /* ── Phase 4: Save to product record ── */
      await send({ type: "step", id: "saving", label: "Attaching assets to Digital Product..." });

      const currentProduct = await db
        .select({
          marketingAssets: productsTable.marketingAssets,
          designSettings:  productsTable.designSettings,
          content:         productsTable.content,
        })
        .from(productsTable)
        .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId), isNull(productsTable.deletedAt)))
        .limit(1);

      if (currentProduct[0]) {
        const existingMarketing = (currentProduct[0].marketingAssets ?? {}) as Record<string, unknown>;

        const updatedMarketing = {
          ...existingMarketing,
          ...(generatedUrls.mockup          ? { bookMockupUrl:      generatedUrls.mockup }    : {}),
          ...(generatedUrls.thumbnail       ? { thumbnailUrl:       generatedUrls.thumbnail } : {}),
          ...(generatedUrls.social          ? { socialPreviewUrl:   generatedUrls.social }    : {}),
          ...(successfulConcepts.length > 0 ? { coverConcepts:      successfulConcepts }      : {}),
          ...(thumbnailDesignId             ? { thumbnailDesignId:  thumbnailDesignId }       : {}),
          // coverDesignId is read by the product editor to render the cover page canvas
          ...(primaryDesignId               ? { coverDesignId:      primaryDesignId }         : {}),
        };

        /* ── Update cover page: store primary design reference (no image URL) ── */
        const existingDs    = (currentProduct[0].designSettings ?? {}) as Record<string, unknown>;
        const sections      = (currentProduct[0].content as { sections?: unknown[] })?.sections ?? [];
        const totalPages    = sections.length + 2;
        const existingPages = (existingDs.pages as Record<string, unknown>[] | undefined) ?? [];
        const primaryDesignId = successfulConcepts[0]?.designId;

        const pages = Array.from({ length: totalPages }, (_, i) => {
          const existing = existingPages[i] ?? {};
          if (i === 0 && primaryDesignId) {
            return { ...existing, designId: primaryDesignId };
          }
          return existing;
        });

        await db
          .update(productsTable)
          .set({
            marketingAssets: updatedMarketing,
            designSettings:  { ...existingDs, pages },
            designSource:    "ai",
            updatedAt:       new Date(),
          })
          .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));
      }

      /* ── Set store banner (non-destructive — only if none already set) ── */
      if (bannerUrl) {
        try {
          const [existingStore] = await db
            .select({ bannerImageUrl: storeSettingsTable.bannerImageUrl })
            .from(storeSettingsTable)
            .where(eq(storeSettingsTable.userId, userId))
            .limit(1);

          if (!existingStore?.bannerImageUrl) {
            await db
              .insert(storeSettingsTable)
              .values({ userId, bannerImageUrl: bannerUrl, updatedAt: new Date() })
              .onConflictDoUpdate({
                target: storeSettingsTable.userId,
                set: { bannerImageUrl: bannerUrl, updatedAt: new Date() },
              });
            console.log("[launch/design] Store banner set from AI generation");
          } else {
            console.log("[launch/design] Store already has a banner — skipping auto-set");
          }
        } catch (storeErr) {
          console.warn("[launch/design] Failed to set store banner (non-fatal):", storeErr);
        }
      }

      await send({ type: "step-done", id: "saving" });

      // Concepts are design records, not images — count them separately
      const assetsCount =
        successfulConcepts.length +
        (thumbnailDesignId       ? 1 : 0) +
        (generatedUrls.mockup    ? 1 : 0) +
        (generatedUrls.thumbnail ? 1 : 0) +
        (generatedUrls.social    ? 1 : 0) +
        (bannerUrl               ? 1 : 0);

      await send({
        type:             "done",
        assets:           generatedUrls,
        assetsCount,
        concepts:         successfulConcepts,
        carouselBundleId: carouselBundleId ?? null,
        thumbnailDesignId: thumbnailDesignId ?? null,
      });

    } catch (err) {
      console.error("[launch/design]", err);
      await send({
        type:    "error",
        message: err instanceof Error ? err.message : String(err),
      }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":      "application/x-ndjson; charset=utf-8",
      "Cache-Control":     "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ─── POST handler ───────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
    }

    const body = await request.json().catch(() => ({})) as {
      productId?:    string;
      productName?:  string;
      niche?:        string;
      format?:       string;
      preferences?:  { carouselCount?: number };
    };

    const productId    = typeof body.productId   === "string" ? body.productId.trim()   : "";
    const productName  = typeof body.productName === "string" ? body.productName.trim() : "My Product";
    const niche        = typeof body.niche       === "string" ? body.niche.trim()       : "digital products";
    const format       = typeof body.format      === "string" ? body.format.trim()      : "guide";

    const VALID_COUNTS = new Set([3, 5, 8, 10]);
    const rawCount     = Number(body.preferences?.carouselCount);
    const carouselCount = VALID_COUNTS.has(rawCount) ? rawCount : 5;

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), { status: 400 });
    }

    return streamDesignGeneration(userId, productId, productName, niche, format, apiKey, carouselCount);

  } catch (err) {
    console.error("[launch/design]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
