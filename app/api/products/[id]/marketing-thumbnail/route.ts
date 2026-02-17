import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 30;

const COVER_WIDTH = 794;
const COVER_HEIGHT = 1123;
const THUMB_WIDTH = 1600;
const THUMB_HEIGHT = 1200;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildCoverHtml(product: {
  title?: string | null;
  niche?: string | null;
  subtitle?: string | null;
  designSettings?: {
    backgroundImage?: string | null;
    background_image?: string | null;
    pages?: Array<{ backgroundImage?: string | null; backgroundSettings?: Record<string, unknown>; overlaySettings?: Record<string, unknown> }>;
    colors?: { graphics?: string };
    subtitle?: string;
    tagline?: string;
  } | null;
}): string {
  const ds = product?.designSettings ?? {};
  const title = (product?.title ?? "Product").trim() || "Digital Product";
  const niche = (product?.niche ?? "").trim();
  const customSubtitle = (product?.subtitle ?? (ds as { subtitle?: string }).subtitle ?? (ds as { tagline?: string }).tagline ?? "").trim();
  const subtitle = customSubtitle || (niche ? `A comprehensive guide to ${escapeHtml(niche)}` : "");
  const graphicsAccentColor = (ds as { colors?: { graphics?: string } }).colors?.graphics ?? "#FF6B35";
  const pages = (ds as { pages?: Array<{ backgroundImage?: string | null }> }).pages;
  const firstPage = Array.isArray(pages) && pages[0] ? pages[0] : null;
  const legacyBg = (ds as { backgroundImage?: string }).backgroundImage ?? (ds as { background_image?: string }).background_image ?? null;
  const bgUrl = firstPage?.backgroundImage ?? legacyBg ?? null;
  const overlayColor = "rgba(255, 255, 255, 0.9)";
  const overlayOpacity = "0.9";

  let coverInner = "";
  if (bgUrl) {
    coverInner += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;"><img src="${escapeHtml(bgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center center;" /></div>`;
    coverInner += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background-color:${overlayColor};opacity:${overlayOpacity};"></div>`;
  } else {
    coverInner += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;background:linear-gradient(160deg, #fff 0%, ${graphicsAccentColor}22 100%);"></div>`;
    coverInner += `<div style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;background:rgba(255,255,255,0.75);"></div>`;
  }
  coverInner += `<div style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:60px;box-sizing:border-box;">`;
  coverInner += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%;">`;
  coverInner += `<h1 style="font-size:36px;font-weight:700;margin:0 0 16px;color:#111;line-height:1.2;">${escapeHtml(title)}</h1>`;
  if (subtitle) coverInner += `<p style="font-size:18px;margin:0;color:#555;line-height:1.4;max-width:480px;">${escapeHtml(subtitle)}</p>`;
  coverInner += `</div>`;
  coverInner += `<p style="font-size:14px;margin:0;color:#666;">Created with Content Flywheel</p>`;
  coverInner += `</div>`;

  const coverDiv = `<div style="position:relative;width:${COVER_WIDTH}px;height:${COVER_HEIGHT}px;overflow:hidden;box-sizing:border-box;background:#fff;">${coverInner}</div>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:0;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,system-ui,sans-serif}</style></head><body>${coverDiv}</body></html>`;
  return html;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser: Awaited<ReturnType<typeof import("puppeteer").default.launch>> | null = null;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

    const fullHtml = buildCoverHtml(product);
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (!baseUrl && process.env.VERCEL_URL) baseUrl = `https://${process.env.VERCEL_URL}`;
    if (!baseUrl) baseUrl = "http://localhost:3000";
    baseUrl = baseUrl.replace(/\/$/, "");

    const puppeteer = (await import("puppeteer")).default;
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: THUMB_WIDTH, height: THUMB_HEIGHT, deviceScaleFactor: 1 });
    await page.setContent(fullHtml, {
      waitUntil: "networkidle0",
      timeout: 15000,
      baseURL: baseUrl,
    });
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 800));

    const png = await page.screenshot({
      type: "png",
      fullPage: false,
    });
    await browser.close();
    browser = null;

    return new NextResponse(png as Buffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    console.error("Marketing thumbnail failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Thumbnail generation failed" },
      { status: 500 }
    );
  }
}
