/**
 * lib/marketing-managers.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * All 7 AI Marketing Manager runner functions.
 * Each manager:
 *   1. Loads existing content to avoid repetition
 *   2. Injects Business Memory for context
 *   3. Generates platform-specific content via Claude
 *   4. Returns ManagerOutput[], ManagerSuggestion[], MemoryFact[]
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  LaunchStageResults,
  MarketingManagerId,
  ManagerOutput,
  ManagerSuggestion,
  MemoryFact,
  MemoryCategory,
} from "@/db/schema/launch-schema";
import { buildMemoryContext } from "./memory-context";

const ai = new Anthropic();

function uid() { return Math.random().toString(36).slice(2, 10); }
function ts()  { return new Date().toISOString(); }

function parseJSON<T>(raw: string): T | null {
  try {
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    return JSON.parse(clean) as T;
  } catch { return null; }
}

/* ─── Manager metadata ───────────────────────────────────────────────────────── */

export type ManagerConfig = {
  id:               MarketingManagerId;
  label:            string;
  emoji:            string;
  description:      string;
  steps:            string[];
  memoryCategories: MemoryCategory[];
};

export const MANAGER_CONFIGS: Record<MarketingManagerId, ManagerConfig> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok Manager",
    emoji: "🎵",
    description: "Short-form video hooks, scripts, and trending content",
    steps: ["Researching trends", "Writing hooks", "Generating script", "Crafting CTA", "Saving outputs"],
    memoryCategories: ["brand", "audience", "marketing"],
  },
  instagram: {
    id: "instagram",
    label: "Instagram Manager",
    emoji: "📸",
    description: "Captions, carousels, stories, and hashtag strategy",
    steps: ["Analysing content gaps", "Writing captions", "Building carousel", "Selecting hashtags", "Saving outputs"],
    memoryCategories: ["brand", "audience", "marketing"],
  },
  youtube: {
    id: "youtube",
    label: "YouTube Manager",
    emoji: "▶️",
    description: "Titles, descriptions, and script outlines",
    steps: ["Researching search demand", "Writing titles", "Drafting description", "Building script outline", "Saving outputs"],
    memoryCategories: ["brand", "audience", "knowledge"],
  },
  x: {
    id: "x",
    label: "X Manager",
    emoji: "✖",
    description: "Tweet threads, viral posts, and engagement hooks",
    steps: ["Finding angles", "Writing thread", "Crafting viral posts", "Optimising hooks", "Saving outputs"],
    memoryCategories: ["brand", "marketing"],
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn Manager",
    emoji: "💼",
    description: "Professional posts and thought leadership content",
    steps: ["Identifying angle", "Writing post", "Crafting hook", "Finalising tone", "Saving outputs"],
    memoryCategories: ["brand", "audience"],
  },
  email: {
    id: "email",
    label: "Email Manager",
    emoji: "📧",
    description: "Subject lines, campaigns, and drip sequences",
    steps: ["Analysing audience", "Writing subjects", "Drafting email", "Optimising preview", "Saving outputs"],
    memoryCategories: ["brand", "audience", "marketing"],
  },
  seo: {
    id: "seo",
    label: "SEO Manager",
    emoji: "🔍",
    description: "Keywords, meta descriptions, and blog strategy",
    steps: ["Analysing keyword gaps", "Writing meta descriptions", "Building clusters", "Drafting blog outline", "Saving outputs"],
    memoryCategories: ["brand", "products", "knowledge"],
  },
};

/* ─── Context builders ───────────────────────────────────────────────────────── */

function buildBaseContext(results: LaunchStageResults): string {
  const lines: string[] = [];
  if (results.product?.productName) lines.push(`PRODUCT: "${results.product.productName}"`);
  if (results.store?.storeUrl)      lines.push(`STORE URL: ${results.store.storeUrl}`);

  const kw = results.research?.keywords?.slice(0, 6).map(k => k.term).join(", ");
  if (kw) lines.push(`TOP KEYWORDS: ${kw}`);

  const insights = results.research?.insights?.slice(0, 2).join("; ");
  if (insights) lines.push(`MARKET INSIGHTS: ${insights}`);

  const comps = results.research?.competitorInsights?.slice(0, 2).map(c => c.name).join(", ");
  if (comps) lines.push(`COMPETITORS: ${comps}`);

  if (results.marketing?.salesCopy?.headline) {
    lines.push(`HEADLINE: "${results.marketing.salesCopy.headline}"`);
  }

  return lines.join("\n") || "No product data yet — use the business goal for context.";
}

function buildExistingContent(managerId: MarketingManagerId, results: LaunchStageResults): string {
  const m = results.marketing;
  const dept = results.marketingDept?.managers;

  // Include both marketing worker outputs and manager's own previous outputs
  const managerOutputs = dept?.[managerId]?.outputs ?? [];
  const prevAngles = [...new Set(managerOutputs.slice(-10).map(o => o.angle).filter(Boolean))];
  const angleNote = prevAngles.length
    ? `\nANGLES ALREADY USED (do NOT repeat): ${prevAngles.join(" | ")}`
    : "";

  if (!m) return `No existing content — create fresh content for this platform.${angleNote}`;

  switch (managerId) {
    case "tiktok": {
      const hooks = m.tiktokHooks?.slice(0, 5).map(h => `• ${h}`).join("\n") ?? "";
      return `EXISTING HOOKS (build on or diverge from):\n${hooks || "None yet"}${angleNote}`;
    }
    case "instagram": {
      const caps = m.instagramCaptions?.slice(0, 3).map(c => `• ${c.slice(0, 100)}`).join("\n") ?? "";
      const cars = m.carousels?.length ? `${m.carousels.length} carousels produced` : "";
      return [`EXISTING CAPTIONS:\n${caps || "None"}`, cars].filter(Boolean).join("\n") + angleNote;
    }
    case "youtube": {
      return [
        m.seoTitle  ? `EXISTING SEO TITLE: "${m.seoTitle}"` : "",
        m.seoMetaDesc ? `EXISTING SEO DESC: "${m.seoMetaDesc}"` : "",
      ].filter(Boolean).join("\n") + angleNote || `No YouTube content yet.${angleNote}`;
    }
    case "x": {
      const posts = m.xPosts?.slice(0, 3).map(p => `• ${p.slice(0, 120)}`).join("\n") ?? "";
      return `EXISTING X POSTS:\n${posts || "None yet"}${angleNote}`;
    }
    case "linkedin": {
      const count = managerOutputs.filter(o => o.type === "linkedin_post").length;
      return `LinkedIn posts produced so far: ${count}${angleNote}`;
    }
    case "email": {
      const emails = m.emails?.map(e => e.name).join(", ") ?? "";
      return `EXISTING EMAILS: ${emails || "None"}${angleNote}`;
    }
    case "seo": {
      return [
        m.seoTitle   ? `CURRENT SEO TITLE: "${m.seoTitle}"` : "",
        m.seoMetaDesc ? `CURRENT META DESC: "${m.seoMetaDesc}"` : "",
        m.tags?.length ? `CURRENT TAGS: ${m.tags.join(", ")}` : "",
      ].filter(Boolean).join("\n") + angleNote || `No SEO content yet.${angleNote}`;
    }
    default: return `No existing content.${angleNote}`;
  }
}

/* ─── Run result type ────────────────────────────────────────────────────────── */

export type ManagerRunResult = {
  outputs:      ManagerOutput[];
  suggestions:  ManagerSuggestion[];
  summary:      string;
  memoryFacts:  MemoryFact[];
};

/* ─── Individual runner functions ────────────────────────────────────────────── */

async function runTikTok(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    messages: [{
      role: "user",
      content: `You are the TikTok Manager for a digital product creator. Produce high-converting TikTok content.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create a fresh batch of TikTok content. Take a different angle from anything already produced.

Return ONLY valid JSON:
{
  "hooks": ["hook1 (≤12 words, grabs attention instantly)", "hook2", "hook3"],
  "videoScript": {
    "hook": "Exact opening 3-second line",
    "body": "30-45 second content points (bullet format)",
    "cta": "Specific call to action"
  },
  "angle": "One phrase describing what makes this batch unique (e.g. 'problem-agitate-solve')",
  "suggestions": [
    { "label": "Specific next action for TikTok", "reason": "Why now", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    hooks: string[];
    videoScript: { hook: string; body: string; cta: string };
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse TikTok output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    ...data.hooks.map(h => ({ id: uid(), type: "hook", content: h, angle: data.angle, createdAt: now })),
    { id: uid(), type: "video_script", content: JSON.stringify(data.videoScript), angle: data.angle, createdAt: now },
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "tiktok_best_hook", label: "Best TikTok hook", value: data.hooks[0] ?? "", source: "manager:tiktok", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "tiktok_content_angle", label: "TikTok content angle", value: data.angle, source: "manager:tiktok", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `${data.hooks.length} hooks + 1 video script (${data.angle})`, memoryFacts };
}

async function runInstagram(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1600,
    messages: [{
      role: "user",
      content: `You are the Instagram Manager for a digital product creator. Produce scroll-stopping Instagram content.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create a fresh batch of Instagram content.

Return ONLY valid JSON:
{
  "captions": [
    "Full caption 1 with hashtags (150-300 chars)",
    "Full caption 2 — different tone/angle",
    "Full caption 3 — different tone/angle"
  ],
  "carousel": {
    "hook": "Slide 1 text — must make them swipe",
    "slides": ["Slide 2 text", "Slide 3 text", "Slide 4 text", "Slide 5 CTA text"],
    "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  },
  "angle": "What approach this batch uses",
  "suggestions": [
    { "label": "Next Instagram action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    captions: string[];
    carousel: { hook: string; slides: string[]; hashtags: string[] };
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse Instagram output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    ...data.captions.map(c => ({ id: uid(), type: "caption", content: c, angle: data.angle, createdAt: now })),
    { id: uid(), type: "carousel", content: JSON.stringify(data.carousel), angle: data.angle, createdAt: now },
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "instagram_hashtag_strategy", label: "Instagram hashtags", value: data.carousel.hashtags.join(", "), source: "manager:instagram", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "instagram_content_angle", label: "Instagram content angle", value: data.angle, source: "manager:instagram", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `3 captions + 1 carousel (${data.angle})`, memoryFacts };
}

async function runYouTube(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1600,
    messages: [{
      role: "user",
      content: `You are the YouTube Manager for a digital product creator. Create content that ranks and converts.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Generate a YouTube content package for this product.

Return ONLY valid JSON:
{
  "titles": [
    "Title 1 — SEO-optimised, curiosity hook",
    "Title 2 — different angle"
  ],
  "description": "Full YouTube description (200-350 words) with keywords, timestamps placeholder, and CTA",
  "scriptOutline": {
    "intro": "First 30 seconds — hook + promise",
    "sections": ["Section 1: ...", "Section 2: ...", "Section 3: ..."],
    "outro": "CTA + subscribe nudge"
  },
  "thumbnailConcept": "Visual concept for thumbnail (text, colours, imagery)",
  "targetKeyword": "Primary keyword this video targets",
  "angle": "What content angle this takes",
  "suggestions": [
    { "label": "Next YouTube action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    titles: string[];
    description: string;
    scriptOutline: { intro: string; sections: string[]; outro: string };
    thumbnailConcept: string;
    targetKeyword: string;
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse YouTube output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    ...data.titles.map(t => ({ id: uid(), type: "video_title", content: t, angle: data.angle, createdAt: now })),
    { id: uid(), type: "video_description", content: data.description, angle: data.angle, createdAt: now },
    { id: uid(), type: "script_outline", content: JSON.stringify(data.scriptOutline), angle: data.angle, createdAt: now },
    { id: uid(), type: "thumbnail_concept", content: data.thumbnailConcept, angle: data.angle, createdAt: now },
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "youtube_target_keyword", label: "YouTube target keyword", value: data.targetKeyword, source: "manager:youtube", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "youtube_best_title", label: "Best YouTube title", value: data.titles[0] ?? "", source: "manager:youtube", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `${data.titles.length} titles + description + script outline (${data.angle})`, memoryFacts };
}

async function runX(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    messages: [{
      role: "user",
      content: `You are the X (Twitter) Manager for a digital product creator. Write content that gets shares and clicks.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create a batch of X content.

Return ONLY valid JSON:
{
  "thread": {
    "tweets": [
      "Tweet 1 — hook (under 280 chars)",
      "Tweet 2 — elaboration",
      "Tweet 3 — key insight",
      "Tweet 4 — social proof or story",
      "Tweet 5 — CTA"
    ]
  },
  "standalonePosts": [
    "Viral standalone post 1 (under 280 chars)",
    "Viral standalone post 2",
    "Viral standalone post 3"
  ],
  "angle": "What makes this batch distinctive",
  "suggestions": [
    { "label": "Next X action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    thread: { tweets: string[] };
    standalonePosts: string[];
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse X output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    { id: uid(), type: "tweet_thread", content: JSON.stringify(data.thread), angle: data.angle, createdAt: now },
    ...data.standalonePosts.map(p => ({ id: uid(), type: "standalone_tweet", content: p, angle: data.angle, createdAt: now })),
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "x_content_angle", label: "X content angle", value: data.angle, source: "manager:x", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "x_best_hook", label: "Best X hook", value: data.thread.tweets[0] ?? "", source: "manager:x", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `1 thread (5 tweets) + ${data.standalonePosts.length} posts (${data.angle})`, memoryFacts };
}

async function runLinkedIn(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1400,
    messages: [{
      role: "user",
      content: `You are the LinkedIn Manager for a digital product creator. Write professional content that builds authority and drives sales.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create a LinkedIn post and micro-content package.

Return ONLY valid JSON:
{
  "post": "Full LinkedIn post (300-600 words). Use line breaks for readability. Include a strong opening hook, story or insight, key lesson, and CTA.",
  "hook": "First 2 lines only — must make people click 'see more'",
  "microContent": ["Short insight 1 (1-2 lines)", "Short insight 2", "Short insight 3"],
  "angle": "Thought leadership angle taken",
  "suggestions": [
    { "label": "Next LinkedIn action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    post: string;
    hook: string;
    microContent: string[];
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse LinkedIn output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    { id: uid(), type: "linkedin_post", content: data.post, angle: data.angle, createdAt: now },
    { id: uid(), type: "linkedin_hook", content: data.hook, angle: data.angle, createdAt: now },
    ...data.microContent.map(m => ({ id: uid(), type: "linkedin_micro", content: m, angle: data.angle, createdAt: now })),
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "linkedin_thought_leadership_angle", label: "LinkedIn thought leadership angle", value: data.angle, source: "manager:linkedin", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `1 full post + hook + ${data.microContent.length} micro-insights (${data.angle})`, memoryFacts };
}

async function runEmail(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: `You are the Email Manager for a digital product creator. Write emails that get opened and convert.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create an email package — avoid repeating any subject lines already listed.

Return ONLY valid JSON:
{
  "subjects": [
    "Subject line 1 (≤50 chars, curiosity)",
    "Subject line 2 — FOMO angle",
    "Subject line 3 — benefit-led",
    "Subject line 4 — question format",
    "Subject line 5 — personal"
  ],
  "email": {
    "name": "Email campaign name",
    "subject": "Best subject from above",
    "preview": "Preview text (under 90 chars)",
    "body": "Full email body (plain text, 200-400 words). Include greeting, story/hook, main message, CTA, sign-off."
  },
  "angle": "What emotional trigger or angle this email uses",
  "suggestions": [
    { "label": "Next email action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    subjects: string[];
    email: { name: string; subject: string; preview: string; body: string };
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse Email output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    ...data.subjects.map(s => ({ id: uid(), type: "email_subject", content: s, angle: data.angle, createdAt: now })),
    { id: uid(), type: "email", content: JSON.stringify(data.email), angle: data.angle, createdAt: now },
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "marketing", key: "email_best_subject", label: "Best email subject line", value: data.subjects[0] ?? "", source: "manager:email", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "email_conversion_angle", label: "Email conversion angle", value: data.angle, source: "manager:email", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `5 subject lines + 1 full email (${data.angle})`, memoryFacts };
}

async function runSEO(
  base: string, existing: string, memCtx: string, instruction?: string,
): Promise<ManagerRunResult> {
  const raw = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1600,
    messages: [{
      role: "user",
      content: `You are the SEO Manager for a digital product creator. Improve organic visibility with targeted keyword strategy and content.

${base}
${memCtx}
${existing}
${instruction ? `\nFOCUS FROM MISSION CONTROL: "${instruction}"\n` : ""}

Create an SEO content package.

Return ONLY valid JSON:
{
  "metaDescriptions": [
    "Meta 1 (150-160 chars, includes primary keyword, has CTA)",
    "Meta 2 — different angle"
  ],
  "keywordCluster": {
    "primary": "Main keyword to target",
    "secondary": ["keyword 2", "keyword 3", "keyword 4"],
    "longtail": ["longtail phrase 1", "longtail phrase 2", "longtail phrase 3"]
  },
  "blogOutline": {
    "title": "SEO blog post title",
    "targetKeyword": "Exact keyword this post targets",
    "sections": [
      "H2: Section 1 title",
      "H2: Section 2 title",
      "H2: Section 3 title",
      "H2: Section 4 (CTA section)"
    ],
    "wordCount": 1200
  },
  "angle": "What SEO opportunity this targets",
  "suggestions": [
    { "label": "Next SEO action", "reason": "Why", "priority": "high|medium|low" }
  ]
}`,
    }],
  });

  const text = raw.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
  const data = parseJSON<{
    metaDescriptions: string[];
    keywordCluster: { primary: string; secondary: string[]; longtail: string[] };
    blogOutline: { title: string; targetKeyword: string; sections: string[]; wordCount: number };
    angle: string;
    suggestions: Array<{ label: string; reason: string; priority: "high" | "medium" | "low" }>;
  }>(text);

  if (!data) throw new Error("Failed to parse SEO output");

  const now = ts();
  const outputs: ManagerOutput[] = [
    ...data.metaDescriptions.map(m => ({ id: uid(), type: "meta_description", content: m, angle: data.angle, createdAt: now })),
    { id: uid(), type: "keyword_cluster", content: JSON.stringify(data.keywordCluster), angle: data.angle, createdAt: now },
    { id: uid(), type: "blog_outline", content: JSON.stringify(data.blogOutline), angle: data.angle, createdAt: now },
  ];

  const suggestions: ManagerSuggestion[] = (data.suggestions ?? []).map(s => ({
    id: uid(), label: s.label, reason: s.reason, priority: s.priority, suggestedAt: now,
  }));

  const memoryFacts: MemoryFact[] = [
    { id: uid(), category: "knowledge", key: "seo_primary_keyword", label: "SEO primary keyword", value: data.keywordCluster.primary, source: "manager:seo", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "knowledge", key: "seo_longtail_keywords", label: "SEO long-tail keywords", value: data.keywordCluster.longtail.join(", "), source: "manager:seo", confidence: "medium", confirmedByUser: false, addedAt: now, updatedAt: now },
    { id: uid(), category: "marketing", key: "seo_blog_title", label: "Next SEO blog post title", value: data.blogOutline.title, source: "manager:seo", confidence: "high", confirmedByUser: false, addedAt: now, updatedAt: now },
  ];

  return { outputs, suggestions, summary: `2 meta descriptions + keyword cluster + blog outline (${data.angle})`, memoryFacts };
}

/* ─── Main dispatcher ────────────────────────────────────────────────────────── */

export async function runMarketingManager(
  managerId: MarketingManagerId,
  results: LaunchStageResults,
  instruction?: string,
): Promise<ManagerRunResult> {
  const config  = MANAGER_CONFIGS[managerId];
  const memCtx  = buildMemoryContext(results.memory, config.memoryCategories);
  const base    = buildBaseContext(results);
  const existing = buildExistingContent(managerId, results);

  switch (managerId) {
    case "tiktok":    return runTikTok(base, existing, memCtx, instruction);
    case "instagram": return runInstagram(base, existing, memCtx, instruction);
    case "youtube":   return runYouTube(base, existing, memCtx, instruction);
    case "x":         return runX(base, existing, memCtx, instruction);
    case "linkedin":  return runLinkedIn(base, existing, memCtx, instruction);
    case "email":     return runEmail(base, existing, memCtx, instruction);
    case "seo":       return runSEO(base, existing, memCtx, instruction);
    default:          throw new Error(`Unknown manager: ${managerId}`);
  }
}
