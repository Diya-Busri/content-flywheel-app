import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";

// ─── Type-specific focus instructions ────────────────────────────────────────

const TYPE_FOCUS: Record<string, string> = {
  "find-niche": `FOCUS: Niche discovery and validation.
Emphasise demand signals, competition gaps, underserved audiences, and monetisation ceiling.
rootCauses should explain why current niches are oversaturated or underexplored.
productOpportunities must be niche-entry plays — specific and actionable.
businessOpportunities should include underserved audience segments.`,

  "product-ideas": `FOCUS: Digital product discovery and validation.
Make productOpportunities the richest section — include 5+ specific products with exact names.
Include templates, prompt packs, courses, bundles, toolkits, and memberships.
Each product should have a concrete pain point it solves and a clear buyer profile.
rootCauses should explain why existing products fail or miss the mark.`,

  "content-ideas": `FOCUS: High-performing content concepts and formats.
Make contentOpportunities the richest section — include 6+ specific pieces with titles and hooks.
Include lead magnets, email sequences, and viral short-form angles.
rootCauses should explain what makes content in this space underperform.
evidence should reference what content is already working in this niche.`,

  "competitor": `FOCUS: Competitor intelligence and positioning gaps.
Make competitorInsights the richest section — include 5+ named competitors.
For each competitor: what they sell, price points, content strategy, strengths, and exploitable gaps.
whatToLearn field should be specific and strategic.
businessOpportunities should list positioning angles competitors haven't claimed.`,

  "marketing": `FOCUS: Go-to-market strategy and channel selection.
Make actionPlan heavily marketing-focused: launch sequence, channel strategy, messaging.
Include specific copy angles, positioning statements, and distribution tactics.
keywords should focus on commercial and transactional intent.
rootCauses should explain why marketing in this space typically fails.`,

  "customer": `FOCUS: Customer psychology and ICP analysis.
insights should reveal psychological drivers, not just demographics.
rootCauses should explain the emotional and situational causes behind customer struggles.
Include specific language patterns customers use — exact phrases for copy.
evidence should reference communities where this audience congregates.
businessOpportunities should identify underserved audience segments.`,

  "seo-keywords": `FOCUS: Search opportunity and content gap analysis.
Make keywords the richest section — include 10+ keywords spanning all intent levels.
Include long-tail clusters, FAQ-style keywords, and topic authority maps.
contentOpportunities should be tied directly to keyword clusters.
evidence should reference search trend signals and gap analysis.`,

  "market-trends": `FOCUS: Trend timing and opportunity windows.
insights should focus on what is changing RIGHT NOW and why timing matters.
evidence should reference specific trend signals — platform shifts, community growth, search spikes.
rootCauses should explain the underlying forces driving the trend.
businessOpportunities should identify first-mover advantages.`,

  "custom": `FOCUS: Comprehensive balanced research across all dimensions.
Cover all sections with equal depth. Be specific and avoid generic observations.`,
};

// ─── Base system prompt ───────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are an expert AI Business Analyst for creators, solopreneurs, and founders building digital businesses. You think like a business strategist, market researcher, and product manager combined.

Your job is to answer three questions with every report:
1. What is happening in this market?
2. Why does it matter?
3. What should the user do next?

Given a research query, generate a comprehensive, specific, and actionable market research report as a single valid JSON object.

Return ONLY valid JSON (no markdown, no code blocks, no extra text) with this exact structure:

{
  "summary": "Two paragraphs. Paragraph 1: what is happening — market overview, current momentum, key dynamics. Paragraph 2: why it matters and the primary opportunity for a creator or founder entering this space. Be specific and bold.",

  "insights": [
    "Short, specific insight bullet — not generic advice (e.g. 'Creators who niche down to a specific profession earn 3x more per product than general productivity creators')",
    "..."
  ],

  "evidence": [
    {
      "source": "Reddit|YouTube|TikTok|Twitter|Industry Report|Community|Platform|Search Trends",
      "finding": "Specific observation or data point from this source type",
      "context": "Why this evidence matters for the research query"
    }
  ],

  "rootCauses": [
    "Why the core problem or opportunity exists — go deeper than the symptom (e.g. 'Most digital product creators skip the validation step because they conflate building with selling, leading to products nobody asked for')",
    "..."
  ],

  "contentOpportunities": [
    {
      "title": "Specific, titled content piece (e.g. 'The 5-Day Notion Setup Challenge for NHS Nurses')",
      "description": "What this covers, the specific pain point it addresses, and why it will perform",
      "format": "Short-Form Video|Long-Form Video|Carousel|Blog Post|Email Sequence|Newsletter|Thread|Lead Magnet|Podcast Episode",
      "difficulty": "Easy|Medium|Hard"
    }
  ],

  "productOpportunities": [
    {
      "title": "Specific, marketable product name",
      "description": "What it solves, who buys it, and why they will pay for it",
      "type": "Digital Download|Online Course|Template Pack|Prompt Pack|Toolkit|Community|Coaching Programme|Bundle|Membership",
      "priceRange": "£X–£Y"
    }
  ],

  "businessOpportunities": [
    {
      "title": "Specific business angle or market gap",
      "description": "The opportunity, why it exists now, and how to capture it",
      "type": "Market Gap|Underserved Audience|Emerging Trend|Monetisation Angle|First-Mover Advantage"
    }
  ],

  "competitorInsights": [
    {
      "name": "Named creator, brand, or clearly-described archetype",
      "strength": "What they do very well — be specific",
      "gap": "The specific angle or audience they are underserving — this is the opportunity",
      "popularProducts": "Their top-performing product types and approximate price points",
      "contentStrategy": "What content approach works for them",
      "whatToLearn": "One strategic insight a new entrant should take from studying them"
    }
  ],

  "keywords": [
    {
      "term": "exact keyword phrase",
      "intent": "informational|commercial|transactional",
      "opportunity": "High|Medium|Low",
      "type": "Short-tail|Long-tail|FAQ|Related",
      "note": "Why this keyword matters and what content it should anchor"
    }
  ],

  "actionPlan": [
    {
      "step": 1,
      "action": "Specific, imperative action (e.g. 'Build a free Notion planner for NHS nurses and post it in 3 nursing Facebook groups')",
      "detail": "Exact guidance — what to make, where to share it, what success looks like",
      "cta": "Create Note|Generate Carousel|Generate Video|Generate Script|Create Product|Open Design Studio"
    }
  ],

  "recommendedOpportunity": {
    "name": "The single best opportunity — specific and marketable",
    "why": "2-3 sentences: why this is the standout choice given demand, competition gap, and ceiling",
    "demand": "Very High|High|Medium|Low",
    "competition": "Very High|High|Medium|Low",
    "monetisationPotential": "Very High|High|Medium|Low",
    "contentPotential": "Very High|High|Medium|Low",
    "estimatedRevenue": "£X–£Y per month at realistic scale",
    "timeToFirstSale": "e.g. '2–4 weeks'"
  },

  "buildPath": {
    "withFlywheel": {
      "estimatedTime": "e.g. '15–25 minutes'",
      "difficulty": "Easy|Medium|Hard",
      "steps": ["Generate Product", "Edit in Design Studio", "Generate Carousel", "Generate Video Guide", "Generate Publishing Kit"]
    },
    "manually": {
      "estimatedTime": "e.g. '4–8 hours'",
      "tools": ["Canva", "ChatGPT", "Google Docs", "Manual editing"],
      "note": "Honest description of the manual workflow"
    }
  },

  "aiRecommendation": {
    "nextStep": "One precise, actionable instruction — exactly what to do right now",
    "category": "Build Now|Validate First|Create Content First|Research More",
    "reasoning": "2-3 sentences: why this is the highest-leverage next action given the specific findings"
  }
}

RULES:
- 6–8 insights, 3–5 evidence items, 3–5 root causes, 4–6 content opportunities, 3–5 product opportunities, 2–4 business opportunities, 3–4 competitor insights, 7–10 keywords, 5–7 action plan steps
- Every item must be SPECIFIC — never generic advice
- All prices in GBP (£)
- Competitor names should be real or clearly archetypal
- Action plan escalates: quick win first, bigger bets later
- cta values must be one of the exact strings listed
- buildPath.withFlywheel.steps only uses: Generate Product|Edit in Design Studio|Generate Carousel|Generate Video Guide|Generate Publishing Kit
- aiRecommendation.category must be one of the 4 exact strings listed`;

function buildSystemPrompt(researchType: string): string {
  const focus = TYPE_FOCUS[researchType] ?? TYPE_FOCUS["custom"];
  return `${BASE_SYSTEM_PROMPT}\n\n---\nRESEARCH TYPE: ${researchType.toUpperCase()}\n${focus}`;
}

// ─── Follow-up system prompt ──────────────────────────────────────────────────

const FOLLOWUP_SYSTEM_PROMPT = `You are an AI Business Analyst continuing a research conversation. You have access to the original research report as context.

Answer the follow-up question specifically and concisely. Be practical and actionable — give the user something they can do immediately. Use bullet points where helpful. Do not return JSON.

If the user asks to "expand", "go deeper", or "tell me more" about a specific section, provide a detailed analysis of just that area.
If the user asks for a "strategy" or "plan", provide a step-by-step approach.
If the user asks "what should I build", give a direct recommendation with reasoning.`;

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiRl = await checkApiRateLimit(userId);
  if (apiRl) return apiRl;
  const aiRl = checkAiRateLimit(userId);
  if (aiRl) return aiRl;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({})) as {
    query?: string;
    researchType?: string;
    followUp?: string;
    reportContext?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const {
    query = "",
    researchType = "custom",
    followUp = "",
    reportContext = "",
    conversationHistory = [],
  } = body;

  // ── Follow-up conversation mode ───────────────────────────────────────────
  if (followUp.trim()) {
    if (!reportContext.trim()) {
      return NextResponse.json({ error: "Report context required for follow-up" }, { status: 400 });
    }

    const messages = [
      { role: "system" as const, content: FOLLOWUP_SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Original research topic: "${reportContext}"\n\nReport context summary:\n${query}`,
      },
      // Inject previous conversation turns
      ...conversationHistory.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user" as const,
        content: followUp.trim(),
      },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI request failed" }, { status: 502 });

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ answer });
  }

  // ── Full research report mode ─────────────────────────────────────────────
  if (!query.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(researchType);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Research query: ${query.trim()}` },
      ],
      temperature: 0.7,
      max_tokens: 5000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return NextResponse.json({ error: "AI request failed", details: err }, { status: 502 });
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  if (!raw) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });

  try {
    const report = JSON.parse(raw);
    return NextResponse.json({
      report,
      query: query.trim(),
      researchType,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }
}
