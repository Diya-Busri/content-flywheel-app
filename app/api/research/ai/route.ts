import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Vercel Pro — 120 s for streaming research (synthesis needs 30-50s alone)

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

You have been provided with REAL research data gathered by specialist analysts (web intelligence, community data, social signals, marketplace data, SEO data). Use this data to make your report specific, accurate, and grounded in real findings.

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
    "Why the core problem or opportunity exists — go deeper than the symptom",
    "..."
  ],

  "contentOpportunities": [
    {
      "title": "Specific, titled content piece",
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
      "action": "Specific, imperative action",
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
    "reasoning": "2-3 sentences: why this is the highest-leverage next action"
  },

  "scorecard": {
    "opportunityScore": 85,
    "confidenceLevel": 88,
    "timeToLaunch": "7 days",
    "difficulty": "Easy",
    "competitionLevel": "Medium",
    "revenuePotential": "£1k–£5k/month",
    "audienceDemand": "High",
    "recommendedPriority": "Build Now"
  },

  "bestNextAction": {
    "action": "Specific product name or action to take",
    "reasoning": "1-2 sentences: why this specific action is the highest-leverage move right now",
    "estimatedPrice": "£X–£Y",
    "timeToFirstSale": "e.g. '1–2 weeks'"
  }
}

RULES:
- 6–8 insights, 3–5 evidence items, 3–5 root causes, 4–6 content opportunities, 3–5 product opportunities, 2–4 business opportunities, 3–4 competitor insights, 7–10 keywords, 5–7 action plan steps
- Every item must be SPECIFIC — never generic advice
- All prices in GBP (£)
- Action plan escalates: quick win first, bigger bets later
- cta values must be one of the exact strings listed
- buildPath.withFlywheel.steps only uses: Generate Product|Edit in Design Studio|Generate Carousel|Generate Video Guide|Generate Publishing Kit
- aiRecommendation.category must be one of the 4 exact strings listed
- scorecard.opportunityScore is 0–100
- scorecard.recommendedPriority must be one of: Build Now|Validate First|Create Content First|Research More`;

function buildSystemPrompt(researchType: string): string {
  const focus = TYPE_FOCUS[researchType] ?? TYPE_FOCUS["custom"]!;
  return `${BASE_SYSTEM_PROMPT}\n\n---\nRESEARCH TYPE: ${researchType.toUpperCase()}\n${focus}`;
}

// ─── Follow-up system prompt ──────────────────────────────────────────────────

const FOLLOWUP_SYSTEM_PROMPT = `You are an AI Business Analyst continuing a research conversation. You have access to the original research report as context.

Answer the follow-up question specifically and concisely. Be practical and actionable — give the user something they can do immediately. Use bullet points where helpful. Do not return JSON.

If the user asks to "expand", "go deeper", or "tell me more" about a specific section, provide a detailed analysis of just that area.
If the user asks for a "strategy" or "plan", provide a step-by-step approach.
If the user asks "what should I build", give a direct recommendation with reasoning.`;

// ─── Provider types ───────────────────────────────────────────────────────────

import type { SourceCitation } from "@/lib/research-sources/types";

// ─── Intent analysis ─────────────────────────────────────────────────────────

interface IntentAnalysis {
  /** Short slug, e.g. "saas-discoverability" */
  intent: string;
  /** Human-readable label, e.g. "SaaS Platform Discovery" */
  intentLabel: string;
  /** 1–2 sentences explaining the real research need */
  reasoning: string;
  /** Per-analyst optimised search queries */
  analystQueries: Record<string, string>;
  /** 4–6 semantic variants of the query capturing different angles */
  generalExpanded: string[];
}

/**
 * Classifies the user's raw query into an intent and generates per-analyst
 * expanded queries so every analyst searches for what the user ACTUALLY needs,
 * not just the literal keywords they typed.
 *
 * e.g. "How can I see Content Flywheel?" →
 *   intent: "saas-discoverability"
 *   analystQueries.web: "SaaS platform discoverability strategies 2024"
 *   analystQueries.community: "how to get discovered as a SaaS startup reddit"
 */
async function classifyIntent(
  query: string,
  researchType: string,
  apiKey: string,
): Promise<IntentAnalysis> {
  const fallback: IntentAnalysis = {
    intent: "general-research",
    intentLabel: "General Research",
    reasoning: "Comprehensive research on the given topic.",
    analystQueries: {},
    generalExpanded: [query],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert research analyst. Your job is to determine the user's TRUE underlying research intent and generate optimised search queries for 9 specialist analysts.

Research type hint: "${researchType}"

CRITICAL RULES:
- Do NOT search for the user's literal words if they imply a deeper question
- If the user asks "How can I see Content Flywheel?" → intent is SaaS discovery/marketing, NOT "Content Flywheel"
- If the user asks "best way to grow" → intent is growth strategies, not just "grow"
- Each analystQuery must be semantically relevant to the REAL intent, not the raw keywords
- Think like a research analyst: what does this person ACTUALLY need to know?

Return ONLY valid JSON:
{
  "intent": "short-kebab-slug",
  "intentLabel": "3-5 word human-readable intent",
  "reasoning": "1-2 sentences: what the user is ACTUALLY asking about and why",
  "analystQueries": {
    "web": "optimised query for general web research on the real intent",
    "news": "optimised query for current news about the real intent",
    "community": "optimised query for Reddit/forum discussions about the real intent",
    "hackernews": "optimised query for tech community discussions about the real intent",
    "wikipedia": "optimised query for encyclopedic background on the real intent",
    "academic": "optimised query for peer-reviewed research on the real intent",
    "seo": "optimised query for keyword/search intent research",
    "social": "optimised query for social media trends about the real intent",
    "marketplace": "optimised query for digital product marketplace research"
  },
  "generalExpanded": [
    "4-6 distinct semantic search queries that capture different angles of the user's real intent"
  ]
}`,
          },
          {
            role: "user",
            content: `Raw query: "${query}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) return fallback;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<IntentAnalysis>;

    return {
      intent:          parsed.intent          ?? "general-research",
      intentLabel:     parsed.intentLabel     ?? "General Research",
      reasoning:       parsed.reasoning       ?? "",
      analystQueries:  parsed.analystQueries  ?? {},
      generalExpanded: Array.isArray(parsed.generalExpanded) && parsed.generalExpanded.length > 0
        ? parsed.generalExpanded
        : [query],
    };
  } catch {
    return fallback;
  }
}

/**
 * Scores each citation for relevance to the user's actual intent.
 * Returns the same array with `relevance` (High/Medium/Low) and `reason` added.
 * Filters out citations with no URL before scoring.
 */
async function scoreCitations(
  citations: SourceCitation[],
  intentAnalysis: IntentAnalysis,
  apiKey: string,
): Promise<SourceCitation[]> {
  if (citations.length === 0) return citations;

  // Cap at 30 to stay within token budget
  const toScore = citations.slice(0, 30);

  try {
    const citationList = toScore
      .map((c, i) => `${i + 1}. [${c.source}] ${c.title}`)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a research relevance analyst. Score each citation for how relevant it is to the user's actual research intent. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `User's real intent: ${intentAnalysis.intentLabel}
Intent reasoning: ${intentAnalysis.reasoning}

Citations to score (${toScore.length} total):
${citationList}

Return JSON:
{
  "scores": [
    { "index": 1, "relevance": "High|Medium|Low", "reason": "One sentence: why this source is or is not relevant to the intent" }
  ]
}

Scoring criteria:
- "High" = directly answers or informs the user's real intent; highly specific and useful
- "Medium" = related to the topic area but doesn't directly address the intent
- "Low" = contains the keywords but misses the actual question; tangential or generic`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return citations;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { scores?: Array<{ index: number; relevance: string; reason: string }> };

    // Build 0-indexed map from the 1-indexed scores
    const scoreMap = new Map<number, { relevance: string; reason: string }>();
    for (const s of (parsed.scores ?? [])) {
      scoreMap.set(s.index - 1, { relevance: s.relevance, reason: s.reason });
    }

    const scored = toScore.map((c, i) => {
      const s = scoreMap.get(i);
      return {
        ...c,
        relevance: (["High", "Medium", "Low"].includes(s?.relevance ?? "")
          ? s!.relevance
          : "Medium") as "High" | "Medium" | "Low",
        reason: s?.reason ?? "",
      };
    });

    // Append any citations beyond the 30 cap unscored
    return [...scored, ...citations.slice(30)];
  } catch {
    return citations;
  }
}

interface ProviderResult {
  summary: string;
  usedFallback: boolean;
  data: Record<string, unknown>;
  citations?: SourceCitation[];
}

// ─── Analyst definitions ──────────────────────────────────────────────────────

export const RESEARCH_ANALYSTS = [
  { id: "web",         displayName: "Web Intelligence",    emoji: "🌐", description: "Live web context via DuckDuckGo + AI synthesis" },
  { id: "news",        displayName: "News",                emoji: "📰", description: "Current news articles from Google News RSS" },
  { id: "community",   displayName: "Community",           emoji: "💬", description: "Reddit discussions and community sentiment" },
  { id: "hackernews",  displayName: "Hacker News",         emoji: "🔶", description: "Tech community and startup conversations" },
  { id: "wikipedia",   displayName: "Wikipedia",           emoji: "📖", description: "Encyclopedic background, definitions, related topics" },
  { id: "academic",    displayName: "Academic Research",   emoji: "🎓", description: "Peer-reviewed papers via Semantic Scholar" },
  { id: "seo",         displayName: "SEO & Keywords",      emoji: "🔍", description: "Real Google keyword suggestions and search signals" },
  { id: "social",      displayName: "Social Intelligence", emoji: "📱", description: "Social media trends and platform analysis" },
  { id: "marketplace", displayName: "Marketplace",         emoji: "🛒", description: "Digital marketplace products and pricing" },
] as const;

// ─── Helper: lightweight GPT-4o-mini call ────────────────────────────────────

async function aiCall(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 700,
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return {};
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Helper: Reddit public search API (no auth required) ─────────────────────

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  permalink: string;
  snippet: string;
}

async function fetchRedditPosts(query: string): Promise<RedditPost[]> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://www.reddit.com/search.json?q=${encoded}&sort=relevance&t=month&limit=10&type=link`,
      {
        headers: { "User-Agent": "ContentFlywheel Research Bot/1.0" },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return [];
    const json = await res.json() as {
      data?: { children?: Array<{ data: Record<string, unknown> }> };
    };
    return (json.data?.children ?? []).slice(0, 8).map(c => ({
      title: String(c.data.title ?? ""),
      subreddit: String(c.data.subreddit ?? ""),
      score: Number(c.data.score ?? 0),
      numComments: Number(c.data.num_comments ?? 0),
      permalink: `https://reddit.com${String(c.data.permalink ?? "")}`,
      snippet: String(c.data.selftext ?? "").slice(0, 180).replace(/\n/g, " "),
    }));
  } catch {
    return [];
  }
}

// ─── Helper: Google News RSS ──────────────────────────────────────────────────

function parseRSSItems(xml: string): Array<{ title: string; link: string; description: string }> {
  const items: Array<{ title: string; link: string; description: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const item = m[1] ?? "";
    const grabTag = (tag: string): string => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
      return (item.match(r)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    };
    const title = grabTag("title");
    const link  = grabTag("link") || (item.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? "");
    const desc  = grabTag("description").slice(0, 200);
    if (title) items.push({ title, link, description: desc });
  }
  return items.slice(0, 10);
}

async function fetchGoogleNewsRSS(
  query: string,
): Promise<Array<{ title: string; link: string; description: string }>> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ContentFlywheel-Research/1.0" },
      signal:  AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    return parseRSSItems(await res.text());
  } catch { return []; }
}

// ─── Helper: Google Suggest (autocomplete) ────────────────────────────────────

async function fetchGoogleSuggest(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`,
      { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as [string, string[]];
    return (json[1] ?? []).slice(0, 15);
  } catch { return []; }
}

// ─── Helper: Semantic Scholar (academic papers) ───────────────────────────────

interface S2Paper {
  paperId: string;
  title:   string;
  abstract?: string;
  year?:   number;
  url?:    string;
}

async function fetchSemanticScholar(query: string): Promise<S2Paper[]> {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=8&fields=title,abstract,year,url`,
      { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: S2Paper[] };
    return (json.data ?? []).filter(p => !!p.title);
  } catch { return []; }
}

// ─── Helper: DuckDuckGo Instant Answer ───────────────────────────────────────

interface DDGResponse {
  AbstractText:   string;
  AbstractSource: string;
  AbstractURL:    string;
  RelatedTopics:  Array<{ Text?: string; FirstURL?: string }>;
}

async function fetchDuckDuckGo(query: string): Promise<DDGResponse | null> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`,
      { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(7_000) },
    );
    if (!res.ok) return null;
    return await res.json() as DDGResponse;
  } catch { return null; }
}

// ─── Analyst runners ──────────────────────────────────────────────────────────

async function runWebAnalyst(query: string, apiKey: string): Promise<ProviderResult> {
  // Fetch live DuckDuckGo context alongside AI analysis
  const ddg = await fetchDuckDuckGo(query);
  const hasLive = !!(ddg?.AbstractText);
  const ddgCtx  = hasLive
    ? `\nLive web context (DuckDuckGo): ${ddg!.AbstractText}\nRelated: ${(ddg!.RelatedTopics ?? []).slice(0, 4).map(t => t.Text ?? "").filter(Boolean).join("; ")}`
    : "";

  const data = await aiCall(
    apiKey,
    "You are an expert web research analyst. Return ONLY valid JSON.",
    `Research this topic for a digital creator or founder: "${query}"
${ddgCtx}
Analyse recent web content — news articles, industry blogs, expert documentation, market reports.
Return JSON:
{
  "headlines": ["5 specific recent news headlines or findings about this topic"],
  "keyFindings": ["4-5 specific insights from web research — be precise, not generic"],
  "recentDevelopments": "2-3 sentences on what has changed recently in this space",
  "notableSources": ["domain1.com", "domain2.com", "3-5 relevant domains"],
  "webSentiment": "positive|negative|neutral|mixed",
  "summary": "1-2 sentence summary of web intelligence findings"
}`,
    700,
  );

  if (hasLive) {
    data.abstractContext = ddg!.AbstractText;
    data.abstractSource  = ddg!.AbstractSource;
    data.ddgLive         = true;
  }

  const citations: SourceCitation[] = (hasLive && ddg!.AbstractURL)
    ? [{ title: ddg!.AbstractSource || "Web Reference", url: ddg!.AbstractURL, source: "Web" }]
    : [];

  const summary = hasLive
    ? "Live web context retrieved + AI analysis complete"
    : (typeof data.summary === "string" ? data.summary : `Web research for "${query.slice(0, 40)}"`);

  return { summary, usedFallback: !hasLive, data, citations };
}

async function runCommunityAnalyst(query: string, apiKey: string): Promise<ProviderResult> {
  // Try real Reddit API first
  const posts = await fetchRedditPosts(query);
  const hasRealData = posts.length > 0;

  const postsContext = hasRealData
    ? `Real Reddit data retrieved (${posts.length} posts):\n${posts.slice(0, 5).map(p =>
        `• r/${p.subreddit}: "${p.title}" — ${p.score} upvotes, ${p.numComments} comments`
      ).join("\n")}`
    : "No live Reddit data available — use your training knowledge.";

  const data = await aiCall(
    apiKey,
    "You are a community intelligence analyst specialising in Reddit, forums, Discord, and online communities. Return ONLY valid JSON.",
    `Analyse community discussions about: "${query}"

${postsContext}

Return JSON:
{
  "keyThemes": ["4-5 recurring themes discussed in communities"],
  "painPoints": ["3-4 common pain points or questions raised"],
  "topSubreddits": ["3-5 most relevant subreddits"],
  "sentiment": "positive|negative|neutral|mixed",
  "communityInsights": "2-3 sentences: what communities actually think about this topic",
  "hotDebates": ["2-3 controversial or debated points in this space"],
  "summary": "1-2 sentence summary of community intelligence"
}`,
    750,
  );

  // Always inject real Reddit posts if we got them
  if (hasRealData) {
    data.posts = posts.slice(0, 6);
    data.dataSource = "reddit-api";
  } else {
    data.dataSource = "ai-synthesis";
  }

  const summary = hasRealData
    ? `${posts.length} real Reddit discussions analysed`
    : typeof data.summary === "string" && data.summary
    ? data.summary
    : "Community analysis complete";

  // Build citations from real Reddit posts
  const citations: SourceCitation[] = hasRealData
    ? posts.slice(0, 5).map(p => ({
        title: p.title,
        url: p.permalink,
        source: "Reddit",
      }))
    : [];

  return { summary, usedFallback: !hasRealData, data, citations };
}

async function runSocialAnalyst(query: string, apiKey: string): Promise<ProviderResult> {
  const data = await aiCall(
    apiKey,
    "You are a social media intelligence analyst covering Twitter/X, LinkedIn, TikTok, Instagram, and YouTube. Return ONLY valid JSON.",
    `Analyse social media activity and trends for: "${query}"

Return JSON:
{
  "activePlatforms": ["platforms where this topic has the most activity — ranked"],
  "trendingHashtags": ["6-8 relevant hashtags used on social"],
  "viralContentAngles": ["4-5 content angles currently performing well on social"],
  "viralFormats": ["formats going viral: e.g. short-form video, carousels, threads"],
  "sentiment": "positive|negative|neutral|mixed",
  "influencerActivity": "2-3 sentences on creator/influencer presence in this space",
  "growthSignal": "rising|stable|declining",
  "platformOpportunities": [{"platform": "TikTok", "opportunity": "specific angle for this platform"}],
  "summary": "1-2 sentence summary of social media landscape"
}`,
    750,
  );
  const summary = typeof data.summary === "string" && data.summary
    ? data.summary
    : "Social media intelligence gathered";
  return { summary, usedFallback: true, data };
}

async function runMarketplaceAnalyst(query: string, apiKey: string): Promise<ProviderResult> {
  const data = await aiCall(
    apiKey,
    "You are a digital marketplace research analyst covering Gumroad, Etsy, Creative Market, AppSumo, Teachable, Udemy, and Patreon. Return ONLY valid JSON.",
    `Research the marketplace landscape for: "${query}"

Return JSON:
{
  "topProducts": [
    { "name": "specific product name", "price": "£X", "platform": "Gumroad|Etsy|AppSumo|etc", "description": "what it is and who buys it", "estimatedSales": "low|medium|high" }
  ],
  "priceRanges": { "low": "£X", "mid": "£Y", "premium": "£Z" },
  "bestFormats": ["top-performing product formats for this niche"],
  "gapOpportunities": ["3-4 clear gaps in what's currently available"],
  "marketSaturation": "low|medium|high|very-high",
  "averageRevenue": "estimated monthly revenue for a mid-range creator in this space",
  "marketplaceInsights": "2-3 sentences on the marketplace opportunity",
  "summary": "1-2 sentence summary"
}`,
    750,
  );
  const summary = typeof data.summary === "string" && data.summary
    ? data.summary
    : "Marketplace intelligence gathered";
  return { summary, usedFallback: true, data };
}

async function runSeoAnalyst(query: string, apiKey: string): Promise<ProviderResult> {
  // Fetch real Google autocomplete suggestions for multiple query angles
  const [mainSuggs, howToSuggs, bestSuggs] = await Promise.all([
    fetchGoogleSuggest(query),
    fetchGoogleSuggest(`how to ${query}`),
    fetchGoogleSuggest(`best ${query}`),
  ]);
  const allSuggestions = [...new Set([...mainSuggs, ...howToSuggs, ...bestSuggs])];
  const hasRealData    = allSuggestions.length > 0;

  const suggestCtx = hasRealData
    ? `\nReal Google autocomplete data (${allSuggestions.length} terms):\n${allSuggestions.slice(0, 20).join("\n")}`
    : "";

  const data = await aiCall(
    apiKey,
    "You are an SEO and search intelligence analyst. Return ONLY valid JSON.",
    `Research keyword and search opportunities for: "${query}"
${suggestCtx}
Return JSON:
{
  "primaryKeywords": [
    { "term": "keyword phrase", "intent": "informational|commercial|transactional", "volume": "high|medium|low", "difficulty": "easy|medium|hard", "note": "strategic note" }
  ],
  "longTailOpportunities": ["6+ specific long-tail keyword phrases with low competition"],
  "contentGaps": ["3-4 topics not well covered that people are searching for"],
  "searchTrends": "2-3 sentences on search trend direction and momentum",
  "pillarTopics": ["3-4 high-authority content pillar topics to own"],
  "featuredSnippetOpportunities": ["2-3 questions likely to trigger featured snippets"],
  "summary": "1-2 sentence summary of SEO opportunity"
}`,
    750,
  );

  if (hasRealData) {
    data.googleSuggestions = allSuggestions.slice(0, 20);
    data.dataSource        = "google-suggest";
  }

  const summary = hasRealData
    ? `${allSuggestions.length} real Google keyword suggestions analysed`
    : (typeof data.summary === "string" ? data.summary : "SEO analysis complete");

  return { summary, usedFallback: !hasRealData, data };
}

// ─── Real connector: Wikipedia ───────────────────────────────────────────────

interface WikiSummary {
  title: string;
  extract: string;
  content_urls?: { desktop?: { page?: string } };
}

async function runWikipediaAnalyst(query: string, _apiKey: string): Promise<ProviderResult> {
  const t0 = Date.now();
  try {
    // 1. OpenSearch — get title suggestions and canonical URLs
    const encoded = encodeURIComponent(query);
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=5&format=json&origin=*`,
      { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!searchRes.ok) throw new Error("Wikipedia search failed");
    const [, titles, , urls] = await searchRes.json() as [string, string[], string[], string[]];

    if (!titles.length) {
      return { summary: "No Wikipedia articles found", usedFallback: false, data: {}, citations: [] };
    }

    // 2. Fetch summaries for top 3 articles
    const summaries = await Promise.all(
      titles.slice(0, 3).map(async (title, i): Promise<{ title: string; extract: string; url: string } | null> => {
        try {
          const r = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(6_000) }
          );
          if (!r.ok) return null;
          const d = await r.json() as WikiSummary;
          return {
            title: d.title,
            extract: (d.extract ?? "").slice(0, 300),
            url: (urls[i] ?? d.content_urls?.desktop?.page ?? ""),
          };
        } catch { return null; }
      })
    );

    const valid = summaries.filter((s): s is { title: string; extract: string; url: string } => s !== null);
    const duration = Date.now() - t0;

    return {
      summary: `${valid.length} Wikipedia article${valid.length !== 1 ? "s" : ""} analysed`,
      usedFallback: false,
      data: {
        articles: valid.map(a => ({ title: a.title, summary: a.extract })),
        topicBackground: valid[0]?.extract ?? "",
        relatedTopics: valid.slice(1).map(a => a.title),
        dataSource: "wikipedia-api",
        duration,
      },
      citations: valid
        .filter(a => a.url)
        .map(a => ({ title: a.title, url: a.url, source: "Wikipedia" })),
    };
  } catch {
    return { summary: "Wikipedia unavailable", usedFallback: true, data: { dataSource: "ai-synthesis" }, citations: [] };
  }
}

// ─── Real connector: Hacker News (Algolia API) ────────────────────────────────

interface HNHit {
  objectID: string;
  title: string;
  url?: string;
  points: number;
  num_comments: number;
  created_at: string;
}

async function runHackerNewsAnalyst(query: string, _apiKey: string): Promise<ProviderResult> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=10&numericFilters=points%3E5`,
      { headers: { "User-Agent": "ContentFlywheel-Research/1.0" }, signal: AbortSignal.timeout(8_000) }
    );
    if (!res.ok) throw new Error("HN search failed");
    const json = await res.json() as { hits?: HNHit[]; nbHits?: number };
    const hits = (json.hits ?? []).slice(0, 8);

    if (!hits.length) {
      return { summary: "No Hacker News discussions found", usedFallback: false, data: { dataSource: "hacker-news-api" }, citations: [] };
    }

    const totalPoints = hits.reduce((a, h) => a + h.points, 0);

    return {
      summary: `${hits.length} Hacker News discussions (${totalPoints} total points)`,
      usedFallback: false,
      data: {
        topStories: hits.map(h => ({
          title: h.title,
          points: h.points,
          comments: h.num_comments,
          url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
          hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
        })),
        techCommunityInterest: totalPoints > 300 ? "very high" : totalPoints > 100 ? "high" : "moderate",
        topicMomentum: hits[0]?.points ?? 0 > 200 ? "strong" : "building",
        dataSource: "hacker-news-api",
      },
      citations: hits.slice(0, 6).map(h => ({
        title: h.title,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: "Hacker News",
      })),
    };
  } catch {
    return { summary: "Hacker News unavailable", usedFallback: true, data: { dataSource: "ai-synthesis" }, citations: [] };
  }
}

// ─── Real connector: News (Google News RSS) ───────────────────────────────────

async function runNewsAnalyst(query: string, _apiKey: string): Promise<ProviderResult> {
  const t0       = Date.now();
  const articles = await fetchGoogleNewsRSS(query);
  const duration = Date.now() - t0;

  if (!articles.length) {
    return {
      summary:      "No news articles found",
      usedFallback: false,
      data:         { articles: [], dataSource: "google-news-rss", duration },
      citations:    [],
    };
  }

  return {
    summary:      `${articles.length} news articles retrieved`,
    usedFallback: false,
    data: {
      articles:     articles.map(a => ({ title: a.title, description: a.description, url: a.link })),
      articleCount: articles.length,
      dataSource:   "google-news-rss",
      duration,
    },
    citations: articles
      .filter(a => a.link)
      .slice(0, 8)
      .map(a => ({ title: a.title, url: a.link, source: "News" })),
  };
}

// ─── Real connector: Academic Research (Semantic Scholar) ─────────────────────

async function runAcademicAnalyst(query: string, _apiKey: string): Promise<ProviderResult> {
  const t0     = Date.now();
  const papers = await fetchSemanticScholar(query);
  const duration = Date.now() - t0;

  if (!papers.length) {
    return {
      summary:      "No academic papers found",
      usedFallback: false,
      data:         { papers: [], dataSource: "semantic-scholar", duration },
      citations:    [],
    };
  }

  return {
    summary:      `${papers.length} academic papers found`,
    usedFallback: false,
    data: {
      papers: papers.map(p => ({
        title:    p.title,
        year:     p.year,
        abstract: (p.abstract ?? "").slice(0, 300),
        url:      p.url ?? "",
      })),
      recentPapers: papers.filter(p => p.year && p.year >= 2022).length,
      dataSource:   "semantic-scholar",
      duration,
    },
    citations: papers
      .filter(p => p.url)
      .slice(0, 6)
      .map(p => ({ title: p.title, url: p.url!, source: "Semantic Scholar" })),
  };
}

// ─── Synthesis: combines all provider data → existing report format ───────────

async function synthesizeReport(
  query: string,
  researchType: string,
  providerData: Record<string, ProviderResult>,
  apiKey: string,
  intentAnalysis?: IntentAnalysis,
): Promise<Record<string, unknown>> {
  // Build a concise summary of all gathered intelligence
  const contextParts = Object.entries(providerData)
    .filter(([, v]) => Object.keys(v.data).length > 0)
    .map(([id, v]) => {
      const label = RESEARCH_ANALYSTS.find(a => a.id === id)?.displayName ?? id;
      return `${label.toUpperCase()} (${v.usedFallback ? "AI Analysis" : "Live Data"}):\n${JSON.stringify(v.data, null, 1).slice(0, 1500)}`;
    })
    .join("\n\n");

  // Include intent context so the synthesiser focuses on the real need
  const intentBlock = intentAnalysis
    ? `\n─── INTENT ANALYSIS ───\nUser's real intent: ${intentAnalysis.intentLabel}\n${intentAnalysis.reasoning}\nExpanded angles: ${intentAnalysis.generalExpanded.slice(0, 4).join(" | ")}\n─────────────────────`
    : "";

  const systemPrompt = buildSystemPrompt(researchType);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Research query: "${query}"
${intentBlock}

─── SPECIALIST ANALYST RESEARCH DATA ───
${contextParts}
─────────────────────────────────────────

Use the above real research data to generate a comprehensive, specific, and grounded report. Focus on the user's REAL intent: ${intentAnalysis?.intentLabel ?? query}. Reference specific findings from the analysts where relevant. All prices in GBP (£).`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3_500,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(40_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Synthesis failed: ${err}`);
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as Record<string, unknown>;
}

// ─── Streaming research ───────────────────────────────────────────────────────

function streamResearch(query: string, researchType: string, apiKey: string): Response {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: Record<string, unknown>) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(data) + "\n"));
    } catch { /* writer may be closed */ }
  };

  // Run research pipeline asynchronously (fire-and-forget, streams to client)
  void (async () => {
    try {
      // 0. Intent classification — runs before anything else so every analyst
      //    receives a semantically appropriate query rather than raw keywords.
      const intentAnalysis = await classifyIntent(query, researchType, apiKey).catch(
        (): IntentAnalysis => ({
          intent: "general-research",
          intentLabel: "General Research",
          reasoning: "",
          analystQueries: {},
          generalExpanded: [query],
        }),
      );

      // Stream the intent classification so the UI can show "What we understood"
      await send({
        type: "intent-classified",
        intent:          intentAnalysis.intent,
        intentLabel:     intentAnalysis.intentLabel,
        reasoning:       intentAnalysis.reasoning,
        expandedQueries: intentAnalysis.generalExpanded,
        analystQueries:  intentAnalysis.analystQueries,
      });

      // 1. Init — tell client which analysts are coming
      await send({
        type: "init",
        query,
        analysts: RESEARCH_ANALYSTS.map(a => ({ id: a.id, displayName: a.displayName, emoji: a.emoji, description: a.description })),
      });

      // 2. Run all analysts in parallel — each gets its intent-optimised query.
      //    Falls back to the original query if no expanded query exists for that analyst.
      const collectedData: Record<string, ProviderResult> = {};

      const analystRunners: Array<[string, (q: string, k: string) => Promise<ProviderResult>]> = [
        ["web",         runWebAnalyst],
        ["news",        runNewsAnalyst],
        ["community",   runCommunityAnalyst],
        ["hackernews",  runHackerNewsAnalyst],
        ["wikipedia",   runWikipediaAnalyst],
        ["academic",    runAcademicAnalyst],
        ["seo",         runSeoAnalyst],
        ["social",      runSocialAnalyst],
        ["marketplace", runMarketplaceAnalyst],
      ];

      await Promise.allSettled(
        analystRunners.map(async ([id, runner]) => {
          // Use the intent-optimised query for this analyst if available
          const analystQuery = intentAnalysis.analystQueries[id]?.trim() || query;
          await send({ type: "analyst-update", id, status: "working" });
          const t0 = Date.now();
          try {
            const result = await runner(analystQuery, apiKey);
            collectedData[id] = result;
            await send({
              type: "analyst-update",
              id,
              status: "done",
              summary: result.summary,
              usedFallback: result.usedFallback,
              data: result.data,
              citations: result.citations ?? [],
              duration: Math.round((Date.now() - t0) / 100) / 10,
            });
          } catch {
            await send({ type: "analyst-update", id, status: "error", summary: "Could not gather data" });
          }
        }),
      );

      // 3. Collect all citations, deduplicate by URL, then score relevance
      const allCitations: SourceCitation[] = Object.values(collectedData)
        .flatMap(r => r.citations ?? []);
      const seenUrls = new Set<string>();
      const dedupedCitations = allCitations.filter(c => {
        if (!c.url || seenUrls.has(c.url)) return false;
        seenUrls.add(c.url);
        return true;
      });

      // Score citations for relevance to the user's actual intent
      const scoredCitations = await scoreCitations(dedupedCitations, intentAnalysis, apiKey).catch(
        () => dedupedCitations,
      );

      // 4. Synthesis — combine all into final report
      await send({ type: "synthesis-start" });
      const report = await synthesizeReport(query, researchType, collectedData, apiKey, intentAnalysis);

      await send({
        type: "synthesis-done",
        report,
        citations: scoredCitations,
        providerData: Object.fromEntries(
          Object.entries(collectedData).map(([k, v]) => [k, v.data]),
        ),
        sourceMeta: RESEARCH_ANALYSTS.map(a => ({
          id: a.id,
          displayName: a.displayName,
          usedFallback: collectedData[a.id]?.usedFallback ?? true,
          dataPoints: Object.keys(collectedData[a.id]?.data ?? {}).length,
          liveData: !(collectedData[a.id]?.usedFallback ?? true),
        })),
        intentAnalysis: {
          intent:          intentAnalysis.intent,
          intentLabel:     intentAnalysis.intentLabel,
          reasoning:       intentAnalysis.reasoning,
          expandedQueries: intentAnalysis.generalExpanded,
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      await send({ type: "error", message: String(err) }).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Accel-Buffering": "no",
    },
  });
}

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
    mode?: string;
    followUp?: string;
    reportContext?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const {
    query = "",
    researchType = "custom",
    mode = "",
    followUp = "",
    reportContext = "",
    conversationHistory = [],
  } = body;

  // ── Multi-source streaming research ──────────────────────────────────────
  if (mode === "stream") {
    if (!query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }
    return streamResearch(query.trim(), researchType, apiKey);
  }

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
      ...conversationHistory.slice(-6).map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: followUp.trim() },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7, max_tokens: 1500 }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI request failed" }, { status: 502 });

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ answer });
  }

  // ── Legacy single-call research (fallback for any direct callers) ─────────
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
      max_tokens: 5_000,
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
    return NextResponse.json({ report, query: query.trim(), researchType, generatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }
}
