import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export type ScriptViolationSeverity = "critical" | "warning" | "suggestion";

export type ScriptViolation = {
  lineNumber: number;
  exactText: string;
  platforms: string[];
  categories: string[];
  severity: ScriptViolationSeverity;
  suggestedFix: string;
};

const PLATFORM_RULES = `
TIKTOK: Strict on health/medical claims, weight loss, financial advice, before/after body claims, dangerous challenges. Requires #ad or #sponsored for paid partnerships. Bans misleading content.
INSTAGRAM: Similar to TikTok. Requires "Paid partnership" or #ad for sponsored posts. Restricts health claims, diet supplements, before/after. Reels must follow Community Guidelines.
YOUTUBE: Requires disclosure in video for paid promotions. Prohibits deceptive practices, misleading thumbnails, harmful content. Shorts follow same ad policies.
FACEBOOK: Requires clear ad labeling, restricts health claims, financial advice. Reels and feed posts must disclose partnerships.
TWITTER/X: Requires disclosure for promotional content. Prohibits misleading claims, medical advice, financial promises.
`;

const SYSTEM_PROMPT = `You are a script compliance expert for social media advertising. Analyze video scripts against platform guidelines.

Categories to detect:
- Misleading health claims: Claims about curing, treating, preventing disease; weight loss promises; medical advice without disclaimers
- Unverified facts: Statistics without sources; "studies show" without citation; definitive claims that need evidence
- Exaggerated promises: "Guaranteed results", "100% effective", "instant", "miracle", "never fail"
- Prohibited content: Platform-specific banned topics (each platform has different rules - see below)
- Missing disclosures: Paid partnerships, affiliate links, or sponsored content without #ad, #sponsored, "Paid partnership", or verbal disclosure

${PLATFORM_RULES}

IMPORTANT - Group by line: If the same line has multiple issues (e.g. misleading health claim + unverified fact + exaggerated promise), return ONE violation per line with:
1. lineNumber: The line number (1-indexed)
2. exactText: The exact phrase or sentence that violates (quote it precisely)
3. platforms: Union of all platforms this violates
4. categories: Array of all issue types, e.g. ["Misleading health claim", "Unverified fact", "Exaggerated promise"]
5. severity: Use the highest severity among the issues (critical > warning > suggestion)
6. suggestedFix: ONE combined fix that addresses ALL issues on that line

Each violation must be for a different line. No duplicates. If the script needs an overall disclosure (e.g. no #ad), add a violation at line 1.

Return ONLY valid JSON: { "violations": [ { "lineNumber": number, "exactText": string, "platforms": string[], "categories": string[], "severity": "critical"|"warning"|"suggestion", "suggestedFix": string } ] }
If no violations, return { "violations": [] }. No markdown, no explanation.`;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { script, platforms } = body as { script?: string; platforms?: string[] };

    if (!script || typeof script !== "string") {
      return NextResponse.json(
        { error: "script is required" },
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

    const targetPlatforms =
      Array.isArray(platforms) && platforms.length > 0
        ? platforms
        : ["TikTok", "Instagram", "YouTube", "Facebook", "Twitter"];

    const userPrompt = `Check this script for compliance with: ${targetPlatforms.join(", ")}.

Script (lines numbered):
${script
  .split("\n")
  .map((line: string, i: number) => `${i + 1}| ${line}`)
  .join("\n")}

Return JSON with violations array. Check ALL categories: misleading health claims, unverified facts, exaggerated promises, prohibited content, missing disclosures.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
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

    let raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    raw = raw.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let parsed: { violations?: unknown[] };
    try {
      parsed = JSON.parse(raw) as { violations?: unknown[] };
    } catch {
      return NextResponse.json(
        { error: "Failed to parse analysis response" },
        { status: 500 }
      );
    }

    const SEVERITY_ORDER = { critical: 3, warning: 2, suggestion: 1 };
    const rawViolations = (parsed.violations ?? [])
      .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"))
      .map((v) => ({
        lineNumber: typeof v.lineNumber === "number" ? v.lineNumber : 1,
        exactText: typeof v.exactText === "string" ? v.exactText : String(v.exactText ?? ""),
        platforms: Array.isArray(v.platforms) ? v.platforms.map(String) : ["All"],
        categories: Array.isArray(v.categories)
          ? v.categories.map(String)
          : typeof v.category === "string"
            ? [v.category]
            : ["Compliance issue"],
        severity: ["critical", "warning", "suggestion"].includes(String(v.severity))
          ? (v.severity as ScriptViolationSeverity)
          : "warning",
        suggestedFix: typeof v.suggestedFix === "string" ? v.suggestedFix : "Review and revise.",
      }))
      .filter((v) => v.exactText.length > 0);

    // Group by line: merge multiple violations on same line into one
    const byLine = new Map<number, ScriptViolation>();
    for (const v of rawViolations) {
      const existing = byLine.get(v.lineNumber);
      if (!existing) {
        byLine.set(v.lineNumber, { ...v });
        continue;
      }
      const allCategories = Array.from(new Set([...existing.categories, ...v.categories]));
      const maxSeverity =
        SEVERITY_ORDER[v.severity] > SEVERITY_ORDER[existing.severity] ? v.severity : existing.severity;
      const allPlatforms = Array.from(new Set([...existing.platforms, ...v.platforms]));
      const combinedFix =
        existing.suggestedFix === v.suggestedFix
          ? existing.suggestedFix
          : [existing.suggestedFix, v.suggestedFix].filter(Boolean).join(" ");
      byLine.set(v.lineNumber, {
        lineNumber: v.lineNumber,
        exactText: existing.exactText || v.exactText,
        platforms: allPlatforms,
        categories: allCategories,
        severity: maxSeverity,
        suggestedFix: combinedFix,
      });
    }
    const violations = Array.from(byLine.values()).sort((a, b) => a.lineNumber - b.lineNumber);

    return NextResponse.json({ violations });
  } catch (error) {
    console.error("Script checker error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze script",
      },
      { status: 500 }
    );
  }
}
