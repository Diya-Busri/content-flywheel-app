import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ScriptViolation } from "../route";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { script, violations } = body as {
      script?: string;
      violations?: ScriptViolation[];
    };

    if (!script || typeof script !== "string") {
      return NextResponse.json({ error: "script is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const violationSummary =
      Array.isArray(violations) && violations.length > 0
        ? violations
          .map(
            (v) =>
              `Line ${v.lineNumber}: "${v.exactText}" - ${(v.categories ?? []).join(", ")}. Suggested fix: ${v.suggestedFix}`
          )
          .join("\n")
        : "No specific violations provided.";

    const systemPrompt = `You are a script compliance expert who writes COMPLIANT scripts that still SELL. Rewrite scripts to fix violations while keeping a persuasive, benefit-driven marketing tone.

CRITICAL: The output must SOUND LIKE A REAL MARKETING SCRIPT, not a medical disclaimer or legal fine print.

DO:
- Use benefit-focused language: "transform your skin", "visible results", "real users love this", "clinically-studied ingredients"
- Include strong calls-to-action: "DM me to learn more", "Link in bio", "Try it today"
- Create urgency without false guarantees: "limited stock", "join thousands", "see the difference"
- Keep the persuasive energy and excitement of the original
- Add required disclosures naturally: #ad, #sponsored, "paid partnership" - weave them in, don't make them awkward
- Replace false claims with compliant alternatives that still sell: instead of "cures acne" use "targets acne with proven ingredients" or "real users see visible improvement"

DON'T:
- Sound passive, boring, or like a pharmaceutical label ("may help improve" alone is too weak)
- Remove all enthusiasm or marketing punch
- Make it read like legal disclaimers
- Use overly cautious hedged language that kills the pitch

Example: 
Original: "This will CURE your acne in 24 hours!" 
Bad fix: "This supplement may help improve your skin over time..."
Good fix: "Ready to transform your skin? This supplement targets acne with clinically-studied ingredients. Real users see visible results - DM me to learn more! #ad"

Return ONLY the rewritten script. No explanations, no markdown. Make it compliant AND compelling.`;

    const userPrompt = `Original script:
---
${script}
---

Violations to fix:
${violationSummary}

Rewrite the ENTIRE script to fix every violation while keeping it persuasive and sales-driven. Sound like a real marketing script that converts - compliant but compelling. Return only the new script.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
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

    let compliantScript = data.choices?.[0]?.message?.content?.trim() ?? "";
    compliantScript = compliantScript
      .replace(/^Here('s| is) the (compliant |rewritten )?script:?\s*/i, "")
      .replace(/^```\w*\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    return NextResponse.json({ compliantScript });
  } catch (error) {
    console.error("Generate compliant script error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate compliant script",
      },
      { status: 500 }
    );
  }
}
