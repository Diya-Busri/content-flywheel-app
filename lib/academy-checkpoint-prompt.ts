/**
 * System prompt + context assembly for the Academy Understanding Check chat.
 * Kept pure (no DB/network calls) so it's easy to unit test.
 *
 * Design goals (per spec):
 *  - Lesson content is the PRIMARY source; the model may explain established
 *    concepts needed to clarify it, but must distinguish "from the lesson"
 *    vs "additional context" when it does, and must never invent claims
 *    about what the lesson contains.
 *  - The selected quick-action is passed as STRUCTURED data (a discrete
 *    helpOption, not free-text the model has to infer), so behaviour is
 *    reliable regardless of phrasing.
 *  - Token/cost control: lesson text and conversation history are both
 *    capped, but caps always keep the MOST RECENT relevant content, never
 *    older content over newer.
 */
import type { Block } from "@/lib/academy-blocks";
import { parseLessonBlocks } from "@/lib/academy-blocks";
import type { CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";

const LESSON_TEXT_CHAR_CAP = 6000;
const MAX_HISTORY_MESSAGES = 12;

/** Flatten lesson blocks into plain text for the prompt — drops raw media URLs, keeps labels. */
export function extractLessonPlainText(content: string | null | undefined): string {
  const blocks: Block[] = parseLessonBlocks(content);
  const lines: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        if (b.content?.trim()) lines.push(`${"#".repeat(b.level ?? 2)} ${b.content.trim()}`);
        break;
      case "text":
        if (b.content?.trim()) lines.push(b.content.trim());
        break;
      case "callout":
        if (b.content?.trim()) lines.push(`[${(b.calloutType ?? "info").toUpperCase()}] ${b.content.trim()}`);
        break;
      case "checklist":
        for (const item of b.items ?? []) {
          if (item?.trim()) lines.push(`- ${item.trim()}`);
        }
        break;
      case "download":
        if (b.downloadLabel?.trim()) lines.push(`(Downloadable resource: ${b.downloadLabel.trim()})`);
        break;
      case "button":
        if (b.buttonLabel?.trim()) lines.push(`(Action: ${b.buttonLabel.trim()})`);
        break;
      default:
        break;
    }
  }
  const text = lines.join("\n\n").trim();
  return text.length > LESSON_TEXT_CHAR_CAP ? `${text.slice(0, LESSON_TEXT_CHAR_CAP)}\n\n[...lesson content truncated for length]` : text;
}

/** Learning objectives / key concepts are stored as JSON arrays, with a plain-newline fallback for hand-typed values. */
export function parseListField(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim());
  } catch {
    // not JSON — fall through
  }
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const HELP_OPTION_LABELS: Record<CheckpointHelpOption, string> = {
  explain_simpler: "Explain it more simply",
  example: "Show me an example",
  question: "I have a question",
  apply: "Help me apply this",
};

const HELP_OPTION_INSTRUCTIONS: Record<CheckpointHelpOption, string> = {
  explain_simpler: `The learner clicked "Explain it more simply". Give a concise, plain-language explanation of THIS lesson's core idea — beginner-friendly, short sentences, no jargon. Do not repeat the whole lesson back to them. After your explanation, ask a brief yes/no-style question checking whether they now understand or want more help.`,

  example: `The learner clicked "Show me an example". Give ONE practical, concrete example applying this lesson. If personalisation context is provided below, tailor the example to their real niche/business/audience/product — but only using facts actually given to you, never invented ones. If no useful personalisation context is provided, give a clear, well-labelled GENERIC example instead, and don't imply it's personalised. If a specific Content Flywheel tool from PLATFORM TOOLS below would be the natural next place to try this, name it and say where to find it in one short sentence.`,

  question: `The learner has a free-text question. Answer using the lesson content as your primary source. You may explain established, generally-reliable concepts needed to clarify the lesson, but when you go beyond what the lesson itself states, say so explicitly (e.g. "the lesson doesn't cover this directly, but..."). Stay scoped to this lesson and closely related follow-ups — you can answer a reasonably related question even if it's phrased differently from the lesson's wording, but do not turn into a general-purpose assistant. If you don't know or the lesson doesn't support an answer, say so plainly instead of guessing. If answering naturally points to a specific Content Flywheel tool from PLATFORM TOOLS below, mention it and where to find it.`,

  apply: `The learner clicked "Help me apply this". Turn the lesson into a short guided exercise. Ask ONE question at a time — never a bulleted list of questions. Use any personalisation context already provided below so you don't ask the learner for information already known about their business. Keep going one step at a time until you can produce a genuinely useful, specific output the learner can act on (not generic advice). When you produce that final output, prefix it clearly with "APPLICATION OUTPUT:" on its own line, followed by the result. Immediately after the result, on its own line, add "NEXT STEP:" followed by ONE sentence telling the learner exactly which Content Flywheel tool from PLATFORM TOOLS below to open next and why — only reference tools listed there, never invent a feature or route. This is required so the app can save and display the result as a distinct card. Do not use "APPLICATION OUTPUT:" or "NEXT STEP:" for anything else.`,
};

/**
 * Static, factual list of real Content Flywheel tools + where to find them — mirrors
 * the PLATFORM_TOOLS_NOTE already used in /api/chat/coach/route.ts so the checkpoint
 * gives the same honest, non-hallucinated navigation guidance. Only stable (non-beta)
 * tools are listed so the model never points a learner at something gated off for them.
 * The model may only NAME these in prose — the actual clickable CTA in the UI is still
 * driven solely by the lesson's admin-configured apply_tool_key (see
 * lib/academy-checkpoint-routing.ts), never by anything the model writes, so a
 * hallucinated or mismatched mention here can never produce a broken link.
 */
const PLATFORM_TOOLS_NOTE = `PLATFORM TOOLS — real Content Flywheel features you can point the learner to when it's genuinely the natural next step (mention by name + location, do not invent others):
- Digital Products (sidebar → Digital Products): create and publish a digital product; "Discover" inside it helps compare/validate niche and product ideas.
- AI Coach (sidebar → AI Coach): open-ended business/content/marketing help beyond this one lesson.
- Design Studio (sidebar → Design Studio): generate graphics, covers, and promotional images.
- Workspace (sidebar → Workspace): Business Brain notes/research and planning space — good for saving audience profiles, research, or plans.
- My Store (sidebar → My Store): manage their storefront and listings once they have something to sell.
- Content Calendar (sidebar → Content Calendar): schedule and plan content.
Only mention a tool when it's clearly useful for what the learner is doing right now — don't force one into every reply.`;

export interface CheckpointPromptInput {
  courseTitle: string;
  moduleTitle?: string | null;
  lessonTitle: string;
  lessonContent: string | null | undefined;
  learningObjectives?: string | null;
  keyConcepts?: string | null;
  helpOption: CheckpointHelpOption;
  /** Pre-fetched, already-minimal personalisation blocks (brand voice / Business Brain). Empty string if none available — never fabricated. */
  personalizationBlock?: string;
}

export function buildCheckpointSystemPrompt(input: CheckpointPromptInput): string {
  const lessonText = extractLessonPlainText(input.lessonContent);
  const objectives = parseListField(input.learningObjectives);
  const concepts = parseListField(input.keyConcepts);

  const parts = [
    `You are the Academy Understanding Check assistant for Content Flywheel — a short, focused helper that appears right after a learner finishes ONE lesson. Your only job is to help them understand and apply THIS lesson.`,

    `LESSON CONTEXT (primary source of truth):
Course: ${input.courseTitle}${input.moduleTitle ? ` › ${input.moduleTitle}` : ""}
Lesson: ${input.lessonTitle}

${lessonText || "(No written lesson content was provided — rely on the title and objectives below, and say so if you're unsure of specifics.)"}`,

    objectives.length ? `LEARNING OBJECTIVES:\n${objectives.map((o) => `- ${o}`).join("\n")}` : "",
    concepts.length ? `KEY CONCEPTS:\n${concepts.map((c) => `- ${c}`).join("\n")}` : "",

    `RULES:
- Treat the lesson content above as ground truth about what THIS lesson teaches. Never claim the lesson covers something it doesn't.
- You may explain established, generally-reliable concepts needed to clarify the lesson — clearly signal when you're adding context beyond the lesson itself.
- Never fabricate user data, business results, or claims about the user's business. Only use real details given to you in PERSONALISATION CONTEXT below.
- Keep answers concise and beginner-friendly. Do not overwhelm with long explanations.
- Don't refuse to help just because a question is phrased differently from the lesson's wording — if it's reasonably related, answer it.
- Never say the user understands just because they clicked a button — only the learner can confirm that themselves.
- Reply in PLAIN TEXT only — no markdown (no **bold**, no # headings, no backticks). This renders in a plain chat bubble, not a markdown viewer. Use line breaks and numbered/dashed lists written as plain text if you need structure.`,

    input.personalizationBlock?.trim()
      ? `PERSONALISATION CONTEXT (only real, saved user data — use it to tailor your answer; do not invent anything beyond it):\n${input.personalizationBlock.trim()}`
      : `PERSONALISATION CONTEXT: none available for this user yet. Do not pretend to personalise — give a clear, well-labelled generic answer instead.`,

    // Not included for "explain_simpler" — that mode is meant to stay short and lesson-only.
    input.helpOption !== "explain_simpler" ? PLATFORM_TOOLS_NOTE : "",

    `CURRENT HELP OPTION: ${HELP_OPTION_LABELS[input.helpOption]}\n${HELP_OPTION_INSTRUCTIONS[input.helpOption]}`,
  ];

  return parts.filter(Boolean).join("\n\n");
}

/** Keep the conversation tail (most recent, most relevant), never the head, when trimming for token cost. */
export function trimHistoryForContext<T>(messages: T[], maxMessages: number = MAX_HISTORY_MESSAGES): T[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(messages.length - maxMessages);
}

export interface ExtractedApplicationOutput {
  text: string;
  /** One-sentence pointer to a real, listed Content Flywheel tool — never a model-invented route. */
  nextStep?: string;
}

/** Extract the learner-facing exercise result (and optional next-step pointer) from an "apply" assistant reply, if present. */
export function extractApplicationOutput(assistantText: string): ExtractedApplicationOutput | null {
  const marker = "APPLICATION OUTPUT:";
  const idx = assistantText.indexOf(marker);
  if (idx === -1) return null;
  let rest = assistantText.slice(idx + marker.length).trim();

  const nextStepMarker = "NEXT STEP:";
  const nextIdx = rest.indexOf(nextStepMarker);
  let nextStep: string | undefined;
  if (nextIdx !== -1) {
    nextStep = rest.slice(nextIdx + nextStepMarker.length).trim() || undefined;
    rest = rest.slice(0, nextIdx).trim();
  }

  return rest.length > 0 ? { text: rest, nextStep } : null;
}

/**
 * Human-readable summary of how much help a learner needed on a checkpoint —
 * used only for the auto-tagged "needed extra help" Business Brain note (see
 * confirmUnderstandingAction), never shown to the learner themselves.
 */
export function describeHelpUsage(counts: Record<CheckpointHelpOption, number>): string {
  const parts: string[] = [];
  if (counts.question > 0) parts.push(`asked ${counts.question} question${counts.question === 1 ? "" : "s"}`);
  if (counts.explain_simpler > 0) {
    parts.push(`asked for a simpler explanation ${counts.explain_simpler} time${counts.explain_simpler === 1 ? "" : "s"}`);
  }
  if (counts.example > 0) parts.push(`requested ${counts.example} example${counts.example === 1 ? "" : "s"}`);
  if (parts.length === 0) return "used the Understanding Check";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Defensive backstop for the "plain text only" prompt rule — strips common
 * markdown tokens in case the model emits them anyway. Bubbles render plain
 * text (whitespace-pre-wrap), not a markdown viewer, so raw "**"/"#"/backtick
 * characters would otherwise show up literally.
 */
export function stripBasicMarkdown(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}
