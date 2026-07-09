export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const apiRl = await checkApiRateLimit(userId);

    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const { sectionTitle, currentContent, action, instruction } = body as {
      sectionTitle?: string;
      currentContent?: string;
      action?: string;
      instruction?: string;
    };

    if (!sectionTitle || currentContent === undefined) {
      return NextResponse.json(
        { error: "sectionTitle and currentContent are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    let prompt = "";

    if (action === "regenerate") {
      prompt = `Rewrite this section with fresh content. Keep the same topic but use different examples and explanations.

Section Title: ${sectionTitle}
Current Content: ${currentContent}

Generate new, unique content for this section as HTML. Use <p>, <strong>, <em>, <h2>, <h3>, <ul><li>. No markdown.`;
    } else if (action === "expand") {
      prompt = `${instruction ?? "Make this section longer with more details, examples, and actionable advice."}

Section Title: ${sectionTitle}
Current Content: ${currentContent}

Expand this section with more depth, examples, and actionable steps. Return as HTML only.`;
    } else if (action === "condense") {
      prompt = `${instruction ?? "Make this section 50% shorter while keeping the key points."}

Section Title: ${sectionTitle}
Current Content: ${currentContent}

Condense this section to be more concise while keeping key points. Return as HTML only.`;
    } else if (action === "restyle") {
      prompt = `${instruction ?? "Rewrite this section in a casual, conversational tone."}

Section Title: ${sectionTitle}
Current Content: ${currentContent}

Rewrite with the new tone while keeping the same information. Return as HTML only.`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional content editor. Return only HTML formatted content, no markdown, no code blocks.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
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
      newContent = newContent.replace(/^```html\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    }

    return NextResponse.json({ newContent });
  } catch (error) {
    console.error("Regenerate section error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate" },
      { status: 500 }
    );
  }
}
