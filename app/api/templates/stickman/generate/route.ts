import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type StickmanPose =
  | "standing"
  | "thinking"
  | "sitting"
  | "celebrating"
  | "pointing"
  | "defeated"
  | "arms-raised"
  | "walking";

export type StickmanLayout = "left-presenter" | "center-presenter" | "right-presenter" | "desk-scene";
export type StickmanKeyObject =
  | "chart"
  | "clock"
  | "money"
  | "warning"
  | "audience"
  | "idea"
  | "brand";
export type StickmanCamera = "wide" | "medium";
export type StickmanShotTemplate =
  | "desk-explain"
  | "stand-explain"
  | "point-to-board"
  | "walk-and-talk"
  | "result-moment";

export type StickmanSceneSegment = "intro" | "main" | "cta" | "outro" | "cta-outro";

export interface StickmanScene {
  sceneIndex: number;
  /** Full narration read by TTS — can be longer than on-screen text. */
  caption: string;
  /** Short on-screen headline (viral Shorts / whiteboard style). */
  sceneTitle?: string;
  /** 2–3 punchy lines shown as a handwritten list while VO expands (tutorial-style). */
  bullets?: string[];
  pose: StickmanPose;
  layout: StickmanLayout;
  keyObject: StickmanKeyObject;
  camera: StickmanCamera;
  shotTemplate: StickmanShotTemplate;
  segment?: StickmanSceneSegment;
}

const CTA_GOAL_HINTS: Record<string, string> = {
  "Get followers": 'Include an explicit follow CTA (e.g. "Follow for more").',
  "Get saves": 'Ask viewers to save the video for later.',
  "Drive link clicks": "Mention link in bio or where to tap next.",
  "Get engagement": "Ask a specific comment or reply prompt.",
};

/** Every CTA beat must stack platform actions with the chosen goal (natural speech, not a list). */
const CTA_PLATFORM_ENGAGEMENT =
  "In the same CTA narration, also invite viewers to subscribe on YouTube or follow on TikTok, Reels, or Shorts, tap like, and share with someone who would find this useful — weave it into one or two conversational sentences, not a robotic checklist.";

function segmentForIndex(sceneCount: number, i: number): StickmanSceneSegment {
  if (sceneCount <= 0) return "main";
  if (sceneCount === 1) return "intro";
  if (sceneCount === 2) return i === 0 ? "intro" : "outro";
  if (sceneCount === 3) return i === 0 ? "intro" : i === 1 ? "main" : "cta-outro";
  if (i === 0) return "intro";
  if (i === sceneCount - 1) return "outro";
  if (i === sceneCount - 2) return "cta";
  return "main";
}

function assignSegments(scenes: StickmanScene[]): StickmanScene[] {
  const n = scenes.length;
  return scenes.map((s, i) => ({ ...s, segment: segmentForIndex(n, i) }));
}

/** Apply optional user-written lines; CTA/outro share the last scene when there are only 3 scenes. */
function applyScriptOverrides(
  scenes: StickmanScene[],
  opts: { introScript?: string; ctaScript?: string; outroScript?: string }
): StickmanScene[] {
  const n = scenes.length;
  if (n === 0) return scenes;
  const intro = opts.introScript?.replace(/\s+/g, " ").trim();
  const cta = opts.ctaScript?.replace(/\s+/g, " ").trim();
  const outro = opts.outroScript?.replace(/\s+/g, " ").trim();
  const next = scenes.map((s) => ({ ...s }));

  if (intro) next[0] = { ...next[0], caption: intro };

  if (n >= 4) {
    if (cta) next[n - 2] = { ...next[n - 2], caption: cta };
    if (outro) next[n - 1] = { ...next[n - 1], caption: outro };
  } else if (n === 3) {
    if (cta && outro) {
      next[2] = { ...next[2], caption: `${cta} ${outro}`.replace(/\s+/g, " ").trim() };
    } else if (cta) {
      next[2] = { ...next[2], caption: cta };
    } else if (outro) {
      next[2] = { ...next[2], caption: outro };
    }
  } else if (n === 2) {
    const tail = [cta, outro].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (tail) next[1] = { ...next[1], caption: tail };
  }

  return next;
}

function buildFallbackScenes(topic: string, sceneCount: number): StickmanScene[] {
  const keyObjects: StickmanKeyObject[] = ["idea", "brand", "chart", "audience", "clock", "money", "warning"];
  const layouts: StickmanLayout[] = ["left-presenter", "center-presenter", "right-presenter", "desk-scene"];
  const poses: StickmanPose[] = ["standing", "pointing", "thinking", "sitting", "walking", "celebrating"];
  const shots: StickmanShotTemplate[] = [
    "stand-explain",
    "point-to-board",
    "desk-explain",
    "walk-and-talk",
    "result-moment",
  ];

  const rows = Array.from({ length: sceneCount }, (_, i) => {
    if (sceneCount === 1) {
      return {
        sceneIndex: 0,
        caption: `Here is the essential idea behind ${topic}, why it matters, and what to do next: subscribe or follow for more, hit like if this helped, and share it with someone who needs the breakdown.`,
        pose: "pointing" as StickmanPose,
        layout: "center-presenter" as StickmanLayout,
        keyObject: "idea" as StickmanKeyObject,
        camera: "wide" as StickmanCamera,
        shotTemplate: "stand-explain" as StickmanShotTemplate,
        segment: "intro" as StickmanSceneSegment,
      };
    }
    const chapter = Math.floor(i / 5) + 1;
    const beat = (i % 5) + 1;
    const seg = segmentForIndex(sceneCount, i);
    let caption: string;
    if (seg === "intro") {
      caption = `Most people get ${topic} backwards — in the next few minutes you will see the part that actually moves the needle, step by step.`;
    } else if (seg === "outro") {
      caption = `Alright, that is the line I wish someone had drawn for me on ${topic}. Go try one piece of this today — thanks for sticking around, and I will catch you in the next video.`;
    } else if (seg === "cta") {
      caption = `If this landed, subscribe or follow for more on ${topic}, tap like, share with a friend who needs this, save the video, and drop a comment with what you want next.`;
    } else if (seg === "cta-outro") {
      caption = `Subscribe or follow for more on ${topic}, hit like, share this, save it for later — thanks for watching, and I will see you in the next one.`;
    } else {
      caption = `Chapter ${chapter}, point ${beat}: a practical idea about ${topic} you can apply without overcomplicating your process.`;
    }

    const isIntro = seg === "intro";
    const isCta = seg === "cta";
    const isOutroLine = seg === "outro" || seg === "cta-outro";

    const sceneTitle = isIntro
      ? `Stop guessing — fix ${topic} in one week`
      : isOutroLine
        ? `Your move today (copy this)`
        : isCta
          ? `Stay in the loop`
          : `Beat ${beat}: a real step for ${topic}`;

    const bullets = isIntro
      ? [`Everyone starts ${topic} backwards`, `One shift = visible progress fast`, `No new tools required`]
      : isOutroLine
        ? [`Pick one action from this video`, `Ship it publicly today`, `Repeat tomorrow — that is the system`]
        : isCta
          ? [`Subscribe or follow for more`, `Like and share`, `Comment what you want next`]
          : [
              `Concrete move #${beat} for ${topic}`,
              `Copy it without extra software`,
              `Stack it with the previous beats`,
            ];

    return {
      sceneIndex: i,
      caption,
      sceneTitle,
      bullets,
      pose: poses[i % poses.length] ?? "standing",
      layout: layouts[i % layouts.length] ?? "left-presenter",
      keyObject: keyObjects[i % keyObjects.length] ?? "idea",
      camera: i % 3 === 0 ? "wide" : "medium",
      shotTemplate: shots[i % shots.length] ?? "stand-explain",
      segment: seg,
    };
  });
  return rows;
}

const VALID_POSES: StickmanPose[] = [
  "standing",
  "thinking",
  "sitting",
  "celebrating",
  "pointing",
  "defeated",
  "arms-raised",
  "walking",
];
const VALID_LAYOUTS: StickmanLayout[] = [
  "left-presenter",
  "center-presenter",
  "right-presenter",
  "desk-scene",
];
const VALID_KEY_OBJECTS: StickmanKeyObject[] = [
  "chart",
  "clock",
  "money",
  "warning",
  "audience",
  "idea",
  "brand",
];
const VALID_CAMERAS: StickmanCamera[] = ["wide", "medium"];
const VALID_SHOT_TEMPLATES: StickmanShotTemplate[] = [
  "desk-explain",
  "stand-explain",
  "point-to-board",
  "walk-and-talk",
  "result-moment",
];

const TIMELINE_SCENE_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#6366F1",
  "#EC4899",
];

function buildStickmanDraftMetadata(scenes: StickmanScene[], longMode: boolean) {
  const estimatedSceneDuration = longMode ? 28 : 12;
  let runStart = 0;
  const timelineScenes = scenes.map((scene, idx) => {
    const id = `stickman-${idx + 1}`;
    const startTime = runStart;
    runStart += estimatedSceneDuration;
    return {
      id,
      title: (scene.sceneTitle?.trim() || scene.caption).slice(0, 80),
      duration: estimatedSceneDuration,
      color: TIMELINE_SCENE_COLORS[idx % TIMELINE_SCENE_COLORS.length] ?? "#3B82F6",
      startTime,
      elements: [{ id: `${id}-bg`, type: "background", media: null }],
      pose: scene.pose,
      layout: scene.layout,
      keyObject: scene.keyObject,
      camera: scene.camera,
      shotTemplate: scene.shotTemplate,
    };
  });
  const captions = timelineScenes.map((scene, i) => ({
    id: `cap-stickman-${i + 1}`,
    text: scenes[i]?.caption ?? "",
    startTime: scene.startTime,
    endTime: scene.startTime + scene.duration,
  }));
  return {
    sourceType: "stickman-whiteboard",
    aspectRatio: "16:9",
    stickmanScenes: scenes,
    scenes: timelineScenes,
    captions,
    totalDuration: timelineScenes.reduce((sum, scene) => sum + scene.duration, 0),
    savedAt: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = (await request.json()) as {
      topic?: string;
      sceneCount?: number;
      longMode?: boolean;
      targetMinutes?: number;
      ctaGoal?: string;
      introScript?: string;
      ctaScript?: string;
      outroScript?: string;
    };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const ctaGoalRaw = typeof body.ctaGoal === "string" ? body.ctaGoal.trim() : "";
    const ctaGoalLine = `${CTA_GOAL_HINTS[ctaGoalRaw] ?? "End with a clear action (follow, save, comment, or link in bio) that fits the topic."} ${CTA_PLATFORM_ENGAGEMENT}`;
    const scriptOverrides = {
      introScript: typeof body.introScript === "string" ? body.introScript : "",
      ctaScript: typeof body.ctaScript === "string" ? body.ctaScript : "",
      outroScript: typeof body.outroScript === "string" ? body.outroScript : "",
    };
    const longMode = Boolean(body.longMode);
    const targetMinutes =
      typeof body.targetMinutes === "number"
        ? Math.min(Math.max(body.targetMinutes, 10), 35)
        : 15;
    const shortSceneCount = typeof body.sceneCount === "number" ? Math.min(Math.max(body.sceneCount, 3), 10) : 6;
    const longSceneCount = Math.min(Math.max(Math.round((targetMinutes * 60) / 38), 20), 56);
    const sceneCount = longMode ? longSceneCount : shortSceneCount;

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const runtimeLine = longMode
      ? `Target runtime: about ${targetMinutes} minutes total. Use chapter-style progression and smooth narrative continuity.`
      : "Target runtime: short explainer preview.";
    const captionGuide = longMode
      ? "caption: string (20-38 words, natural narration for long-form YouTube, include connective transitions between ideas)"
      : "caption: string (14-22 words, punchy YouTube voice — concrete, specific, zero filler)";

    // Build a required pose sequence that guarantees visual variety
    const ALL_POSES = ["pointing","standing","thinking","sitting","walking","celebrating","defeated","arms-raised"] as const;
    // For short videos, build an explicit per-scene pose assignment so no two consecutive scenes share a pose
    const poseSequence: string[] = [];
    if (!longMode) {
      const pool = [...ALL_POSES];
      for (let i = 0; i < sceneCount; i++) {
        const last = poseSequence[i - 1];
        const available = pool.filter(p => p !== last);
        // pick contextually: first scene = pointing, last = arms-raised or celebrating, middle variety
        let pick: string;
        if (i === 0) pick = "pointing";
        else if (i === sceneCount - 1) pick = "arms-raised";
        else if (i === Math.floor(sceneCount / 2)) pick = "sitting";
        else pick = available[i % available.length] ?? "standing";
        poseSequence.push(pick);
      }
    }
    const poseHint = !longMode
      ? `\nCRITICAL: Use EXACTLY this pose for each scene in order: ${poseSequence.map((p,i)=>`scene ${i}=${p}`).join(", ")}. Do NOT deviate.`
      : `\nPose variety rules: NEVER use the same pose twice in a row. Cycle through all 8 poses. Every 3rd scene must differ from the previous 2.`;

    const introOutroContrast = `
INTRO vs OUTRO (mandatory — they must feel like different beats):
- INTRO (scene 0): hook forward — curiosity, tension, or promise of what this video delivers. You may say "here is what we cover" style setup.
- OUTRO (final scene, or the outro half of a combined last scene): close backward — gratitude, quick recap energy, or "see you next time". No second hook, no "welcome", no repeating the intro's opening sentence or its promise verbatim. Use different vocabulary and sentence openings than scene 0.
`;

    const structureBlock =
      sceneCount >= 4
        ? `
STRUCTURE (mandatory — respect scene order):
- Scene 0: INTRO — hook the viewer and promise what they will learn.
- Scenes 1 through ${sceneCount - 3}: MAIN — teach "${topic}" in clear, sequential beats.
- Scene ${sceneCount - 2}: CTA — one scene dedicated to the ask. ${ctaGoalLine}
- Scene ${sceneCount - 1}: OUTRO only — brief thank-you and sign-off; do not repeat the full CTA verbatim; must read differently from scene 0 (see INTRO vs OUTRO rules).

`
        : sceneCount === 3
          ? `
STRUCTURE (mandatory):
- Scene 0: INTRO — hook and set expectations (nothing that belongs in a sign-off).
- Scene 1: MAIN — core teaching beat for "${topic}".
- Scene 2: One caption with TWO clear parts in order: (1) CTA block with the ask plus subscribe/follow, like, and share. (2) OUTRO block — 1–2 sentences, distinct sign-off that does NOT reuse intro phrasing or reopen the hook. ${ctaGoalLine}

`
          : sceneCount === 2
            ? `
STRUCTURE: Scene 0 = INTRO hook only (forward promise, no CTA). Scene 1 = MAIN value, then CTA (with engagement asks), then a short OUTRO sign-off — the sign-off must sound different from scene 0, not a second intro. ${ctaGoalLine}

`
            : `
STRUCTURE: Single scene — open with a hook, teach one core idea about "${topic}", end with CTA; a separate outro is not possible in one scene, so do not tack on wording that mimics a full intro after the CTA. ${ctaGoalLine}

`;

    const prompt = `Create a ${sceneCount}-scene whiteboard explainer video script about: "${topic}".

${runtimeLine}
${structureBlock}
${introOutroContrast}

Audience: distracted YouTube viewers — every scene must earn the next click. No corporate training tone.

Hook rules (CRITICAL):
- Scene 0 caption MUST open like a feed-stopping Short: bold claim, sharp contrast, or a direct question — NOT a soft setup.
- FORBIDDEN in scene 0 (and avoid everywhere): "welcome", "in this video", "let's dive", "today we will", "journey", "embark", "exciting adventure", "deep dive".
- Scene 0 must state ONE specific insight or mistake about "${topic}" in the first 12 words when possible.
- Last scene: clear action step + urgency (today / this week), not vague inspiration.
- Middle scenes: teach with numbers, steps, contrasts (before vs after, myth vs reality), or mini-stories — never generic platitudes.

On-screen vs voice (like viral AI stickman tutorials):
- "caption" is the FULL script the voiceover will read (can be longer, conversational).
- "sceneTitle" is the BIG handwritten headline on the whiteboard (3-10 words, no quotes) — must grab attention like a Shorts title.
- "bullets" is an array of EXACTLY 2 or 3 short lines (each max 10 words) that pop in as a list — the viewer reads these while listening; they must match the caption's meaning but stay punchy.

Return ONLY a JSON object with a "scenes" array. Each scene object must have exactly these keys:
- sceneIndex: number (0-based, 0 through ${sceneCount - 1})
- ${captionGuide}
- sceneTitle: string (3-10 words, bold claim or label for the whiteboard)
- bullets: string[] (length 2 or 3 only; each item a short on-screen line)
- pose: exactly one of: "standing" | "thinking" | "sitting" | "celebrating" | "pointing" | "defeated" | "arms-raised" | "walking"
- layout: exactly one of: "left-presenter" | "center-presenter" | "right-presenter" | "desk-scene"
- keyObject: exactly one of: "chart" | "clock" | "money" | "warning" | "audience" | "idea" | "brand"
- camera: exactly one of: "wide" | "medium"
- shotTemplate: exactly one of: "desk-explain" | "stand-explain" | "point-to-board" | "walk-and-talk" | "result-moment"
${poseHint}

Layout rules:
- Use "desk-scene" + "desk-explain" when pose is "sitting"
- Rotate through left/center/right presenter for all other layouts — never the same layout twice in a row
- Use "wide" camera for opening and closing scenes, "medium" for everything else

Object rules:
- Pick keyObject that best matches the caption meaning: growth/numbers → chart, urgency/routine → clock, money/business → money, risk/warning → warning, community/followers → audience, creativity/ideas → idea, brand/business identity → brand
- Vary the keyObject — never the same object more than twice in a row

Shot template rules:
- "point-to-board" for teaching, stats, facts
- "walk-and-talk" for step-by-step or process scenes
- "desk-explain" for calm/reflective beats
- "result-moment" for wins, revelations, summary
- "stand-explain" as fallback

CTA scenes must satisfy BOTH: (1) the user’s goal from the structure block above, and (2) subscribe or follow, like, and share — blended naturally in the caption text.

Additional long-form rules:
- Spread content across beginning, middle, and end (clear arc)
- Every 4-6 scenes introduce a mini-shift (story beat, myth-vs-fact, or practical step)
- Keep captions coherent, avoid repetitive sentence starts

Return ONLY valid JSON, no markdown, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: longMode ? 6000 : 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const fallbackScenes = assignSegments(
        applyScriptOverrides(buildFallbackScenes(topic, sceneCount), scriptOverrides)
      );
      // Save a draft to library when scene generation falls back.
      let savedDraftId: string | null = null;
      if (userId) {
        try {
          const draftTitle = `Stickman: ${(topic || "Whiteboard topic").slice(0, 72)} (Draft)`;
          const [row] = await db
            .insert(videosTable)
            .values({
              userId,
              title: draftTitle,
              thumbnailUrl: null,
              platforms: ["video-timeline"],
              status: "draft",
              productId: null,
              scriptId: null,
              metadata: buildStickmanDraftMetadata(fallbackScenes, longMode),
            })
            .returning({ id: videosTable.id });
          savedDraftId = row?.id ?? null;
        } catch (e) {
          console.error("[stickman/generate save fallback draft]", e);
        }
      }
      return NextResponse.json({ scenes: fallbackScenes, fallback: true, savedDraftId });
    }

    const scenesRaw: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { scenes?: unknown[] }).scenes)
        ? (parsed as { scenes: unknown[] }).scenes
        : [];

    function normalizeBullets(raw: unknown): string[] | undefined {
      if (!Array.isArray(raw)) return undefined;
      const out = raw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 3);
      if (out.length < 2) return undefined;
      return out;
    }

    const scenes: StickmanScene[] = scenesRaw
      .filter((s): s is { sceneIndex: number; caption: string; pose: string; layout?: string; keyObject?: string; camera?: string; shotTemplate?: string; sceneTitle?: unknown; bullets?: unknown } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { sceneIndex?: unknown }).sceneIndex === "number" &&
        typeof (s as { caption?: unknown }).caption === "string" &&
        typeof (s as { pose?: unknown }).pose === "string"
      )
      .map((s, i) => {
        const sceneTitle =
          typeof s.sceneTitle === "string" && s.sceneTitle.trim().length > 0
            ? s.sceneTitle.trim().slice(0, 120)
            : undefined;
        const bullets = normalizeBullets(s.bullets);
        return {
        sceneIndex: i,
        caption: s.caption.trim(),
        sceneTitle,
        bullets,
        pose: VALID_POSES.includes(s.pose as StickmanPose) ? (s.pose as StickmanPose) : "standing",
        layout: VALID_LAYOUTS.includes(s.layout as StickmanLayout)
          ? (s.layout as StickmanLayout)
          : ((VALID_LAYOUTS[i % VALID_LAYOUTS.length] as StickmanLayout) ?? "center-presenter"),
        keyObject: VALID_KEY_OBJECTS.includes(s.keyObject as StickmanKeyObject)
          ? (s.keyObject as StickmanKeyObject)
          : "idea",
        camera: VALID_CAMERAS.includes(s.camera as StickmanCamera)
          ? (s.camera as StickmanCamera)
          : "medium",
        shotTemplate: VALID_SHOT_TEMPLATES.includes(s.shotTemplate as StickmanShotTemplate)
          ? (s.shotTemplate as StickmanShotTemplate)
          : (i % 5 === 0
              ? "point-to-board"
              : i % 5 === 1
                ? "desk-explain"
                : i % 5 === 2
                  ? "stand-explain"
                  : i % 5 === 3
                    ? "walk-and-talk"
                    : "result-moment"),
      };
      });

    const finalScenes = assignSegments(applyScriptOverrides(scenes, scriptOverrides));

    if (finalScenes.length === 0) {
      const fallbackScenes = assignSegments(
        applyScriptOverrides(buildFallbackScenes(topic, sceneCount), scriptOverrides)
      );
      let savedDraftId: string | null = null;
      if (userId) {
        try {
          const draftTitle = `Stickman: ${(topic || "Whiteboard topic").slice(0, 72)} (Draft)`;
          const [row] = await db
            .insert(videosTable)
            .values({
              userId,
              title: draftTitle,
              thumbnailUrl: null,
              platforms: ["video-timeline"],
              status: "draft",
              productId: null,
              scriptId: null,
              metadata: buildStickmanDraftMetadata(fallbackScenes, longMode),
            })
            .returning({ id: videosTable.id });
          savedDraftId = row?.id ?? null;
        } catch (e) {
          console.error("[stickman/generate save empty draft]", e);
        }
      }
      return NextResponse.json({ scenes: fallbackScenes, fallback: true, savedDraftId });
    }
    let savedDraftId: string | null = null;
    if (userId) {
      try {
        const draftTitle = `Stickman: ${(topic || "Whiteboard topic").slice(0, 72)} (Draft)`;
        const [row] = await db
          .insert(videosTable)
          .values({
            userId,
            title: draftTitle,
            thumbnailUrl: null,
            platforms: ["video-timeline"],
            status: "draft",
            productId: null,
            scriptId: null,
            metadata: buildStickmanDraftMetadata(finalScenes, longMode),
          })
          .returning({ id: videosTable.id });
        savedDraftId = row?.id ?? null;
      } catch (e) {
        console.error("[stickman/generate save draft]", e);
      }
    }

    return NextResponse.json({ scenes: finalScenes, savedDraftId });
  } catch (err) {
    console.error("[stickman/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
