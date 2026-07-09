/**
 * POST /api/launch/validate
 * ─────────────────────────────────────────────────────────────────────────────
 * Classifies a user's launch goal before the pipeline starts.
 *
 * Intent types:
 *   "clear"   — Specific, actionable business idea → proceed
 *   "vague"   — Has direction but needs more detail → ask follow-up
 *   "no_idea" — User doesn't know what to build → open discovery mode
 *   "invalid" — Spam, nonsense, too short → block + show error
 *
 * Two-layer approach:
 *   1. Fast rule-based filter for obvious cases (no AI needed)
 *   2. GPT-4o-mini semantic classification for edge cases
 *
 * Returns: { valid: boolean, intent, suggestion? }
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

/* ─── Intent type ────────────────────────────────────────────────────────────── */

type Intent = "clear" | "vague" | "no_idea" | "invalid";

interface ValidateResult {
  valid:       boolean;
  intent:      Intent;
  suggestion?: string;
}

/* ─── Rule-based patterns (instant, no AI) ───────────────────────────────────── */

// Exact-match placeholders (case-insensitive)
const NO_IDEA_PHRASES = new Set([
  "idk", "i dont know", "i don't know", "i do not know",
  "not sure", "unsure", "no idea", "dunno", "haven't decided",
  "haven't thought about it", "undecided", "help me decide",
  "help me choose", "i need ideas", "suggest something",
  "i need help", "not decided", "no clue", "clueless",
]);

const INVALID_PHRASES = new Set([
  "test", "testing", "hello", "hi", "hey", "yo", "sup",
  "lol", "lmao", "haha", "hmm", "hm", "um", "uh",
  "ok", "okay", "yes", "no", "maybe", "sure", "fine",
  "kk", "k", "y", "n", "ok ok", "whatever", "anything",
  "nothing", "something", "everything", "stuff", "thing",
  "things", "blah", "meh", "nah", "nope", "yep",
  "asdf", "qwerty", "qwertyuiop", "zxcvbnm", "hjkl",
  "abc", "abcdef", "abcdefg", "123", "1234", "foo", "bar",
  "baz", "foobar", "lorem", "ipsum",
]);

// Patterns: keyboard spam, single/repeated chars, pure punctuation
const SPAM_PATTERNS = [
  /^(.)\1{2,}$/,                   // aaaa, zzzz, ...
  /^[qwerty]+$/i,                  // qwerty mashing
  /^[asdfghjkl]+$/i,               // home row mashing
  /^[zxcvbnm]+$/i,                 // bottom row mashing
  /^[^a-zA-Z\s]{4,}$/,             // no letters at all (symbols/numbers only)
  /^[\s\W]+$/,                     // whitespace + punctuation only
  /^.{1,9}$/,                      // fewer than 10 characters
];

function quickClassify(goal: string): Intent | null {
  const norm = goal.toLowerCase().replace(/['"!?.]/g, "").trim();

  if (!norm || norm.length < 5) return "invalid";

  // Check no-idea exact matches
  if (NO_IDEA_PHRASES.has(norm)) return "no_idea";

  // Check invalid exact matches
  if (INVALID_PHRASES.has(norm)) return "invalid";

  // Spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(norm)) return "invalid";
  }

  // Too short to be a real idea (under 15 meaningful chars)
  if (norm.replace(/\s/g, "").length < 12) return "invalid";

  return null; // needs AI classification
}

/* ─── AI classification ──────────────────────────────────────────────────────── */

async function aiClassify(goal: string): Promise<{ intent: Intent; suggestion?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: accept it if we can't check
    return { intent: "clear" };
  }

  const prompt = `You are validating a user's input for a digital product business idea launcher.

User input: "${goal}"

Classify the intent. Return ONLY valid JSON with no markdown or code fences:
{
  "intent": "clear" | "vague" | "no_idea" | "invalid",
  "suggestion": "optional one-sentence feedback for vague inputs"
}

Rules:
- "clear": Specific, actionable business idea with a recognisable target audience, product type, or niche. Even a short phrase like "fitness meal prep ebook" counts as clear. Proceed immediately.
- "vague": Has some direction but is missing a target audience, specific problem, or clear product type. Examples: "something about fitness", "a guide for people", "a planner". Ask for more detail.
- "no_idea": User explicitly indicates they don't know what to build or wants help deciding. Examples: "idk", "not sure", "help me pick", "i need an idea". Open discovery mode.
- "invalid": Gibberish, spam, offensive content, completely unrelated to business/products, test inputs, or too generic to be useful. Examples: "asdf", "hello world", "I like pizza".

IMPORTANT: Be permissive with "clear" — short but specific phrases are fine. Only mark as invalid if truly meaningless.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!res.ok) return { intent: "clear" }; // fail open — don't block on AI error

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Strip markdown fences if present
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as { intent?: string; suggestion?: string };

    const intent = (["clear", "vague", "no_idea", "invalid"].includes(parsed.intent ?? ""))
      ? parsed.intent as Intent
      : "clear";

    return { intent, suggestion: parsed.suggestion };
  } catch {
    return { intent: "clear" }; // fail open
  }
}

/* ─── Canned messages ────────────────────────────────────────────────────────── */

const MESSAGES: Record<Intent, string> = {
  clear:   "Your idea is ready to launch.",
  vague:   "That's a start — can you add more detail? Who is this for, and what specific problem does it solve?",
  no_idea: "It looks like you're not sure what to build yet.",
  invalid: "Please describe a real business idea. For example: \"A budgeting planner for university students\" or \"An AI prompt bundle for content creators\".",
};

/* ─── Route handler ──────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkApiRateLimit(userId);
  if (rl) return rl;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";

  if (!goal) {
    return NextResponse.json<ValidateResult>({ valid: false, intent: "invalid", suggestion: MESSAGES.invalid });
  }

  // Step 1: fast rule-based check
  const quickIntent = quickClassify(goal);
  if (quickIntent !== null) {
    return NextResponse.json<ValidateResult>({
      valid:      quickIntent === "clear",
      intent:     quickIntent,
      suggestion: MESSAGES[quickIntent],
    });
  }

  // Step 2: AI classification
  const { intent, suggestion } = await aiClassify(goal);

  return NextResponse.json<ValidateResult>({
    valid:      intent === "clear" || intent === "vague", // vague allowed through with a nudge
    intent,
    suggestion: suggestion ?? MESSAGES[intent],
  });
}
