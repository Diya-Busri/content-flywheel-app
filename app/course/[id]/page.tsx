import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { productOrdersTable } from "@/db/schema/product-orders-schema";
import { eq, and, isNull } from "drizzle-orm";
import type { MarketingAssets } from "@/db/schema/products-schema";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Section = { id: string; title: string; content: string; order: number; imageUrl?: string };
type ProductContent = { sections?: Section[] };

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; session_id?: string; lesson?: string }>;
}

export default async function CoursePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const accessToken = sp?.token ?? null;
  const sessionId = sp?.session_id ?? null;
  const activeLessonIndex = sp?.lesson ? parseInt(sp.lesson) : 0;

  const [product] = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      userId: productsTable.userId,
      marketingAssets: productsTable.marketingAssets,
      content: productsTable.content,
    })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) notFound();

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  if (!ma.isNativePublished && !ma.isCourseFormat) notFound();

  const content = (product.content ?? {}) as ProductContent;
  const sections = (content.sections ?? []).sort((a, b) => a.order - b.order);
  const freePreview = (ma as { freePreviewLessons?: number }).freePreviewLessons ?? 1;

  // Verify access via download token OR Stripe session_id
  let hasAccess = false;
  let verifiedToken: string | null = accessToken;
  if (accessToken) {
    const [order] = await db
      .select({ id: productOrdersTable.id })
      .from(productOrdersTable)
      .where(
        and(
          eq(productOrdersTable.productId, id),
          eq(productOrdersTable.downloadToken, accessToken),
          eq(productOrdersTable.status, "completed")
        )
      )
      .limit(1);
    hasAccess = !!order;
  } else if (sessionId) {
    const [order] = await db
      .select({ id: productOrdersTable.id, downloadToken: productOrdersTable.downloadToken })
      .from(productOrdersTable)
      .where(
        and(
          eq(productOrdersTable.productId, id),
          eq(productOrdersTable.stripeSessionId, sessionId),
          eq(productOrdersTable.status, "completed")
        )
      )
      .limit(1);
    if (order) {
      hasAccess = true;
      verifiedToken = order.downloadToken;
    }
  }

  const displayTitle = (ma as { productTitle?: string }).productTitle || product.title;
  const safeLesson = Math.max(0, Math.min(activeLessonIndex, sections.length - 1));
  const currentSection = sections[safeLesson];
  const lessonAccessible = hasAccess || safeLesson < freePreview;

  const productUrl = `/product/${id}`;

  return (
    <main style={{ margin: 0, padding: 0, background: "#0B0B0F", minHeight: "100vh", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", color: "#f5f5f5" }}>
      {/* Top bar */}
      <div style={{ background: "#111118", borderBottom: "1px solid #1e1e2e", padding: "12px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
        <Link href={productUrl} style={{ color: "#f97316", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
          ← Back to product
        </Link>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px" }}>/</span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayTitle}</span>
        {!hasAccess && (
          <Link href={productUrl} style={{ marginLeft: "auto", background: "#f97316", color: "#fff", borderRadius: "8px", padding: "6px 16px", textDecoration: "none", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>
            Get Full Access →
          </Link>
        )}
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 53px)" }}>
        {/* Sidebar — lesson list */}
        <div style={{ width: "280px", flexShrink: 0, background: "#111118", borderRight: "1px solid #1e1e2e", overflowY: "auto", padding: "16px 0" }}>
          <p style={{ margin: "0 16px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)" }}>
            Course Content · {sections.length} lessons
          </p>
          {sections.map((s, i) => {
            const accessible = hasAccess || i < freePreview;
            const isActive = i === safeLesson;
            return (
              <Link
                key={s.id}
                href={accessible ? `/course/${id}?lesson=${i}${verifiedToken ? `&token=${verifiedToken}` : ""}` : productUrl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  textDecoration: "none",
                  background: isActive ? "rgba(249,115,22,0.15)" : "transparent",
                  borderLeft: isActive ? "3px solid #f97316" : "3px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700,
                  background: isActive ? "#f97316" : accessible ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                  color: isActive ? "#fff" : accessible ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                }}>
                  {accessible ? (i + 1) : "🔒"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: isActive ? 600 : 400, color: accessible ? (isActive ? "#fff" : "rgba(255,255,255,0.75)") : "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title}
                  </p>
                  {!accessible && i === freePreview && (
                    <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#f97316", fontWeight: 600 }}>Purchase to unlock</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          {currentSection ? (
            lessonAccessible ? (
              <div style={{ maxWidth: "720px" }}>
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Lesson {safeLesson + 1} of {sections.length}
                  </span>
                </div>
                <h1 style={{ margin: "0 0 24px", fontSize: "28px", fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
                  {currentSection.title}
                </h1>
                {currentSection.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSection.imageUrl} alt={currentSection.title} style={{ width: "100%", borderRadius: "12px", marginBottom: "24px", maxHeight: "400px", objectFit: "cover" }} />
                )}
                <div style={{ fontSize: "16px", lineHeight: "1.8", color: "rgba(255,255,255,0.8)" }}
                  dangerouslySetInnerHTML={{ __html: currentSection.content.replace(/\n/g, "<br/>") }}
                />

                {/* Lesson navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "48px", paddingTop: "24px", borderTop: "1px solid #1e1e2e" }}>
                  {safeLesson > 0 ? (
                    <Link href={`/course/${id}?lesson=${safeLesson - 1}${verifiedToken ? `&token=${verifiedToken}` : ""}`} style={{ color: "#f97316", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
                      ← Previous lesson
                    </Link>
                  ) : <span />}
                  {safeLesson < sections.length - 1 && (hasAccess || safeLesson + 1 < freePreview) ? (
                    <Link href={`/course/${id}?lesson=${safeLesson + 1}${verifiedToken ? `&token=${verifiedToken}` : ""}`} style={{ color: "#f97316", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
                      Next lesson →
                    </Link>
                  ) : safeLesson < sections.length - 1 && !hasAccess ? (
                    <Link href={productUrl} style={{ background: "#f97316", color: "#fff", borderRadius: "10px", padding: "10px 22px", textDecoration: "none", fontSize: "14px", fontWeight: 700 }}>
                      Unlock all {sections.length} lessons →
                    </Link>
                  ) : (
                    <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>🎉 Course complete!</span>
                  )}
                </div>
              </div>
            ) : (
              /* Locked lesson — CTA */
              <div style={{ maxWidth: "560px", margin: "80px auto", textAlign: "center" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔒</div>
                <h2 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: 800, color: "#fff" }}>This lesson is locked</h2>
                <p style={{ margin: "0 0 32px", fontSize: "16px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  Purchase <strong style={{ color: "#fff" }}>{displayTitle}</strong> to unlock all {sections.length} lessons and get full access.
                </p>
                <Link href={productUrl} style={{ display: "inline-block", background: "#f97316", color: "#fff", borderRadius: "12px", padding: "14px 32px", textDecoration: "none", fontSize: "16px", fontWeight: 700 }}>
                  Get full access →
                </Link>
              </div>
            )
          ) : (
            <div style={{ textAlign: "center", marginTop: "80px", color: "rgba(255,255,255,0.4)" }}>
              <p style={{ fontSize: "16px" }}>Select a lesson from the sidebar to get started.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
