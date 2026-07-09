export const dynamic = "force-dynamic";
/**
 * UGC Lab — Product URL scraper
 * Supports: Amazon, Shopify, TikTok Shop
 *
 * Flow:
 *  1. Detect platform from URL
 *  2. Fetch raw product data (platform-specific strategy)
 *  3. Use OpenAI to extract structured data (title, benefits, use cases, etc.)
 *  4. Return enriched product + image URLs
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { checkSpendLimit } from "@/lib/spend-guard";
import OpenAI from "openai";

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ScrapedProduct = {
  platform: "amazon" | "shopify" | "tiktok" | "unknown";
  url: string;
  title: string;
  description: string;
  keyBenefits: string[];
  useCases: string[];
  emotionalOutcomes: string[];
  targetAudience: string;
  images: string[]; // publicly accessible image URLs
  rawText: string;  // for debugging / further AI use
};

// ─── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(url: string): "amazon" | "shopify" | "tiktok" | "unknown" {
  if (/amazon\.(com|co\.uk|ca|com\.au|de|fr|es|it|co\.jp)/i.test(url)) return "amazon";
  if (/tiktok\.com|shop\.tiktok/i.test(url)) return "tiktok";
  // Shopify: /products/ path on any domain (myshopify.com or custom domain)
  if (/myshopify\.com|\/products\//i.test(url)) return "shopify";
  return "unknown";
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

// ─── Image extraction helpers ─────────────────────────────────────────────────

function extractImgUrls(html: string, limit = 8): string[] {
  const found: string[] = [];
  // og:image first
  const ogMatches = Array.from(html.matchAll(/property="og:image(?::secure_url)?"[^>]*content="([^"]+)"/gi));
  for (const m of ogMatches) if (m[1] && !found.includes(m[1])) found.push(m[1]);
  // src= img tags
  const srcMatches = Array.from(html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"/gi));
  for (const m of srcMatches) {
    const src = m[1];
    if (src && !found.includes(src) && !src.includes("pixel") && !src.includes("tracking")) {
      found.push(src);
    }
  }
  return found.slice(0, limit);
}

// ─── Platform scrapers ────────────────────────────────────────────────────────

async function scrapeShopify(url: string): Promise<{ text: string; images: string[] }> {
  // Shopify products expose a clean JSON API at /products/{handle}.json
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/products/");
  if (pathParts.length < 2) throw new Error("Cannot extract Shopify product handle from URL");

  const handle = pathParts[1].split("?")[0].split("/")[0];
  const jsonUrl = `${urlObj.origin}/products/${handle}.json`;

  const res = await fetch(jsonUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new Error(`Shopify JSON API returned ${res.status}`);

  const data = await res.json();
  const product = data.product;
  if (!product) throw new Error("No product in Shopify JSON response");

  // Strip HTML from body_html
  const bodyText = (product.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const text = [
    `Title: ${product.title}`,
    `Vendor: ${product.vendor ?? ""}`,
    `Type: ${product.product_type ?? ""}`,
    `Tags: ${(product.tags ?? []).join(", ")}`,
    `Description: ${bodyText}`,
    product.variants?.map((v: { title: string; price: string }) => `Variant: ${v.title} — $${v.price}`).join("\n") ?? "",
  ].join("\n");

  const images: string[] = (product.images ?? [])
    .map((img: { src: string }) => img.src)
    .slice(0, 8);

  return { text, images };
}

async function scrapeAmazon(url: string): Promise<{ text: string; images: string[] }> {
  const html = await fetchHtml(url);

  // Extract title
  const titleMatch =
    html.match(/id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/i) ||
    html.match(/<title>([^|<]+)/i);
  const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";

  // Extract bullet features
  const bulletSection = html.match(/id="feature-bullets"[\s\S]*?<ul[\s\S]*?<\/ul>/i)?.[0] ?? "";
  const bullets = Array.from(bulletSection.matchAll(/<span[^>]*class="[^"]*a-list-item[^"]*"[^>]*>([\s\S]*?)<\/span>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);

  // Extract description
  const descMatch =
    html.match(/id="productDescription"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i) ||
    html.match(/id="aplus"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  const desc = descMatch?.[1]?.replace(/<[^>]+>/g, " ").trim() ?? "";

  // Extract images — Amazon stores them in a JSON blob
  const imgJsonMatch = html.match(/'colorImages'\s*:\s*\{[^}]*'initial'\s*:\s*(\[[\s\S]*?\])/);
  let images: string[] = [];
  if (imgJsonMatch) {
    try {
      const imgData = JSON.parse(imgJsonMatch[1]);
      images = imgData
        .map((img: { hiRes?: string; large?: string }) => img.hiRes || img.large)
        .filter(Boolean)
        .slice(0, 8);
    } catch {
      images = extractImgUrls(html);
    }
  } else {
    images = extractImgUrls(html);
  }

  const text = [`Title: ${title}`, `Features:\n${bullets.join("\n")}`, `Description: ${desc}`]
    .join("\n")
    .slice(0, 4000);

  return { text, images };
}

async function scrapeTikTok(url: string): Promise<{ text: string; images: string[] }> {
  // Follow redirects for short links (tiktok.com/t/...)
  const html = await fetchHtml(url);

  // TikTok Shop embeds product data in JSON-LD or __NEXT_DATA__
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  let text = "";
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      const product = Array.isArray(ld) ? ld.find((x) => x["@type"] === "Product") : ld;
      if (product) {
        text = [
          `Title: ${product.name ?? ""}`,
          `Description: ${product.description ?? ""}`,
          `Brand: ${product.brand?.name ?? ""}`,
          `SKU: ${product.sku ?? ""}`,
        ].join("\n");
      }
    } catch { /* fall through */ }
  }

  if (!text) {
    // Fallback: og tags + meta description
    const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ?? "";
    const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ?? "";
    text = `Title: ${ogTitle}\nDescription: ${ogDesc}`;
  }

  const images = extractImgUrls(html);
  return { text, images };
}

// ─── AI enrichment ────────────────────────────────────────────────────────────

async function enrichWithAI(rawText: string, platform: string): Promise<Omit<ScrapedProduct, "platform" | "url" | "images" | "rawText">> {
  const prompt = `You are extracting product marketing data from a ${platform} product page.

RAW PRODUCT TEXT:
${rawText.slice(0, 3000)}

Extract and return ONLY valid JSON in this exact shape:
{
  "title": "product name, concise",
  "description": "1-2 sentence summary of what it is and does",
  "keyBenefits": ["benefit 1", "benefit 2", "benefit 3", "benefit 4"],
  "useCases": ["use case 1", "use case 2", "use case 3"],
  "emotionalOutcomes": ["how it makes the buyer feel", "life improvement", "pain it removes"],
  "targetAudience": "who this is for in one sentence"
}

Rules:
- keyBenefits: concrete, specific, copy-ready (not vague)
- useCases: real scenarios people use this in
- emotionalOutcomes: the feeling/transformation after buying
- All arrays: 3-5 items max
- Return ONLY the JSON, no markdown, no explanation`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);

  return {
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    keyBenefits: parsed.keyBenefits ?? [],
    useCases: parsed.useCases ?? [],
    emotionalOutcomes: parsed.emotionalOutcomes ?? [],
    targetAudience: parsed.targetAudience ?? "",
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  const sg = await checkSpendLimit("openai", userId);
  if (sg) return sg;

  const body = await request.json().catch(() => ({}));
  const rawUrl = (body.url as string)?.trim();

  if (!rawUrl) return NextResponse.json({ error: "url is required" }, { status: 400 });

  let url = rawUrl;
  if (!url.startsWith("http")) url = `https://${url}`;

  const platform = detectPlatform(url);

  try {
    let rawData: { text: string; images: string[] };

    if (platform === "shopify") {
      rawData = await scrapeShopify(url);
    } else if (platform === "amazon") {
      rawData = await scrapeAmazon(url);
    } else if (platform === "tiktok") {
      rawData = await scrapeTikTok(url);
    } else {
      // Generic fallback: og tags + AI
      const html = await fetchHtml(url);
      const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ?? "";
      const ogDesc = html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ?? "";
      rawData = {
        text: `Title: ${ogTitle}\nDescription: ${ogDesc}`,
        images: extractImgUrls(html),
      };
    }

    const enriched = await enrichWithAI(rawData.text, platform);

    const result: ScrapedProduct = {
      platform,
      url,
      ...enriched,
      images: rawData.images,
      rawText: rawData.text.slice(0, 2000),
    };

    return NextResponse.json({ product: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scrape failed";
    console.error("[scrape-product] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
