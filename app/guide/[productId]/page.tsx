import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { scriptsTable } from "@/db/schema/library-schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type MarketingAssets = {
  productTitle?: string;
  productDescription?: string;
  hashtags?: string[];
  thumbnailUrl?: string | null;
  coverThumbnailUrl?: string | null;
};

type ScriptMeta = {
  hooks?: string[];
  captions?: string[];
  socialKit?: {
    tiktok?: {
      descriptionVariations?: string[];
      hashtags?: string[];
    };
  };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const [product] = await db
    .select({ title: productsTable.title })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
    .limit(1);
  return {
    title: product ? `${product.title} — Video Guide` : "Video Guide",
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const [product] = await db
    .select({
      id: productsTable.id,
      title: productsTable.title,
      niche: productsTable.niche,
      marketingAssets: productsTable.marketingAssets,
    })
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), isNull(productsTable.deletedAt)))
    .limit(1);

  if (!product) notFound();

  const [script] = await db
    .select({ content: scriptsTable.content, metadata: scriptsTable.metadata })
    .from(scriptsTable)
    .where(eq(scriptsTable.productId, productId))
    .orderBy(desc(scriptsTable.createdAt))
    .limit(1);

  const ma = (product.marketingAssets ?? {}) as MarketingAssets;
  const sm = (script?.metadata ?? {}) as ScriptMeta;

  const coverImage = ma.thumbnailUrl ?? ma.coverThumbnailUrl ?? null;
  const description = ma.productDescription ?? null;
  const hashtags: string[] = sm.socialKit?.tiktok?.hashtags ?? ma.hashtags ?? [];
  const hooks: string[] = sm.hooks ?? sm.socialKit?.tiktok?.descriptionVariations ?? [];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fff7ed 0%, #fffbf7 60%, #fff 100%)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "40px 16px 80px",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#f97316",
              marginBottom: "10px",
            }}
          >
            Video Creation Guide
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(22px, 5vw, 32px)",
              fontWeight: 800,
              color: "#111827",
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
            }}
          >
            {product.title}
          </h1>
          {product.niche && (
            <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#9ca3af" }}>
              {product.niche}
            </p>
          )}
        </div>

        {/* Cover image */}
        {coverImage && (
          <div
            style={{
              marginBottom: "32px",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid #f3f4f6",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={product.title}
              style={{ width: "100%", display: "block", maxHeight: "380px", objectFit: "cover" }}
            />
          </div>
        )}

        {/* Product description */}
        {description && (
          <Section title="Product Description">
            <p style={{ margin: 0, fontSize: "15px", color: "#374151", lineHeight: 1.7 }}>
              {description}
            </p>
          </Section>
        )}

        {/* Hooks */}
        {hooks.length > 0 && (
          <Section title="Video Hooks">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {hooks.map((hook, i) => (
                <div
                  key={i}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    fontSize: "14px",
                    color: "#374151",
                    lineHeight: 1.6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#f97316",
                      marginBottom: "4px",
                    }}
                  >
                    HOOK {i + 1}
                  </span>
                  <p style={{ margin: 0 }}>{hook}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Script */}
        {script?.content && (
          <Section title="Video Script">
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "14px",
                color: "#374151",
                lineHeight: 1.75,
                fontFamily: "inherit",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              {script.content}
            </pre>
          </Section>
        )}

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <Section title="Hashtags">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    fontSize: "13px",
                    color: "#c2410c",
                    fontWeight: 500,
                  }}
                >
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "48px",
            fontSize: "12px",
            color: "#d1d5db",
          }}
        >
          Made with{" "}
          <span style={{ color: "#f97316", fontWeight: 600 }}>Content Flywheel</span>
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      <h2
        style={{
          margin: "0 0 12px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#6b7280",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}
