export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { db } from "@/db/db";
import { brandVoiceTable } from "@/db/schema/brand-voice-schema";
import { getLessonById, getCourseById } from "@/db/queries/academy-queries";
import { academyModulesTable } from "@/db/schema/academy-schema";
import * as cq from "@/db/queries/academy-checkpoint-queries";
import { CHECKPOINT_HELP_OPTIONS, CheckpointHelpOption } from "@/db/schema/academy-checkpoints-schema";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimitAsync } from "@/lib/rate-limit-ai";
import { checkSpendLimit } from "@/lib/spend-guard";
import { isAcademyCheckpointEnabled } from "@/lib/academy/checkpoint-guard";
import { getUserMemoryContext } from "@/lib/user-memory";
import {
  buildCheckpointSystemPrompt,
  trimHistoryForContext,
  extractApplicationOutput,
  HELP_OPTION_LABELS,
} from "@/lib/academy-checkpoint-prompt";
import { logAcademyCheckpointEvent, ACADEMY_CHECKPOINT_EVENTS } from "@/lib/academy-checkpoint-analytics";

export const runtime = "nodejs";

const MODEL = "gpt-4o-mini"; // shared low-cost default used across the app (see /api/chat/coach)

/**
 * Simple in-memory "one request in flight per checkpoint" lock — belt-and-braces
 * against duplicate submissions (double-click, two tabs) in addition to the
 * client disabling its own controls while a request is outstanding. Same
 * in-memory-store pattern as lib/rate-limit-ai.ts; per-instance, which is
 * acceptable for this: worst case is one duplicate slips through on a
 * multi-instance deploy, not a correctness issue.
 */
const inFlightCheckpoints = new Set<string>();

type RequestBody = {
  helpOption?: string;
  /** Free-text message — only meaningful for helpOption "question", or a follow-up turn in "apply". */
  message?: string;
};

function isHelpOption(value: unknown): value is CheckpointHelpOption {
  return typeof value === "string" && (CHECKPOINT_HELP_OPTIONS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const lessonId = params.id;
  let lockedCheckpointId: string | null = null;

  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate the request BEFORE spending any rate-limit/spend-guard budget.
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!isHelpOption(body.helpOption)) {
      return NextResponse.json({ error: "A valid helpOption is required" }, { status: 400 });
    }
    const helpOption = body.helpOption;
    const isFreeText = helpOption === "question" || (helpOption === "apply" && typeof body.message === "string" && body.message.trim().length > 0);
    if (isFreeText && (!body.message || !body.message.trim())) {
      return NextResponse.json({ error: "message is required for this help option" }, { status: 400 });
    }

    // Structured behaviour selection — the client sends a discrete helpOption,
    // never relies on the model inferring intent from free text.
    const messageText = isFreeText ? body.message!.trim().slice(0, 4000) : HELP_OPTION_LABELS[helpOption];

    const enabled = await isAcademyCheckpointEnabled(userId);
    if (!enabled) return NextResponse.json({ error: "Understanding Check is not available yet" }, { status: 403 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;
    const rl = await checkAiRateLimitAsync(userId);
    if (rl) return rl;
    const spendGuard = await checkSpendLimit("openai", userId);
    if (spendGuard) return spendGuard;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });

    const lesson = await getLessonById(lessonId);
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

    const checkpoint = await cq.getOrCreateCheckpoint(userId, lessonId, lesson.courseId);

    if (inFlightCheckpoints.has(checkpoint.id)) {
      return NextResponse.json({ error: "A request is already in progress for this lesson's checkpoint." }, { status: 409 });
    }
    inFlightCheckpoints.add(checkpoint.id);
    lockedCheckpointId = checkpoint.id;

    // Persist the user's turn first — history fetched below already includes it,
    // so there's a single source of truth for what gets sent to the model.
    await cq.appendCheckpointMessage({ checkpointId: checkpoint.id, role: "user", content: messageText, helpOption });
    await cq.setLastHelpOption(checkpoint.id, helpOption);

    if (helpOption === "question" && isFreeText) {
      logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.QUESTION_SUBMITTED, {
        courseId: lesson.courseId,
        moduleId: lesson.moduleId,
        lessonId,
        helpOption,
      });
    }

    // "Struggling" signal — 3+ questions or 2+ "explain more simply" clicks on
    // this lesson. Never blocks anything; just lets the client offer a nudge
    // toward human support. Log once, the exact turn the threshold is crossed,
    // so admins can see it without every subsequent turn re-firing the event.
    const helpCounts = await cq.getHelpOptionUsageCounts(checkpoint.id);
    const struggling = cq.isStruggling(helpCounts);
    const justCrossedThreshold =
      (helpOption === "question" && helpCounts.question === 3) ||
      (helpOption === "explain_simpler" && helpCounts.explain_simpler === 2);
    if (justCrossedThreshold) {
      logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.STRUGGLE_DETECTED, {
        courseId: lesson.courseId,
        moduleId: lesson.moduleId,
        lessonId,
        helpOption,
      });
    }

    // Minimum useful personalisation for this help option — never the user's whole memory record.
    let personalizationBlock = "";
    if (helpOption !== "explain_simpler") {
      try {
        const [bv] = await db
          .select({ brandName: brandVoiceTable.brandName, tone: brandVoiceTable.tone, targetAudience: brandVoiceTable.targetAudience })
          .from(brandVoiceTable)
          .where(eq(brandVoiceTable.userId, userId))
          .limit(1);
        const bvLines = [
          bv?.brandName ? `Brand/creator name: ${bv.brandName}` : "",
          bv?.targetAudience ? `Niche/audience: ${bv.targetAudience}` : "",
          bv?.tone ? `Tone: ${bv.tone}` : "",
        ].filter(Boolean);

        const memoryQuery = `${lesson.title} — ${messageText}`.slice(0, 500);
        const memoryBlock = await getUserMemoryContext(userId, memoryQuery, 3);

        personalizationBlock = [bvLines.join("\n"), memoryBlock].filter(Boolean).join("\n\n");
      } catch (err) {
        console.warn("[academy-checkpoint] personalisation lookup failed:", err);
      }
    }

    const [course, moduleRows] = await Promise.all([
      getCourseById(lesson.courseId),
      db.select({ title: academyModulesTable.title }).from(academyModulesTable).where(eq(academyModulesTable.id, lesson.moduleId)).limit(1),
    ]);

    const systemPrompt = buildCheckpointSystemPrompt({
      courseTitle: course?.title ?? "Content Flywheel Academy",
      moduleTitle: moduleRows[0]?.title ?? null,
      lessonTitle: lesson.title,
      lessonContent: lesson.content,
      learningObjectives: lesson.learningObjectives,
      keyConcepts: lesson.keyConcepts,
      helpOption,
      personalizationBlock,
    });

    const historyRows = trimHistoryForContext(await cq.getCheckpointMessages(checkpoint.id));
    const openai = new OpenAI({ apiKey });
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...historyRows.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: openaiMessages,
      stream: true,
      max_tokens: 900,
    });

    const encoder = new TextEncoder();
    let accumulated = "";
    const checkpointId = checkpoint.id;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (struggling) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ struggling: true })}\n\n`));
          }
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
          }

          if (accumulated.trim()) {
            try {
              const assistantRow = await cq.appendCheckpointMessage({ checkpointId, role: "assistant", content: accumulated, helpOption });
              // Let the client know the real DB id for this reply so an opt-in
              // "Add a visual" click afterwards can persist against the right row.
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ assistantMessageId: assistantRow.id })}\n\n`));
              if (helpOption === "apply") {
                const output = extractApplicationOutput(accumulated);
                if (output) {
                  await cq.saveApplicationOutput(checkpointId, {
                    text: output.text,
                    nextStep: output.nextStep,
                    helpOption,
                    generatedAt: new Date().toISOString(),
                  });
                  logAcademyCheckpointEvent(userId, ACADEMY_CHECKPOINT_EVENTS.APPLICATION_COMPLETED, {
                    courseId: lesson.courseId,
                    moduleId: lesson.moduleId,
                    lessonId,
                    helpOption,
                  });
                }
              }
            } catch (persistErr) {
              console.warn("[academy-checkpoint] failed to persist assistant message:", persistErr);
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          inFlightCheckpoints.delete(checkpointId);
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
    if (lockedCheckpointId) inFlightCheckpoints.delete(lockedCheckpointId);
    console.error("[academy-checkpoint/chat]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkpoint chat failed" }, { status: 500 });
  }
}
