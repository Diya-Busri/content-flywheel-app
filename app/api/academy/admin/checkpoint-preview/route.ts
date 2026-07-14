export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { isAdmin } from "@/lib/is-admin";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimitAsync } from "@/lib/rate-limit-ai";
import { checkSpendLimit } from "@/lib/spend-guard";
import { CHECKPOINT_HELP_OPTIONS, CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { buildCheckpointSystemPrompt, trimHistoryForContext, HELP_OPTION_LABELS } from "@/lib/academy-checkpoint-prompt";

export const runtime = "nodejs";

const MODEL = "gpt-4o-mini";

/**
 * Admin-only preview of the Understanding Check assistant against DRAFT lesson
 * content — i.e. whatever is currently in the lesson editor's unsaved state,
 * not what's persisted in the academy_lessons row. Deliberately does NOT touch
 * academy_lesson_checkpoints / academy_checkpoint_messages at all: this is a
 * scratch conversation for testing prompt behaviour, never a real learner
 * session, so nothing here should show up in analytics or a real checkpoint
 * record. History is round-tripped in the request body instead of persisted.
 */

type RequestBody = {
  helpOption?: string;
  message?: string;
  lessonTitle?: string;
  lessonContent?: string;
  learningObjectives?: string;
  keyConcepts?: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

function isHelpOption(value: unknown): value is CheckpointHelpOption {
  return typeof value === "string" && (CHECKPOINT_HELP_OPTIONS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!isHelpOption(body.helpOption)) {
      return NextResponse.json({ error: "A valid helpOption is required" }, { status: 400 });
    }
    const helpOption = body.helpOption;
    const isFreeText = helpOption === "question" || (helpOption === "apply" && typeof body.message === "string" && body.message.trim().length > 0);
    if (isFreeText && (!body.message || !body.message.trim())) {
      return NextResponse.json({ error: "message is required for this help option" }, { status: 400 });
    }
    const messageText = isFreeText ? body.message!.trim().slice(0, 4000) : HELP_OPTION_LABELS[helpOption];

    // Still cost/abuse-protected even though it's an admin tool — same guards as the real endpoint.
    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = await checkAiRateLimitAsync(userId);
    if (rl) return rl;
    const spendGuard = await checkSpendLimit("openai", userId);
    if (spendGuard) return spendGuard;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });

    const systemPrompt = buildCheckpointSystemPrompt({
      courseTitle: "(Preview)",
      moduleTitle: null,
      lessonTitle: body.lessonTitle?.trim() || "Untitled lesson",
      lessonContent: body.lessonContent ?? "",
      learningObjectives: body.learningObjectives ?? null,
      keyConcepts: body.keyConcepts ?? null,
      helpOption,
      // No personalisation in preview mode — this is about testing the lesson's
      // own prompt/content, not any particular learner's data.
      personalizationBlock: "",
    });

    const history = trimHistoryForContext(Array.isArray(body.history) ? body.history.slice(-20) : []);
    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: messageText },
    ];

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: openaiMessages,
      stream: true,
      max_tokens: 900,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[academy-checkpoint-preview]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed" }, { status: 500 });
  }
}
