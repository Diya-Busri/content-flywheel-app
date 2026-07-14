import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/db";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { productsTable } from "@/db/schema/products-schema";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { storeSettingsTable } from "@/db/schema/store-settings-schema";
import { eq, sql, and, gte, isNull, inArray } from "drizzle-orm";
import { isFeatureEnabledForVisitors } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Top Sellers Leaderboard | Content Flywheel Marketplace",
  description: "The top-selling digital product creators on Content Flywheel this month.",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const marketplaceEnabled = await isFeatureEnabledForVisitors("marketplace");
  if (!marketplaceEnabled) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "60px 24px" }}>
        <span style={{ fontSize: "64px" }}>🛍️</span>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#111827" }}>Marketplace unavailable</h2>
        <p style={{ margin: 0, fontSize: "15px", color: "#6b7280", textAlign: "center", maxWidth: "400px" }}>The marketplace isn&apos;t available right now. Check back soon.</p>
      </div>
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Sales per creator this month (only completed orders)
  const salesRows = await db
    .select({
      creatorUserId: productOrdersTable.creatorUserId,
      sales: sql<number>`count(*)::int`,
    })
    .from(productOrdersTable)
    .where(
      and(
        eq(productOrdersTable.status, "completed"),
        gte(productOrdersTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(productOrdersTable.creatorUserId)
    .orderBy(sql`count(*) desc`)
    .limit(20);

  // Get userIds of creators with showSalesCount = true
  const allUserIds = salesRows.map((r) => r.creatorUserId);
  if (allUserIds.length === 0) {
    return <EmptyState />;
  }

  const [storeRows, brandRows] = await Promise.all([
    db.select({ userId: storeSettingsTable.userId, storeName: storeSettingsTable.storeName, profileImageUrl: storeSettingsTable.profileImageUrl, showSalesCount: storeSettingsTable.showSalesCount, bio: storeSettingsTable.bio })
      .from(storeSettingsTable).where(inArray(storeSettingsTable.userId, allUserIds)),
    db.select({ userId: brandVoiceTable.userId, brandName: brandVoiceTable.brandName })
      .from(brandVoiceTable).where(inArray(brandVoiceTable.userId, allUserIds)),
  ]);

  const storeMap = Object.fromEntries(storeRows.map((r) => [r.userId, r]));
  const brandMap = Object.fromEntries(brandRows.map((r) => [r.userId, r]));

  // Only show creators who opted in
  const leaderboard = salesRows
    .filter((r) => storeMap[r.creatorUserId]?.showSalesCount === true)
    .slice(0, 10)
    .map((r, i) => {
      const store = storeMap[r.creatorUserId];
      const brand = brandMap[r.creatorUserId];
      return {
        rank: i + 1,
        userId: r.creatorUserId,
        name: store?.storeName?.trim() || brand?.brandName?.trim() || "Creator",
        bio: store?.bio ?? null,
        profileImageUrl: store?.profileImageUrl ?? null,
        sales: r.sales,
      };
    });

  if (leaderboard.length === 0) {
    return <EmptyState />;
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#0B0B0F", padding: "40px 24px 56px", textAlign: "center" }}>
        <Link href="/marketplace" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#9ca3af", textDecoration: "none", fontSize: "13px", fontWeight: 600, marginBottom: "28px" }}>
          <ArrowLeft size={14} /> Back to Marketplace
        </Link>
        <div>
          <img src="/logo.png" alt="Content Flywheel" style={{ height: "44px", objectFit: "contain", display: "block", margin: "0 auto 24px" }} />
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(28px,5vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
            🏆 Top Sellers This Month
          </h1>
          <p style={{ margin: 0, fontSize: "16px", color: "#9ca3af" }}>
            The highest-earning creators on Content Flywheel in the last 30 days
          </p>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ maxWidth: "720px", margin: "-24px auto 0", padding: "0 24px 60px", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {leaderboard.map((entry) => {
            const initials = entry.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link
                key={entry.userId}
                href={`/marketplace/creator/${entry.userId}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    background: entry.rank === 1 ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : "#fff",
                    border: entry.rank === 1 ? "2px solid #fbbf24" : "1px solid #e5e7eb",
                    borderRadius: "16px",
                    padding: "16px 20px",
                    boxShadow: entry.rank <= 3 ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                    transition: "box-shadow 0.2s, transform 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = entry.rank <= 3 ? "0 2px 8px rgba(0,0,0,0.06)" : "none";
                    (e.currentTarget as HTMLDivElement).style.transform = "none";
                  }}
                >
                  {/* Rank */}
                  <div style={{ width: "36px", textAlign: "center", flexShrink: 0 }}>
                    {entry.rank <= 3 ? (
                      <span style={{ fontSize: "24px" }}>{medals[entry.rank - 1]}</span>
                    ) : (
                      <span style={{ fontSize: "18px", fontWeight: 800, color: "#9ca3af" }}>#{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
                    {entry.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.profileImageUrl} alt={entry.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "#fff" }}>
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Name + bio */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>{entry.name}</p>
                    {entry.bio && (
                      <p style={{ margin: 0, fontSize: "13px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.bio}</p>
                    )}
                  </div>

                  {/* Sales count */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: "22px", fontWeight: 800, color: "#f97316" }}>{entry.sales}</p>
                    <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: 600 }}>sale{entry.sales !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "40px" }}>
          <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#6b7280" }}>Want to appear on the leaderboard?</p>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9ca3af" }}>Enable &quot;Show sales count publicly&quot; in your Store Settings and start selling.</p>
          <Link href="/dashboard/store/customize" style={{ display: "inline-block", padding: "12px 28px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "15px", borderRadius: "12px", textDecoration: "none" }}>
            Go to Store Settings →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "24px", borderTop: "1px solid #e5e7eb" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Powered by <a href="/" style={{ color: "#f97316", fontWeight: 600, textDecoration: "none" }}>Content Flywheel</a>
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Helvetica Neue', Arial, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", padding: "60px 24px" }}>
      <span style={{ fontSize: "64px" }}>🏆</span>
      <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#111827" }}>No leaderboard yet</h2>
      <p style={{ margin: 0, fontSize: "15px", color: "#6b7280", textAlign: "center", maxWidth: "400px" }}>Creators need to opt in to showing their sales count publicly. Check back as the platform grows!</p>
      <Link href="/marketplace" style={{ display: "inline-block", padding: "12px 28px", background: "#f97316", color: "#fff", fontWeight: 800, fontSize: "15px", borderRadius: "12px", textDecoration: "none" }}>
        Browse Marketplace →
      </Link>
    </div>
  );
}
