import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { podProductsTable } from "@/db/schema/pod-products-schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const FAL_API_KEY = () => {
  const key = process.env.FAL_API_KEY?.trim();
  if (!key) throw new Error("FAL_API_KEY is not set");
  return key;
};

// ─── Product prompts (lifestyle — person wearing the product) ────────────────
// Order matters: more specific terms must come before generic ones
const PRODUCT_PROMPTS: Array<{ key: string; prompt: string }> = [
  { key: "hooded sweatshirt", prompt: "person wearing a custom printed pullover hoodie with hood up" },
  { key: "hoodie",            prompt: "person wearing a custom printed pullover hoodie with hood up" },
  { key: "zip",               prompt: "person wearing a custom printed zip-up hoodie" },
  { key: "t-shirt",           prompt: "person wearing a custom printed t-shirt" },
  { key: "tee",               prompt: "person wearing a custom printed t-shirt" },
  { key: "sweatshirt",        prompt: "person wearing a custom printed crewneck sweatshirt" },
  { key: "mug",               prompt: "lifestyle photo of a custom printed ceramic mug on a wooden desk" },
  { key: "poster",            prompt: "framed poster print on a modern apartment wall" },
  { key: "tote",              prompt: "person carrying a custom printed canvas tote bag" },
  { key: "phone case",        prompt: "person holding a smartphone with a custom printed case" },
  { key: "hat",               prompt: "person wearing a custom printed baseball cap" },
  { key: "cap",               prompt: "person wearing a custom printed baseball cap" },
];

// ─── Flat lay prompts (product only, no person) ──────────────────────────────
const PRODUCT_FLAT_PROMPTS: Array<{ key: string; prompt: string }> = [
  { key: "hooded sweatshirt", prompt: "flat lay overhead photo of a pullover hoodie with a custom printed graphic on the front" },
  { key: "hoodie",            prompt: "flat lay overhead photo of a pullover hoodie with a custom printed graphic on the front" },
  { key: "zip",               prompt: "flat lay overhead photo of a zip-up hoodie with a custom printed graphic" },
  { key: "t-shirt",           prompt: "flat lay overhead photo of a t-shirt with a custom printed graphic on the front" },
  { key: "tee",               prompt: "flat lay overhead photo of a t-shirt with a custom printed graphic on the front" },
  { key: "sweatshirt",        prompt: "flat lay overhead photo of a crewneck sweatshirt with a custom printed graphic" },
  { key: "mug",               prompt: "overhead product photo of a custom printed ceramic mug on a white marble surface" },
  { key: "poster",            prompt: "overhead product photo of a custom printed art poster on a clean surface" },
  { key: "tote",              prompt: "flat lay overhead photo of a custom printed canvas tote bag" },
  { key: "phone case",        prompt: "flat lay overhead product photo of a custom printed phone case" },
  { key: "hat",               prompt: "flat lay overhead photo of a custom printed baseball cap" },
  { key: "cap",               prompt: "flat lay overhead photo of a custom printed baseball cap" },
];

function getProductPrompt(blueprintTitle: string | null, flat = false): string {
  const list = flat ? PRODUCT_FLAT_PROMPTS : PRODUCT_PROMPTS;
  const fallback = flat
    ? "flat lay overhead photo of custom branded merchandise"
    : "person wearing custom branded merchandise";
  if (!blueprintTitle) return fallback;
  const lower = blueprintTitle.toLowerCase();
  for (const { key, prompt } of list) {
    if (lower.includes(key)) return prompt;
  }
  return fallback;
}

// ─── Extract dominant garment colour from variant titles ─────────────────────
const GARMENT_COLORS = [
  "black", "white", "navy", "grey", "gray", "charcoal", "dark heather",
  "heather grey", "red", "burgundy", "maroon", "forest green", "olive",
  "green", "blue", "royal blue", "sky blue", "yellow", "mustard",
  "orange", "pink", "purple", "lavender", "brown", "tan", "beige",
  "cream", "sand", "coral", "teal", "mint", "light blue", "ash",
];

function extractDominantColor(variants: unknown): string | null {
  const list = Array.isArray(variants) ? (variants as Array<{ title?: string }>) : [];
  if (!list.length) return null;
  const allText = list.map((v) => (v.title ?? "").toLowerCase()).join(" ");
  for (const color of GARMENT_COLORS) {
    if (allText.includes(color)) return color;
  }
  return null;
}

// ─── Diverse model descriptors ───────────────────────────────────────────────
const MODEL_DESCRIPTORS = [
  "a young Black woman",
  "a young white man",
  "a young South Asian woman",
  "a young Latino man",
  "a young East Asian woman",
  "a young mixed-race man",
  "a young white woman",
  "a young Black man",
  "a young Middle Eastern woman",
  "a young South Asian man",
];

function randomModel(): string {
  return MODEL_DESCRIPTORS[Math.floor(Math.random() * MODEL_DESCRIPTORS.length)];
}

// ─── Lighting/context per mockup style ──────────────────────────────────────
const STYLE_MAP: Record<string, string> = {
  lifestyle: "natural daylight, urban street photography, candid lifestyle shot",
  studio:    "clean white studio background, professional product photography",
  outdoor:   "golden hour outdoor lighting, nature background, editorial fashion",
  flat:      "white background, overhead studio lighting, clean product photography",
};

// ─── Placement-aware prompt suffix ──────────────────────────────────────────
const PLACEMENT_SUFFIX: Record<string, string> = {
  front:         "",
  back:          ", photographed from behind showing the back of the garment with the design visible",
  left_sleeve:   ", arm raised showing the left sleeve design",
  right_sleeve:  ", arm raised showing the right sleeve design",
  label:         ", collar folded to clearly show the neck label/tag inside the garment",
};

// ─── Virtual Try-On model images ─────────────────────────────────────────────
// Neutral standing poses, diverse models. Using Picsum for reliable access.
// These get re-hosted to Vercel Blob on first use so fal.ai can always download them.
const TRYON_MODEL_SOURCES = [
  // Diverse models in neutral poses — IDs chosen for plain/light clothing
  "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
  "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
  "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
  "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
  "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
  "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400&h=600&fit=crop",
];

// In-memory cache: original URL → Vercel Blob URL
// Persists for the lifetime of the server process (resets on cold start, refills as needed).
const modelBlobCache = new Map<string, string>();

/**
 * Fetch a model image from its source URL and re-host it on Vercel Blob.
 * Cached so each image is only uploaded once per server process.
 * fal.ai can always download from Vercel Blob (public CDN).
 */
async function getModelBlobUrl(sourceUrl: string): Promise<string> {
  const cached = modelBlobCache.get(sourceUrl);
  if (cached) return cached;

  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentFlywheel/1.0)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch model image (${res.status}): ${sourceUrl}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  // Derive a stable key from the URL so repeated cold-starts reuse the same blob
  const slug = sourceUrl.replace(/[^a-z0-9]/gi, "-").slice(-60);
  const blob = await put(`pod-mockups/tryon-models/${slug}.jpg`, buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: false,
  });

  modelBlobCache.set(sourceUrl, blob.url);
  return blob.url;
}

function randomTryOnModelSource(): string {
  return TRYON_MODEL_SOURCES[Math.floor(Math.random() * TRYON_MODEL_SOURCES.length)];
}

// Map blueprint title to cloth_type for CatVTON
function getClothType(blueprintTitle: string | null): "upper" | "lower" | "overall" {
  const t = (blueprintTitle ?? "").toLowerCase();
  if (t.includes("hoodie") || t.includes("sweatshirt") || t.includes("t-shirt") || t.includes("tee") || t.includes("jacket") || t.includes("top")) return "upper";
  if (t.includes("jogger") || t.includes("pant") || t.includes("short") || t.includes("legging")) return "lower";
  return "upper"; // default to upper for most garments
}

// ─── Virtual Try-On via CatVTON ───────────────────────────────────────────────
async function generateTryOnMockup(
  garmentImageUrl: string,
  blueprintTitle: string | null
): Promise<string> {
  // Re-host the model image on Vercel Blob so fal.ai can reliably download it
  const humanImageUrl = await getModelBlobUrl(randomTryOnModelSource());
  const clothType = getClothType(blueprintTitle);

  const res = await fetch("https://fal.run/fal-ai/cat-vton", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      human_image_url: humanImageUrl,
      garment_image_url: garmentImageUrl,
      cloth_type: clothType,
      image_size: "portrait_4_3",
      num_inference_steps: 30,
      guidance_scale: 2.5,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai try-on error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { image?: { url: string }; images?: Array<{ url: string }> };
  const url = data.image?.url ?? data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from try-on");
  return url;
}

// ─── Text-only fallback ───────────────────────────────────────────────────────
async function generateTextMockup(prompt: string, style: string, flat = false): Promise<string> {
  const lightingStyle = STYLE_MAP[style] ?? STYLE_MAP.lifestyle;
  const fullPrompt = flat
    ? `${prompt}. ${lightingStyle}. No person in shot. Clean background, sharp product photo. Photorealistic, 8K, commercial product photography.`
    : `High quality lifestyle photo of ${prompt}. ${lightingStyle}. Bold graphic clearly printed on the garment. Photorealistic, 8K, commercial product photography.`;

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_size: flat ? "square_hd" : "portrait_4_3",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai text mockup error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from text mockup");
  return url;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const {
      productId,
      style = "lifestyle",
      placement = "front",
    } = await req.json() as { productId?: string; style?: string; placement?: string };

    if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

    const [product] = await db
      .select()
      .from(podProductsTable)
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)))
      .limit(1);

    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const isFlat = style === "flat";

    // ── Resolve which design to use for this placement ────────────────────────
    let designFileUrl: string | null = product.designFileUrl ?? null;
    if (placement !== "front") {
      const allPlacements = (product.placements as Array<{ position: string; designFileUrl: string }> | null) ?? [];
      const placementData = allPlacements.find((p) => p.position === placement);
      if (placementData?.designFileUrl) {
        designFileUrl = placementData.designFileUrl;
      }
    }

    // ── Build prompt (used for text fallback) ─────────────────────────────────
    const placementSuffix = PLACEMENT_SUFFIX[placement] ?? "";
    const garmentColor = extractDominantColor(product.variants);
    const colorPrefix = garmentColor ? `${garmentColor} ` : "";
    let basePrompt: string;

    if (isFlat) {
      const flatBase = getProductPrompt(product.blueprintTitle, true);
      basePrompt = garmentColor
        ? flatBase.replace(/\bof (a|an) /i, `of $1 ${colorPrefix}`)
        : flatBase;
    } else {
      const model = randomModel();
      const productBase = getProductPrompt(product.blueprintTitle, false).replace("person", model);
      const productContext = garmentColor
        ? productBase.replace(/\b(wearing (?:a|an)) /i, `$1 ${colorPrefix}`)
        : productBase;
      const brandContext = product.title ? `, design themed around "${product.title}"` : "";
      basePrompt = `${productContext}${brandContext}${placementSuffix}`;
    }

    // ── Generate ──────────────────────────────────────────────────────────────
    // For lifestyle shots with a design file: use CatVTON virtual try-on.
    // The model image is re-hosted to Vercel Blob so fal.ai can always download it.
    // For flat lay or no design file: fall back to text-to-image.
    let imageUrl: string;
    if (!isFlat && designFileUrl) {
      imageUrl = await generateTryOnMockup(designFileUrl, product.blueprintTitle ?? null);
    } else {
      imageUrl = await generateTextMockup(basePrompt, style, isFlat);
    }

    // ── Persist to Vercel Blob ────────────────────────────────────────────────
    const imageRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const blob = await put(
      `pod-mockups/${userId}/${productId}/${Date.now()}.jpg`,
      buffer,
      { access: "public", contentType: "image/jpeg" }
    );

    // ── Append to product's mockupUrls ────────────────────────────────────────
    const currentMockups = (product.mockupUrls as string[] | null) ?? [];
    await db
      .update(podProductsTable)
      .set({ mockupUrls: [...currentMockups, blob.url], aiMockupPrompt: basePrompt })
      .where(and(eq(podProductsTable.id, productId), eq(podProductsTable.userId, userId)));

    return NextResponse.json({ mockupUrl: blob.url });
  } catch (err) {
    console.error("[ai-mockup/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate mockup" },
      { status: 500 }
    );
  }
}
