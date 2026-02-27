import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cleanProductTitle } from "@/lib/product-title";

type ExistingSectionContext = { title: string; contentPreview: string };

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      productTitle,
      niche,
      sectionTitle,
      contentType,
      customType,
      existingSections,
    } = body as {
      productTitle?: string;
      niche?: string;
      sectionTitle?: string;
      contentType?: string;
      customType?: string;
      existingSections?: ExistingSectionContext[];
    };

    if (!sectionTitle) {
      return NextResponse.json(
        { error: "sectionTitle is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const cleanedTitle = cleanProductTitle(productTitle) || productTitle;
    const topic = [cleanedTitle, niche].filter(Boolean).join(" — ") || "general audience";
    const typeLabel = customType?.trim() || contentType || "content";
    const sectionsContext =
      Array.isArray(existingSections) && existingSections.length > 0
        ? existingSections
            .slice(0, 15)
            .map(
              (s) =>
                `- "${s.title}": ${(s.contentPreview || "").slice(0, 120)}...`
            )
            .join("\n")
        : "";

    const systemPrompt = `You are a professional digital product writer. Generate section content as HTML only. Use <p>, <strong>, <em>, <h2>, <h3>, <ul>, <ol>, <li>, <div class="example-box"> where appropriate. No markdown, no code fences. Output ready-to-use HTML.`;

    const userPrompt = `Product/topic: ${topic}
Section title: ${sectionTitle}

The user wants this section to focus on: **${typeLabel}**.

${sectionsContext ? `Other sections in this product (for context and tone):\n${sectionsContext}\n` : ""}

Generate 300–600 words of ${typeLabel} content that fits this section and product. Keep the same professional tone. Return only the HTML content.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-4o: quality for long-form section content
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const errMsg = data?.error?.message ?? "OpenAI request failed";
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    let newContent = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (newContent) {
      newContent = newContent
        .replace(/^```html\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
    }

    return NextResponse.json({ newContent });
  } catch (error) {
    console.error("Generate section content error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate content",
      },
      { status: 500 }
    );
  }
}
