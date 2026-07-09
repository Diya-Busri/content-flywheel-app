import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { isNull, desc, eq, inArray, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

type MA = {
  isNativePublished?: boolean;
  nativePrice?: number;
  priceLabel?: string | null;
  coverThumbnailUrl?: string | null;
  bookMockupUrl?: string | null;
  thumbnailUrl?: string | null;
  productDescription?: string;
  comingSoon?: boolean;
};

/**
 * GET /api/embed/marketplace
 * Query: userId (optional, filter to one creator), niche, limit (max 12), theme (light|dark)
 * Returns a self-contained JS snippet OR JSON (Accept: application/json)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? null;
  const niche  = searchParams.get("niche")?.toLowerCase() ?? null;
  const limit  = Math.min(12, Math.max(1, parseInt(searchParams.get("limit") ?? "6") || 6));
  const theme  = searchParams.get("theme") === "dark" ? "dark" : "light";
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://contentflywheel.co.uk";

  // ── Fetch active (non-deleted) seller IDs first ────────────────────────────
  const activeProfiles = await db
    .select({ userId: profilesTable.userId })
    .from(profilesTable)
    .where(and(isNull(profilesTable.deletedAt), isNull(profilesTable.hiddenFromMarketplace as never)));
  const activeSellerSet = new Set(activeProfiles.map((p) => p.userId));

  // ── Fetch products ─────────────────────────────────────────────────────────
  const rows = await db
    .select({ id: productsTable.id, title: productsTable.title, niche: productsTable.niche, format: productsTable.format, marketingAssets: productsTable.marketingAssets, userId: productsTable.userId })
    .from(productsTable)
    .where(isNull(productsTable.deletedAt))
    .orderBy(desc(productsTable.createdAt));

  const filtered = rows
    .filter((r) => {
      const ma = (r.marketingAssets ?? {}) as MA;
      if (!ma.isNativePublished || ma.comingSoon) return false;
      if (!activeSellerSet.has(r.userId)) return false; // exclude deleted/hidden creators
      if (userId && r.userId !== userId) return false;
      if (niche && r.niche.toLowerCase() !== niche) return false;
      return true;
    })
    .slice(0, limit);

  // ── Creator names ──────────────────────────────────────────────────────────
  const userIds = Array.from(new Set(filtered.map((r) => r.userId)));
  const [brandRows, storeRows] = userIds.length > 0 ? await Promise.all([
    db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName }).from(brandVoiceTable).where(inArray(brandVoiceTable.userId, userIds)),
    db.select({ userId: storeSettingsTable.userId, storeName: storeSettingsTable.storeName }).from(storeSettingsTable).where(inArray(storeSettingsTable.userId, userIds)),
  ]) : [[], []];

  const nameMap: Record<string, string> = {};
  for (const r of brandRows) nameMap[r.userId] = r.brandName?.trim() || "";
  for (const r of storeRows) if (r.storeName?.trim()) nameMap[r.userId] = r.storeName.trim();

  const items = filtered.map((r) => {
    const ma = (r.marketingAssets ?? {}) as MA;
    return {
      id: r.id,
      title: r.title,
      niche: r.niche,
      format: r.format,
      thumbnail: ma.coverThumbnailUrl ?? ma.bookMockupUrl ?? ma.thumbnailUrl ?? null,
      price: ma.nativePrice === 0 ? "Free" : ma.nativePrice ? `£${(ma.nativePrice / 100).toFixed(2)}` : ma.priceLabel ?? null,
      creator: nameMap[r.userId] || "Creator",
      url: `${APP_URL}/product/${r.id}`,
    };
  });

  // If requesting JSON directly
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return NextResponse.json({ items });
  }

  // ── Build self-contained JS widget ────────────────────────────────────────
  const bg     = theme === "dark" ? "#0B0B0F" : "#ffffff";
  const cardBg = theme === "dark" ? "#1e1e24" : "#f9fafb";
  const border = theme === "dark" ? "#2d2d35" : "#e5e7eb";
  const text   = theme === "dark" ? "#ffffff" : "#111827";
  const sub    = theme === "dark" ? "#9ca3af" : "#6b7280";
  const orange = "#f97316";

  const itemsJson = JSON.stringify(items);

  const js = `(function(){
  var items=${itemsJson};
  var host="${APP_URL}";
  var style=\`
    .cf-embed{font-family:'Helvetica Neue',Arial,sans-serif;background:${bg};border-radius:16px;padding:24px;max-width:100%;box-sizing:border-box;}
    .cf-embed-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
    .cf-embed-title{font-size:16px;font-weight:800;color:${text};margin:0;}
    .cf-embed-link{font-size:13px;color:${orange};font-weight:700;text-decoration:none;}
    .cf-embed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;}
    .cf-embed-card{background:${cardBg};border:1px solid ${border};border-radius:12px;overflow:hidden;text-decoration:none;display:block;transition:box-shadow 0.2s,transform 0.2s;}
    .cf-embed-card:hover{box-shadow:0 6px 20px rgba(0,0,0,0.12);transform:translateY(-2px);}
    .cf-embed-thumb{aspect-ratio:4/3;background:linear-gradient(135deg,#f97316,#ea580c);overflow:hidden;position:relative;}
    .cf-embed-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
    .cf-embed-thumb-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;}
    .cf-embed-body{padding:12px;}
    .cf-embed-niche{font-size:10px;font-weight:700;color:${orange};text-transform:uppercase;letter-spacing:0.05em;margin:0 0 3px;}
    .cf-embed-name{font-size:13px;font-weight:700;color:${text};margin:0 0 6px;line-height:1.3;}
    .cf-embed-meta{display:flex;align-items:center;justify-content:space-between;}
    .cf-embed-price{font-size:14px;font-weight:800;color:${text};}
    .cf-embed-creator{font-size:11px;color:${sub};}
    .cf-embed-footer{text-align:center;margin-top:16px;}
    .cf-embed-footer a{font-size:11px;color:${sub};text-decoration:none;}
    .cf-embed-footer a span{color:${orange};font-weight:700;}
  \`;
  var container=document.currentScript?document.currentScript.parentNode:document.body;
  var el=document.createElement('div');
  el.className='cf-embed';
  var cards=items.map(function(p){
    return '<a class="cf-embed-card" href="'+p.url+'" target="_blank" rel="noopener">'+
      '<div class="cf-embed-thumb">'+(p.thumbnail?'<img src="'+p.thumbnail+'" alt="'+p.title+'"/>':"<div class='cf-embed-thumb-placeholder'>📦</div>")+'</div>'+
      '<div class="cf-embed-body">'+
        '<p class="cf-embed-niche">'+p.niche+'</p>'+
        '<p class="cf-embed-name">'+p.title.slice(0,48)+(p.title.length>48?'…':'')+'</p>'+
        '<div class="cf-embed-meta">'+
          '<span class="cf-embed-price">'+(p.price||'')+'</span>'+
          '<span class="cf-embed-creator">by '+p.creator+'</span>'+
        '</div>'+
      '</div>'+
    '</a>';
  }).join('');
  el.innerHTML='<style>'+style+'</style>'+
    '<div class="cf-embed-header"><p class="cf-embed-title">🛍️ Digital Products</p><a class="cf-embed-link" href="'+host+'/marketplace" target="_blank">Browse all →</a></div>'+
    '<div class="cf-embed-grid">'+cards+'</div>'+
    '<div class="cf-embed-footer"><a href="'+host+'/marketplace" target="_blank">Powered by <span>Content Flywheel</span></a></div>';
  container.appendChild(el);
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
