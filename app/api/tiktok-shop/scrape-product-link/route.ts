/**
 * TikTok Shop — Product link scraper
 *
 * Strategies (in order):
 *  1. Validate & classify the URL (TikTok product page, short link, video, generic)
 *  2. Fetch HTML with realistic browser headers — follow all redirects
 *  3. Extract from JSON-LD (@type Product)
 *  4. Extract from TikTok's __NEXT_DATA__ / SSR blobs
 *  5. Extract from og / meta tags
 *  6. Use GPT-4o-mini to parse any usable text into structured data
 *  7. On failure return { success: false, error: "human-readable message" }
 *
 * All decisions are logged with [tiktok-scrape] prefix for easy debugging.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { checkSpendLimit } from "@/lib/spend-guard";
import OpenAI from "openai";

export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScrapedTikTokProduct = {
  title: string;
  description: string;
  price: string | null;
  images: string[];
  features: string[];
  platform: "tiktok_shop" | "tiktok_video" | "tiktok_short" | "unknown";
  finalUrl: string;
};

type ScrapeResult =
  | { success: true; product: ScrapedTikTokProduct }
  | { success: false; error: string };

// ─── URL classification ───────────────────────────────────────────────────────

type TikTokUrlType = "product" | "short" | "video" | "unknown";

function classifyTikTokUrl(url: string): TikTokUrlType {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    // Direct product page: shop.tiktok.com/view/product/ID or tiktok.com/view/product/ID
    if (
      path.includes("/view/product/") ||
      path.includes("/product/") ||
      host === "shop.tiktok.com"
    ) {
      return "product";
    }
    // Short links: tiktok.com/t/XXX  or  vt.tiktok.com/XXX
    if (host === "vt.tiktok.com" || path.startsWith("/t/")) {
      return "short";
    }
    // Video page: tiktok.com/@user/video/ID
    if (path.includes("/video/")) {
      return "video";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function isTikTokUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("tiktok.com") ||
      host === "vt.tiktok.com" ||
      host.endsWith("shop.tiktok.com")
    );
  } catch {
    return false;
  }
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

// Rotate through UAs — TikTok checks these
const USER_AGENTS = [
  // Desktop Chrome (most permissive for TikTok web)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  // Mobile Safari — TikTok Shop is mobile-first
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  // Android Chrome
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
];

function buildHeaders(ua: string): HeadersInit {
  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
  };
}

async function fetchWithFallback(url: string): Promise<{ html: string; finalUrl: string; status: number }> {
  let lastErr: unknown;

  for (let i = 0; i < USER_AGENTS.length; i++) {
    const ua = USER_AGENTS[i]!;
    console.log(`[tiktok-scrape] Fetch attempt ${i + 1}/${USER_AGENTS.length} UA="${ua.slice(0, 40)}..."`);
    try {
      const res = await fetch(url, {
        headers: buildHeaders(ua),
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      const finalUrl = res.url ?? url;
      const html = await res.text();
      console.log(`[tiktok-scrape] Fetch status=${res.status} finalUrl=${finalUrl} htmlLen=${html.length}`);
      return { html, finalUrl, status: res.status };
    } catch (err) {
      lastErr = err;
      console.warn(`[tiktok-scrape] Fetch attempt ${i + 1} failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw lastErr ?? new Error("All fetch attempts failed");
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

function extractMeta(html: string, property: string): string | null {
  const patterns = [
    // property="…" content="…"
    new RegExp(`<meta[^>]+property=["']${property.replace(/:/g, "\\:")}["'][^>]+content=["']([^"']{1,800})["']`, "i"),
    // content="…" property="…"
    new RegExp(`<meta[^>]+content=["']([^"']{1,800})["'][^>]+property=["']${property.replace(/:/g, "\\:")}["']`, "i"),
    // name="…"
    new RegExp(`<meta[^>]+name=["']${property.replace(/:/g, "\\:")}["'][^>]+content=["']([^"']{1,800})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']{1,800})["'][^>]+name=["']${property.replace(/:/g, "\\:")}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  // Match all <script type="application/ld+json"> blocks
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]!);
      if (Array.isArray(parsed)) results.push(...parsed);
      else results.push(parsed);
    } catch { /* skip malformed */ }
  }
  return results;
}

function findProductInJsonLd(items: unknown[]): {
  name?: string;
  description?: string;
  image?: string | string[];
  price?: string;
  offers?: { price?: string | number; priceCurrency?: string };
} | null {
  for (const item of items) {
    if (typeof item !== "object" || !item) continue;
    const obj = item as Record<string, unknown>;
    if (obj["@type"] === "Product" || obj["@type"] === "ItemPage") {
      return obj as never;
    }
    // Nested @graph
    const graph = obj["@graph"];
    if (Array.isArray(graph)) {
      const nested = findProductInJsonLd(graph);
      if (nested) return nested;
    }
  }
  return null;
}

function extractNextData(html: string): unknown {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  try {
    return JSON.parse(m[1]!);
  } catch {
    return null;
  }
}

/** Dig into TikTok's __NEXT_DATA__ structure to find product name/description/price */
function extractFromNextData(data: unknown): Partial<{ name: string; description: string; price: string; images: string[] }> {
  if (typeof data !== "object" || !data) return {};

  const str = JSON.stringify(data);

  // Product data is usually under props.pageProps.product or similar
  const nameMatch = str.match(/"(?:title|product_title|name)"\s*:\s*"([^"]{3,200})"/);
  const descMatch = str.match(/"(?:description|product_description|desc)"\s*:\s*"([^"]{10,1000})"/);
  const priceMatch = str.match(/"(?:price|real_price|priceValue|sale_price)"\s*:\s*"?(\d[\d.,]*)"/);

  // Image URLs in Next data
  const imgRe = /"(https:\/\/[^"]*(?:tiktok|tiktokshop|tiktokv)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  const images: string[] = [];
  let imgM: RegExpExecArray | null;
  while ((imgM = imgRe.exec(str)) !== null && images.length < 6) {
    if (!images.includes(imgM[1]!)) images.push(imgM[1]!);
  }

  return {
    name: nameMatch?.[1],
    description: descMatch?.[1],
    price: priceMatch?.[1],
    images,
  };
}

function extractImagesFromHtml(html: string, limit = 6): string[] {
  const found: string[] = [];

  // og:image first
  const ogImg = extractMeta(html, "og:image");
  if (ogImg?.startsWith("http")) found.push(ogImg);

  // twitter:image
  const twImg = extractMeta(html, "twitter:image");
  if (twImg?.startsWith("http") && !found.includes(twImg)) found.push(twImg);

  // img src with tiktok/cdn hosts
  const re = /<img[^>]+src="(https:\/\/[^"]*(?:tiktok|p16|p19|p77|cdn)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && found.length < limit) {
    if (!found.includes(m[1]!)) found.push(m[1]!);
  }

  return found.slice(0, limit);
}

function extractPriceFromHtml(html: string): string | null {
  // Look for common price patterns: $12.99, ¥120, £9.50, etc.
  const m = html.match(/(?:price|Price|PRICE)[^$¥£€]*?([¥£€$]\s*\d[\d.,]+|\d[\d.,]+\s*[¥£€$])/);
  if (m?.[1]) return m[1].trim();
  // TikTok price formats: "1299" cents or plain number near currency
  const m2 = html.match(/"(?:real_price|price_display|formattedPrice)"\s*:\s*"([^"]{1,20})"/i);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

// ─── AI enrichment ────────────────────────────────────────────────────────────

async function enrichWithAI(rawText: string): Promise<{ features: string[]; description: string }> {
  const prompt = `You are analysing a TikTok Shop product page. Extract structured marketing data.

TEXT:
${rawText.slice(0, 2500)}

Return ONLY valid JSON:
{
  "features": ["feature 1","feature 2","feature 3"],
  "description": "1-2 sentence product summary"
}

Rules:
- features: 3-5 concrete, specific benefits (not vague)
- description: plain-English summary from the available text
- If text is insufficient, return empty arrays/strings
- Return ONLY the JSON, no markdown`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    return {
      features: Array.isArray(parsed.features) ? parsed.features : [],
      description: typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch (err) {
    console.error("[tiktok-scrape] AI enrichment failed:", err);
    return { features: [], description: "" };
  }
}

// ─── Main scrape function ─────────────────────────────────────────────────────

async function scrapeTikTokProduct(url: string): Promise<ScrapeResult> {
  console.log("[tiktok-scrape] ── START ──────────────────────────────────────");
  console.log("[tiktok-scrape] Input URL:", url);

  // Validate
  if (!isTikTokUrl(url)) {
    console.log("[tiktok-scrape] URL is not TikTok:", url);
    return { success: false, error: "URL does not appear to be a TikTok link." };
  }

  const urlType = classifyTikTokUrl(url);
  console.log("[tiktok-scrape] URL type:", urlType);

  // Fetch
  let html: string;
  let finalUrl: string;
  let httpStatus: number;

  try {
    const result = await fetchWithFallback(url);
    html = result.html;
    finalUrl = result.finalUrl;
    httpStatus = result.status;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tiktok-scrape] All fetches failed:", msg);
    return {
      success: false,
      error: "We couldn't read this link. Please paste the product name/description or upload an image.",
    };
  }

  console.log(`[tiktok-scrape] Fetch OK status=${httpStatus} finalUrl=${finalUrl}`);

  // Detect bot-detection / login redirect
  const isBlocked =
    httpStatus === 403 ||
    httpStatus === 429 ||
    html.includes("verify you are human") ||
    html.includes("Enable JavaScript") ||
    html.includes("captcha") ||
    html.includes("robot") ||
    (html.length < 800 && !html.includes("og:title"));

  if (isBlocked) {
    console.warn("[tiktok-scrape] Bot-detection triggered. htmlLen:", html.length);
    return {
      success: false,
      error: "We couldn't read this link. Please paste the product name/description or upload an image.",
    };
  }

  // ── Strategy 1: JSON-LD ──────────────────────────────────────────────────
  console.log("[tiktok-scrape] Trying Strategy 1: JSON-LD");
  const jsonLdItems = extractJsonLd(html);
  const ldProduct = findProductInJsonLd(jsonLdItems);
  console.log("[tiktok-scrape] JSON-LD items found:", jsonLdItems.length, "product hit:", !!ldProduct);

  let title = "";
  let description = "";
  let price: string | null = null;
  const images: string[] = [];

  if (ldProduct) {
    title = typeof ldProduct.name === "string" ? ldProduct.name.trim() : "";
    description = typeof ldProduct.description === "string" ? ldProduct.description.trim() : "";
    const ldOffers = ldProduct.offers;
    if (ldOffers?.price) price = String(ldOffers.price);
    // Images from JSON-LD
    const ldImages = ldProduct.image;
    if (typeof ldImages === "string" && ldImages.startsWith("http")) images.push(ldImages);
    else if (Array.isArray(ldImages)) {
      for (const img of ldImages) {
        if (typeof img === "string" && img.startsWith("http") && !images.includes(img)) {
          images.push(img);
          if (images.length >= 6) break;
        }
      }
    }
  }

  // ── Strategy 2: __NEXT_DATA__ ────────────────────────────────────────────
  console.log("[tiktok-scrape] Trying Strategy 2: __NEXT_DATA__");
  const nextData = extractNextData(html);
  if (nextData) {
    const nd = extractFromNextData(nextData);
    if (!title && nd.name) title = nd.name;
    if (!description && nd.description) description = nd.description;
    if (!price && nd.price) price = nd.price;
    if (nd.images) {
      for (const img of nd.images) {
        if (!images.includes(img)) images.push(img);
        if (images.length >= 6) break;
      }
    }
  }
  console.log("[tiktok-scrape] After __NEXT_DATA__: title=", title?.slice(0, 60));

  // ── Strategy 3: og / meta tags ───────────────────────────────────────────
  console.log("[tiktok-scrape] Trying Strategy 3: og/meta tags");
  if (!title) title = extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title") ?? extractTitle(html) ?? "";
  if (!description) description = extractMeta(html, "og:description") ?? extractMeta(html, "twitter:description") ?? "";
  if (!price) price = extractPriceFromHtml(html);

  const htmlImages = extractImagesFromHtml(html);
  for (const img of htmlImages) {
    if (!images.includes(img)) images.push(img);
    if (images.length >= 6) break;
  }

  console.log("[tiktok-scrape] After og/meta: title=", title?.slice(0, 60), "desc_len=", description?.length, "images=", images.length);

  // ── Check if we have anything meaningful ────────────────────────────────
  const hasTitle = title.trim().length > 2;
  const hasDescription = description.trim().length > 10;

  console.log("[tiktok-scrape] Extraction result: hasTitle=", hasTitle, "hasDesc=", hasDescription, "imageCount=", images.length);

  if (!hasTitle && !hasDescription) {
    console.warn("[tiktok-scrape] Nothing extracted — returning failure");
    return {
      success: false,
      error: "We couldn't read this link. Please paste the product name/description or upload an image.",
    };
  }

  // ── Strategy 4: AI enrichment for features ───────────────────────────────
  console.log("[tiktok-scrape] Running AI enrichment");
  const rawText = [title, description, html.slice(0, 3000)].filter(Boolean).join("\n");
  const aiResult = await enrichWithAI(rawText);
  console.log("[tiktok-scrape] AI enrichment done: features=", aiResult.features.length, "desc=", !!aiResult.description);

  // Prefer AI description if the og:description is just boilerplate
  const finalDescription = aiResult.description.length > 20 && description.length < 30
    ? aiResult.description
    : description || aiResult.description;

  const platformMap: Record<string, ScrapedTikTokProduct["platform"]> = {
    product: "tiktok_shop",
    short: "tiktok_short",
    video: "tiktok_video",
    unknown: "unknown",
  };

  const product: ScrapedTikTokProduct = {
    title: title || "TikTok Shop Product",
    description: finalDescription,
    price,
    images,
    features: aiResult.features,
    platform: platformMap[urlType] ?? "unknown",
    finalUrl,
  };

  console.log("[tiktok-scrape] ── SUCCESS ─────────────────────────────────────");
  console.log("[tiktok-scrape] title:", product.title.slice(0, 80));
  console.log("[tiktok-scrape] images:", product.images.length);
  console.log("[tiktok-scrape] features:", product.features.length);
  console.log("[tiktok-scrape] price:", product.price);

  return { success: true, product };
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

  console.log("[tiktok-scrape] POST received. url=", rawUrl);

  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let url = rawUrl;
  if (!url.startsWith("http")) url = `https://${url}`;

  const result = await scrapeTikTokProduct(url);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, product: result.product });
}
