import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your Download | Content Flywheel" };

export default async function DownloadPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { productId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  // Validate order token
  const [order] = await db
    .select({ id: productOrdersTable.id, buyerName: productOrdersTable.buyerName, downloadExpiresAt: productOrdersTable.downloadExpiresAt, status: productOrdersTable.status })
    .from(productOrdersTable)
    .where(and(eq(productOrdersTable.downloadToken, token), eq(productOrdersTable.productId, productId), eq(productOrdersTable.status, "completed")))
    .limit(1);

  if (!order) {
    return (
      <main style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 40px", boxShadow: "0 8px 40px rgba(0,0,0,0.1)", maxWidth: "460px", width: "100%", margin: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
          <h1 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Link invalid or expired</h1>
          <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: 1.6 }}>This download link is no longer valid. Please check your email for the original link, or contact support.</p>
          <a href="mailto:hello@contentflywheel.co.uk" style={{ display: "inline-block", padding: "12px 28px", borderRadius: "10px", background: "#f97316", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: "15px" }}>
            Contact Support
          </a>
        </div>
      </main>
    );
  }

  const expired = order.downloadExpiresAt && order.downloadExpiresAt < new Date();
  if (expired) {
    return (
      <main style={{ minHeight: "100vh", background: "#f5f4f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ background: "#fff", borderRadius: "20px", padding: "48px 40px", boxShadow: "0 8px 40px rgba(0,0,0,0.1)", maxWidth: "460px", width: "100%", margin: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏰</div>
          <h1 style={{ margin: "0 0 12px", fontSize: "22px", fontWeight: 800, color: "#111827" }}>Download link expired</h1>
          <p style={{ margin: "0 0 24px", fontSize: "15px", color: "#6b7280", lineHeight: 1.6 }}>Your link has expired. Reply to your purchase confirmation email and we&apos;ll send you a fresh link.</p>
          <a href="mailto:hello@contentflywheel.co.uk" style={{ display: "inline-block", padding: "12px 28px", borderRadius: "10px", background: "#f97316", color: "#fff", fontWeight: 700, textDecoration: "none", fontSize: "15px" }}>
            Request New Link
          </a>
        </div>
      </main>
    );
  }

  // Fetch product + brand
  const [product, bv] = await Promise.all([
    db.select({ title: productsTable.title, format: productsTable.format, marketingAssets: productsTable.marketingAssets, userId: productsTable.userId })
      .from(productsTable).where(eq(productsTable.id, productId)).limit(1).then(r => r[0]),
    db.select({ brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable).limit(1).then(r => r[0]).catch(() => undefined),
  ]);

  if (!product) notFound();

  const ma = (product.marketingAssets ?? {}) as { productTitle?: string; bookMockupUrl?: string; coverThumbnailUrl?: string; thumbnailUrl?: string };
  const displayTitle = ma.productTitle || product.title;
  const coverImage = ma.bookMockupUrl ?? ma.coverThumbnailUrl ?? ma.thumbnailUrl ?? null;
  const creatorName = bv?.brandName ?? "Content Flywheel";
  const downloadUrl = `/api/products/${productId}/download?token=${token}`;
  const expiryDate = order.downloadExpiresAt ? new Date(order.downloadExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const formatLabel = product.format ? product.format.charAt(0).toUpperCase() + product.format.slice(1) : "Digital Product";

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #f5f4f0 50%, #fef3c7 100%)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: "15px", color: "#111827" }}>{creatorName}</span>
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>Powered by <span style={{ color: "#f97316", fontWeight: 600 }}>Content Flywheel</span></span>
      </nav>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 16px 80px" }}>
        {/* Success banner */}
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "14px", padding: "16px 20px", marginBottom: "32px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "22px" }}>🎉</span>
          <div>
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "14px", color: "#166534" }}>Purchase confirmed!</p>
            <p style={{ margin: 0, fontSize: "13px", color: "#16a34a" }}>Your download is ready. Click the button below to get your file.</p>
          </div>
        </div>

        {/* Product card */}
        <div style={{ background: "#fff", borderRadius: "24px", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
          {/* Cover image */}
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt={displayTitle} style={{ width: "100%", maxHeight: "260px", objectFit: "cover", display: "block" }} />
          )}
          {!coverImage && (
            <div style={{ width: "100%", height: "160px", background: "linear-gradient(135deg,#fff7ed,#fed7aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "52px" }}>
              📦
            </div>
          )}

          <div style={{ padding: "28px 32px 32px" }}>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", background: "#fff7ed", border: "1px solid #fed7aa", fontSize: "11px", fontWeight: 700, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
              {formatLabel}
            </span>
            <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{displayTitle}</h1>
            {order.buyerName && (
              <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6b7280" }}>Hi {order.buyerName} 👋 — here&apos;s your file!</p>
            )}

            {/* Download button */}
            <a
              href={downloadUrl}
              download
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                width: "100%", padding: "16px 24px", borderRadius: "14px",
                background: "linear-gradient(135deg,#f97316 0%,#ea580c 100%)",
                color: "#fff", fontSize: "17px", fontWeight: 800, textDecoration: "none",
                boxShadow: "0 6px 24px rgba(249,115,22,0.4)", letterSpacing: "-0.2px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Your File
            </a>

            {expiryDate && (
              <p style={{ margin: "12px 0 0", fontSize: "12px", color: "#9ca3af", textAlign: "center" }}>
                This link is valid until {expiryDate}
              </p>
            )}
          </div>
        </div>

        {/* Help card */}
        <div style={{ background: "#fff", borderRadius: "16px", padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <p style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "#111827" }}>Need help?</p>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>If your file doesn&apos;t download or you have any issues, reply to your purchase email or contact us directly.</p>
          <a href="mailto:hello@contentflywheel.co.uk" style={{ fontSize: "13px", color: "#f97316", fontWeight: 600, textDecoration: "none" }}>
            hello@contentflywheel.co.uk
          </a>
        </div>
      </div>
    </main>
  );
}
