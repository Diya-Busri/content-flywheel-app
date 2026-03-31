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

export interface StickmanScene {
  sceneIndex: number;
  caption: string;
  pose: StickmanPose;
  layout: StickmanLayout;
  keyObject: StickmanKeyObject;
  camera: StickmanCamera;
  shotTemplate: StickmanShotTemplate;
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

  return Array.from({ length: sceneCount }, (_, i) => {
    const chapter = Math.floor(i / 5) + 1;
    const beat = (i % 5) + 1;
    const isIntro = i === 0;
    const isOutro = i === sceneCount - 1;
    const caption = isIntro
      ? `Welcome to this deep dive on ${topic}. In this video we will break it down step by step so you can apply it confidently.`
      : isOutro
        ? `Now you have a complete framework for ${topic}. Review these steps, apply one action today, and keep iterating until results compound.`
        : `Chapter ${chapter}, point ${beat}: here is a practical idea about ${topic} and how to use it in real situations without overcomplicating your process.`;

    return {
      sceneIndex: i,
      caption,
      pose: poses[i % poses.length] ?? "standing",
      layout: layouts[i % layouts.length] ?? "left-presenter",
      keyObject: keyObjects[i % keyObjects.length] ?? "idea",
      camera: i % 3 === 0 ? "wide" : "medium",
      shotTemplate: shots[i % shots.length] ?? "stand-explain",
    };
  });
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
      title: scene.caption.slice(0, 80),
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
    };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
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
      : "caption: string (15-25 words, clear and conversational, directly explaining the topic)";

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

    const prompt = `Create a ${sceneCount}-scene whiteboard explainer video script about: "${topic}".

${runtimeLine}

Return ONLY a JSON object with a "scenes" array. Each scene object must have exactly these keys:
- sceneIndex: number (0-based, 0 through ${sceneCount - 1})
- ${captionGuide}
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
      const fallbackScenes = buildFallbackScenes(topic, sceneCount);
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

    const scenes: StickmanScene[] = scenesRaw
      .filter((s): s is { sceneIndex: number; caption: string; pose: string; layout?: string; keyObject?: string; camera?: string; shotTemplate?: string } =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as { sceneIndex?: unknown }).sceneIndex === "number" &&
        typeof (s as { caption?: unknown }).caption === "string" &&
        typeof (s as { pose?: unknown }).pose === "string"
      )
      .map((s, i) => ({
        sceneIndex: i,
        caption: s.caption.trim(),
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
      }));

    if (scenes.length === 0) {
      const fallbackScenes = buildFallbackScenes(topic, sceneCount);
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
            metadata: buildStickmanDraftMetadata(scenes, longMode),
          })
          .returning({ id: videosTable.id });
        savedDraftId = row?.id ?? null;
      } catch (e) {
        console.error("[stickman/generate save draft]", e);
      }
    }

    return NextResponse.json({ scenes, savedDraftId });
  } catch (err) {
    console.error("[stickman/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
