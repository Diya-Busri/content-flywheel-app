/**
 * Book Mockup Generator
 * POST /api/products/[id]/book-mockup
 * Generates a realistic book-on-desk marketing mockup via DALL-E 3.
 * Saves the URL to product.marketingAssets.bookMockupUrl.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { put } from "@vercel/blob";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "product-images";

function buildMockupPrompt(title: string, niche: string, format: string): string {
  const isWorkbook = /workbook|worksheet|planner/i.test(format);
  const bookType = isWorkbook ? "spiral-bound workbook" : "hardcover book";
  const cleanTitle = title.replace(/[^a-zA-Z0-9 &:,'-]/g, "").slice(0, 60);
  const cleanNiche = niche.replace(/[^a-zA-Z0-9 &]/g, "").slice(0, 40);

  return `Professional product photography of a ${bookType} displayed on a clean light wooden desk. The book cover has the title "${cleanTitle}" printed elegantly on the front cover. The book is about ${cleanNiche}. Shot from a slight overhead angle, showing the full book cover. Soft studio lighting with a gentle shadow underneath. Minimal props — maybe a small plant or pen nearby. Shallow depth of field, bokeh background in soft warm white. Ultra-realistic commercial photography quality. No watermarks, no text overlays outside the book cover itself. High resolution, crisp edges.`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const { id: productId } = await params;
    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
    }

    const title = (product.title ?? "Digital Product").trim();
    const niche = (product.niche ?? "general").trim();
    const format = (product.format ?? "Guide").trim();

    const prompt = buildMockupPrompt(title, niche, format);

    const openai = new OpenAI({ apiKey });
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "natural",
      response_format: "b64_json",
    });

    const first = (response.data ?? [])[0];
    const b64 = (first as { b64_json?: string } | undefined)?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "Image generation returned no data" }, { status: 500 });
    }

    const buffer = Buffer.from(b64, "base64");
    let url: string;

    // Try Vercel Blob first, then Supabase, then data URL fallback
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(
          `book-mockups/${productId}/mockup-${Date.now()}.png`,
          buffer,
          { access: "public", contentType: "image/png", addRandomSuffix: false }
        );
        url = blob.url;
      } catch {
        url = `data:image/png;base64,${b64}`;
      }
    } else {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const path = `book-mockups/${productId}/mockup.png`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: "image/png", upsert: true });
        if (!error) {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
          url = urlData.publicUrl;
        } else {
          url = `data:image/png;base64,${b64}`;
        }
      } else {
        url = `data:image/png;base64,${b64}`;
      }
    }

    // Save to marketingAssets
    const currentAssets = (product.marketingAssets ?? {}) as Record<string, unknown>;
    await db
      .update(productsTable)
      .set({
        marketingAssets: { ...currentAssets, bookMockupUrl: url },
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productsTable.id, productId),
          eq(productsTable.userId, userId),
          isNull(productsTable.deletedAt)
        )
      );

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[book-mockup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mockup generation failed" },
      { status: 500 }
    );
  }
}
