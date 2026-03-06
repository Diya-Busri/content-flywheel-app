import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { fetchOpenAIWithRetry } from "@/lib/openai-with-retry";
import type { LaunchChecklistPhase, LaunchChecklistWaitlistEmail, LaunchChecklistFirstDropPricing } from "@/db/schema/launch-checklist-schema";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a launch strategist for e-commerce and print-on-demand brands. Return ONLY valid JSON (no markdown, no code fence) in this exact shape:
{
  "milestone_to_launch": "one short sentence: the single milestone the user should hit before launching",
  "checklist": [
    { "phase": "Phase name", "estimated_time": "e.g. 1-2 weeks", "tasks": ["task 1", "task 2"] }
  ],
  "waitlist_email": { "subject": "Email subject line", "body": "Short email body (1-3 sentences)." },
  "first_drop_pricing": { "suggested_products": ["product idea 1", "product idea 2"], "pricing_notes": "Brief pricing or positioning note." }
}
- checklist: 3-5 phases (e.g. POD setup, Store setup, Pre-launch, Launch, First 1k). Each phase has 3-6 concrete tasks.
- waitlist_email: one compelling waitlist signup email (subject + body).
- first_drop_pricing: 2-4 product ideas and brief pricing/positioning notes.
Keep text concise and actionable.`;

function parseRoadmapJson(raw: string): {
  milestone_to_launch: string;
  checklist: LaunchChecklistPhase[];
  waitlist_email: LaunchChecklistWaitlistEmail;
  first_drop_pricing: LaunchChecklistFirstDropPricing;
} | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const milestone_to_launch = typeof obj.milestone_to_launch === "string" ? obj.milestone_to_launch : "";
    const checklist = Array.isArray(obj.checklist)
      ? (obj.checklist as unknown[]).map((item) => {
          const p = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            phase: typeof p.phase === "string" ? p.phase : undefined,
            estimated_time: typeof p.estimated_time === "string" ? p.estimated_time : undefined,
            tasks: Array.isArray(p.tasks) ? (p.tasks as string[]).filter((t) => typeof t === "string") : [],
          } as LaunchChecklistPhase;
        })
      : [];
    const we = obj.waitlist_email && typeof obj.waitlist_email === "object" ? (obj.waitlist_email as Record<string, unknown>) : {};
    const waitlist_email: LaunchChecklistWaitlistEmail = {
      subject: typeof we.subject === "string" ? we.subject : "",
      body: typeof we.body === "string" ? we.body : "",
    };
    const fdp = obj.first_drop_pricing && typeof obj.first_drop_pricing === "object" ? (obj.first_drop_pricing as Record<string, unknown>) : {};
    const first_drop_pricing: LaunchChecklistFirstDropPricing = {
      suggested_products: Array.isArray(fdp.suggested_products) ? (fdp.suggested_products as string[]).filter((s) => typeof s === "string") : [],
      pricing_notes: typeof fdp.pricing_notes === "string" ? fdp.pricing_notes : "",
    };
    return { milestone_to_launch, checklist, waitlist_email, first_drop_pricing };
  } catch {
    return null;
  }
}

/**
 * POST: Generate launch checklist roadmap (milestone, phases/tasks, waitlist email, first drop pricing).
 * Body: { brandName?, followerCount?, podPlatform?, sellingPlatform?, stage? }
 */
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
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const followerCount = typeof body.followerCount === "string" ? body.followerCount.trim() : "";
    const podPlatform = typeof body.podPlatform === "string" ? body.podPlatform.trim() : "";
    const sellingPlatform = typeof body.sellingPlatform === "string" ? body.sellingPlatform.trim() : "";
    const stage = typeof body.stage === "string" ? body.stage.trim() : "";

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is not configured. Add OPENAI_API_KEY to .env.local." },
        { status: 503 }
      );
    }

    const context = [
      brandName && `Brand: ${brandName}`,
      followerCount && `Current follower count: ${followerCount}`,
      podPlatform && `POD platform: ${podPlatform}`,
      sellingPlatform && `Selling platform: ${sellingPlatform}`,
      stage && `Current stage: ${stage}`,
    ]
      .filter(Boolean)
      .join(". ");

    const userPrompt = context
      ? `${context}. Generate a personalized launch roadmap (milestone to launch, checklist phases with tasks, one waitlist email, first drop product ideas and pricing notes).`
      : "Generate a generic launch roadmap: milestone to launch, checklist phases with tasks, one waitlist email, first drop product ideas and pricing notes.";

    const response = await fetchOpenAIWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
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
          temperature: 0.6,
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      let message = "AI request failed.";
      try {
        const errJson = JSON.parse(errText) as { error?: { message?: string } };
        if (typeof errJson?.error?.message === "string") message = errJson.error.message;
      } catch {
        if (response.status === 429) message = "Rate limit exceeded. Wait a minute and try again.";
        else if (errText.length < 200) message = errText;
      }
      return NextResponse.json(
        { error: message },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "No response from AI. Try again." },
        { status: 502 }
      );
    }

    const roadmap = parseRoadmapJson(content);
    if (!roadmap) {
      return NextResponse.json(
        { error: "AI returned invalid format. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(roadmap);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    console.error("[brand-builder/launch-checklist/generate]", e);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
