import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { productsTable } from "@/db/schema/products-schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Convert HTML or markdown to Notion-compatible markdown.
 * Preserves **bold**, *italic*, `code`, headings, lists, blockquotes.
 * Converts list items that look like tasks to [ ] checkboxes.
 */
function toNotionMarkdown(htmlOrMarkdown) {
  if (!htmlOrMarkdown || typeof htmlOrMarkdown !== "string") return "";
  let s = htmlOrMarkdown.trim();

  // If it looks like HTML, convert common tags to markdown
  if (s.includes("<")) {
    s = s
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, inner) => {
        const lines = inner.replace(/<[^>]+>/g, " ").trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
        return lines.map((l) => "> " + l).join("\n") + "\n\n";
      })
      .replace(/<ul[^>]*>/gi, "\n")
      .replace(/<\/ul>/gi, "\n")
      .replace(/<ol[^>]*>/gi, "\n")
      .replace(/<\/ol>/gi, "\n")
      .replace(/<li[^>]*>(.*?)<\/li>/gi, (_, inner) => "- " + inner.replace(/<[^>]+>/g, "").trim() + "\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, (_, inner) => inner.replace(/<[^>]+>/g, "").trim() + "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  // Normalize markdown: preserve ** * ` lists and blockquotes
  s = s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/** Extract URLs from content for Resources section. */
function extractUrls(text) {
  if (!text || typeof text !== "string") return [];
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const seen = new Set();
  const matches = text.match(urlRegex) || [];
  return matches.filter((u) => {
    const normalized = u.replace(/[.,;:!?)]+$/, "");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * POST /api/generate-notion-template
 * Body: { productId: string }
 * Returns .md file (Notion-compatible markdown).
 */
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.userId, userId)));

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const title = product?.title ?? "Product";
    const description = product?.description ?? product?.subtitle ?? product?.tagline ?? "";
    const sections = product?.content?.sections ?? [];
    const secs = sections.length ? sections : [{ id: "1", title: title, content: "" }];

    const parts = [];

    // Optional metadata block at top (YAML-style for Notion)
    parts.push(`# ${title}`);
    parts.push("");
    if (description) {
      parts.push("> " + description.replace(/\n/g, "\n> "));
      parts.push("");
    }
    parts.push("---");
    parts.push("");

    for (let i = 0; i < secs.length; i++) {
      const section = secs[i];
      const sectionTitle = section?.title ?? `Section ${i + 1}`;
      const rawContent = section?.content ?? section?.contentHtml ?? "";
      const content = toNotionMarkdown(rawContent);

      parts.push("## " + sectionTitle);
      parts.push("");
      if (content) {
        parts.push(content);
        parts.push("");
      } else {
        parts.push("*No content*");
        parts.push("");
      }
      parts.push("---");
      parts.push("");
    }

    // Resources section (extract links from all section content)
    const allContent = secs.map((s) => s?.content ?? s?.contentHtml ?? "").join("\n");
    const urls = extractUrls(allContent);
    parts.push("## Resources");
    parts.push("");
    if (urls.length > 0) {
      urls.forEach((url) => parts.push("- " + url));
    } else {
      parts.push("- *Add your links here*");
    }
    parts.push("");
    parts.push("---");
    parts.push("");
    parts.push("*Created with Content Flywheel*");

    const markdown = parts.join("\n");
    const safeName = title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "notion-template";
    const fileName = `${safeName}.md`;

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Generate Notion template failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Notion template generation failed" },
      { status: 500 }
    );
  }
}
