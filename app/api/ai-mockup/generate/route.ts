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

// ─── img2img — uses the real design as reference ─────────────────────────────
async function generateImg2ImgMockup(
  designUrl: string,
  prompt: string,
  style: string,
  flat = false
): Promise<string> {
  const lightingStyle = STYLE_MAP[style] ?? STYLE_MAP.lifestyle;
  const fullPrompt = flat
    ? `${prompt}. ${lightingStyle}. The design printed on the product matches this graphic exactly. No person in shot. Photorealistic, 8K, commercial product photography.`
    : `${prompt}. The design printed on the garment matches this graphic exactly — same colours, same artwork. ${lightingStyle}. Design clearly visible. Photorealistic, 8K, commercial product photography.`;

  const res = await fetch("https://fal.run/fal-ai/flux/dev/image-to-image", {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_url: designUrl,
      strength: flat ? 0.80 : 0.85,
      image_size: flat ? "square_hd" : "portrait_4_3",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal.ai img2img error: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("No image returned from img2img");
  return url;
}

// ─── Text-only fallback ───────────────────────────────────────────────────────
async function generateTextMockup(prompt: string, style: string, flat = false): Promise<string> {
  const lightingStyle = STYLE_MAP[style] ?? STYLE_MAP.lifestyle;
  const fullPrompt = flat
    ? `${prompt}. ${lightingStyle}. No person in shot. Photorealistic, 8K, commercial product photography.`
    : `High quality photo of ${prompt}. ${lightingStyle}. The design is clearly visible. Photorealistic, 8K, commercial product photography.`;

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

    // ── Build prompt ──────────────────────────────────────────────────────────
    const placementSuffix = PLACEMENT_SUFFIX[placement] ?? "";
    let basePrompt: string;

    if (isFlat) {
      basePrompt = getProductPrompt(product.blueprintTitle, true);
    } else {
      const model = randomModel();
      const productContext = getProductPrompt(product.blueprintTitle, false).replace("person", model);
      const brandContext = product.title ? `, design themed around "${product.title}"` : "";
      basePrompt = `${productContext}${brandContext}${placementSuffix}`;
    }

    // ── Generate ──────────────────────────────────────────────────────────────
    let imageUrl: string;
    if (designFileUrl) {
      imageUrl = await generateImg2ImgMockup(designFileUrl, basePrompt, style, isFlat);
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
      .where(eq(podProductsTable.id, productId));

    return NextResponse.json({ mockupUrl: blob.url });
  } catch (err) {
    console.error("[ai-mockup/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate mockup" },
      { status: 500 }
    );
  }
}
