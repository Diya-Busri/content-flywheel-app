export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and, isNull } from "drizzle-orm";

const THUMB_WIDTH = 1600;
const THUMB_HEIGHT = 1200;
const MOCKUP_WIDTH = 800;
const MOCKUP_HEIGHT = 1060;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let browser: Awaited<ReturnType<typeof import("puppeteer").default["launch"]>> | null = null;

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

    const ds = (product.designSettings ?? {}) as Record<string, unknown>;
    const pages = ds.pages as Array<{ backgroundImage?: string }> | undefined;
    const legacyBg = (ds.backgroundImage ?? ds.background_image) as string | null;
    const coverBgUrl =
      (Array.isArray(pages) && pages[0]?.backgroundImage) || legacyBg || null;
    const accentColor = ((ds.colors as { graphics?: string })?.graphics ?? "#FF6B35") as string;
    const title = (product.title ?? "Product").toString();
    const niche = (product.niche ?? "").toString();
    const subtitle = niche ? `A comprehensive guide to ${escapeHtml(niche)}` : "";

    const mockupBg = coverBgUrl
      ? `<div style="position:absolute;inset:0;z-index:0;"><img src="${escapeHtml(coverBgUrl)}" alt="" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;" /></div>
         <div style="position:absolute;inset:0;z-index:1;background:rgba(255,255,255,0.85);"></div>`
      : `<div style="position:absolute;inset:0;z-index:0;background:linear-gradient(160deg,#fff 0%,${accentColor}22 50%,${accentColor}33 100%);"></div>
         <div style="position:absolute;inset:0;z-index:1;background:rgba(255,255,255,0.75);"></div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}body{margin:0;padding:0;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body>
  <div style="width:${MOCKUP_WIDTH}px;height:${MOCKUP_HEIGHT}px;position:relative;border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
    ${mockupBg}
    <div style="position:relative;z-index:10;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:48px;box-sizing:border-box;">
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <h1 style="font-size:32px;font-weight:700;margin:0 0 12px;color:#111;line-height:1.2;font-family:system-ui,sans-serif;">${escapeHtml(title)}</h1>
        ${subtitle ? `<p style="font-size:16px;margin:0;color:#555;font-family:system-ui,sans-serif;">${subtitle}</p>` : ""}
      </div>
      <p style="font-size:12px;margin:0;color:#666;font-family:system-ui,sans-serif;">Created with Content Flywheel</p>
    </div>
  </div>
</body></html>`;

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const { launchPuppeteerBrowser } = require("@/lib/puppeteer-launch");
    browser = await launchPuppeteerBrowser();
    const page = await browser!.newPage();
    await page.setViewport({ width: THUMB_WIDTH, height: THUMB_HEIGHT });
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 15000,
    } as any);
    await page.evaluate(() => document.fonts?.ready);
    await new Promise((r) => setTimeout(r, 500));

    const buffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: THUMB_WIDTH, height: THUMB_HEIGHT },
    });
    await browser!.close();
    browser = null;

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${encodeURIComponent(title.replace(/\s+/g, "-").slice(0, 50))}-thumbnail.png"`,
      },
    });
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
    console.error("Thumbnail generation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Thumbnail failed" },
      { status: 500 }
    );
  }
}
