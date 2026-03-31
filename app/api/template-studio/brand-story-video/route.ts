/**
 * POST /api/template-studio/brand-story-video
 * Orchestrates: GPT-4o 5-scene script → DALL-E 3 (fixed streetwear backdrop per scene) → ElevenLabs per scene → FFmpeg 9:16 compile (same lib as /api/videos/compile).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { checkAiRateLimit } from "@/lib/rate-limit-ai";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { db } from "@/db/db";
import { savedScriptsTable } from "@/db/schema/library-schema";
import type { SavedScriptScene } from "@/db/schema/library-schema";
import {
  compileVideoToFile,
  concatVoiceoverUrls,
  cleanupWorkDir,
  type CompileScene,
} from "@/lib/videos/compile";
import { BGM_MIX_VOLUME } from "@/lib/bgm-tracks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIMELINE_BUCKET = "timeline-media";
const VOICE_BUCKET = "voiceovers";
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

type ScriptScene = { scene_number: number; narration: string };

/** Same DALL·E prompt for every Brand Story scene (urban streetwear backdrop). */
const BRAND_STORY_DALLE_PROMPT =
  "Dark cinematic urban streetwear aesthetic, black and dark grey tones, minimalist clothing flat lay, concrete textures, moody city night lighting, no text, no people, photorealistic";

async function generateBrandStorySceneImage(
  openai: OpenAI,
  userId: string,
  sceneIndex: number
): Promise<string> {
  const imgRes = await openai.images.generate({
    model: "dall-e-3",
    prompt: BRAND_STORY_DALLE_PROMPT,
    n: 1,
    size: "1024x1024",
    quality: "hd",
    style: "natural",
    response_format: "b64_json",
  });
  const b64 = (imgRes.data[0] as { b64_json?: string })?.b64_json;
  if (!b64) throw new Error(`DALL-E returned no image for scene ${sceneIndex + 1}.`);
  const buffer = Buffer.from(b64, "base64");
  return uploadPngToTimeline(userId, buffer);
}

function isBucketMissingError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return /bucket|not found|no such|404|does not exist/.test(msg);
}

async function uploadPngToTimeline(userId: string, buffer: Buffer): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Storage not configured.");
  const path = `${userId}/brand-story/${Date.now()}-${randomUUID().slice(0, 8)}.png`;
  let result = await supabase.storage.from(TIMELINE_BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (result.error && isBucketMissingError(result.error)) {
    await supabase.storage.createBucket(TIMELINE_BUCKET, { public: true });
    result = await supabase.storage.from(TIMELINE_BUCKET).upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
  }
  if (result.error) throw new Error(result.error.message ?? "Image upload failed");
  const { data: urlData } = supabase.storage.from(TIMELINE_BUCKET).getPublicUrl(result.data.path);
  return urlData.publicUrl;
}

async function ttsUploadMp3(userId: string, text: string, voiceId: string, apiKey: string): Promise<string> {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) throw new Error("Empty narration for TTS");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed.slice(0, 2500),
      model_id: "eleven_monolingual_v1",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      output_format: "mp3_44100_128",
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    let detail = errText.slice(0, 400);
    try {
      const j = JSON.parse(errText) as { detail?: { message?: string } | string; message?: string };
      if (typeof j.detail === "string") detail = j.detail;
      else if (j.detail && typeof j.detail === "object" && j.detail.message) detail = j.detail.message;
      else if (j.message) detail = j.message;
    } catch {
      /* keep raw */
    }
    if (/content filter/i.test(detail)) {
      throw new Error(
        "ElevenLabs blocked a narration line (content filters). Try a different theme or voice, or shorten the script."
      );
    }
    throw new Error(detail || `ElevenLabs ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Storage not configured for voice.");
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const path = `voice-overs/${safeUserId}/brand-story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const { data, error } = await supabase.storage.from(VOICE_BUCKET).upload(path, buffer, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message ?? "Voice upload failed");
  const { data: urlData } = supabase.storage.from(VOICE_BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

function parseScriptScenes(content: string): ScriptScene[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Script model returned invalid JSON.");
  }
  const root = parsed as { scenes?: unknown };
  if (!Array.isArray(root.scenes)) throw new Error('Script JSON must include a "scenes" array.');
  const out: ScriptScene[] = [];
  for (const row of root.scenes) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const sn = typeof o.scene_number === "number" ? o.scene_number : Number(o.scene_number);
    const narration = typeof o.narration === "string" ? o.narration.trim() : "";
    if (!Number.isFinite(sn) || sn < 1 || !narration) continue;
    out.push({ scene_number: sn, narration });
  }
  out.sort((a, b) => a.scene_number - b.scene_number);
  if (out.length !== 5) throw new Error(`Expected exactly 5 scenes, got ${out.length}.`);
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const rl = checkAiRateLimit(userId);
    if (rl) return rl;

    const body = await request.json().catch(() => ({}));
    const dayLabel = typeof body.dayLabel === "string" ? body.dayLabel.trim() : "";
    const brandName = typeof body.brandName === "string" ? body.brandName.trim() : "";
    const themeLine = typeof body.themeLine === "string" ? body.themeLine.trim() : "";
    const voiceId =
      typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    if (!dayLabel || !brandName || !themeLine) {
      return NextResponse.json(
        { error: "dayLabel, brandName, and themeLine are required." },
        { status: 400 }
      );
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openaiKey) {
      return NextResponse.json({ error: "OpenAI API key is not configured." }, { status: 503 });
    }

    const elevenKey = getElevenLabsApiKey();
    if (!elevenKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const scriptCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write short vertical-video scripts in the "building in public" motivational style: honest, disciplined, founder energy—no cringe, no fake hustle clichés. Each scene is ONE spoken line for voiceover (max ~22 words). The brand name and day label should feel natural when spoken. Return ONLY valid JSON with shape:
{"scenes":[{"scene_number":1,"narration":"..."},...]}
Exactly 5 scenes, scene_number 1 through 5. Do not include image fields; backgrounds are fixed server-side.`,
        },
        {
          role: "user",
          content: `Day label: "${dayLabel}"
Brand name: "${brandName}"
One-line theme: "${themeLine}"

Generate the 5-scene JSON.`,
        },
      ],
      temperature: 0.85,
    });

    const rawContent = scriptCompletion.choices[0]?.message?.content;
    if (!rawContent) throw new Error("No script content from model.");
    const scriptScenes = parseScriptScenes(rawContent);

    const imageUrls: string[] = [];
    for (let i = 0; i < scriptScenes.length; i++) {
      const url = await generateBrandStorySceneImage(openai, userId, i);
      imageUrls.push(url);
    }

    const voiceUrls: string[] = [];
    for (const sc of scriptScenes) {
      const u = await ttsUploadMp3(userId, sc.narration, voiceId, elevenKey);
      voiceUrls.push(u);
    }

    const scenesJson: SavedScriptScene[] = scriptScenes.map((sc, i) => ({
      scene_number: sc.scene_number,
      duration: 5,
      script_text: sc.narration,
      caption: sc.narration,
      image_url: imageUrls[i] ?? null,
      video_url: null,
      voiceover_url: voiceUrls[i] ?? null,
      animation_type: "image",
      section_label: `Scene ${sc.scene_number}`,
    }));

    const [saved] = await db
      .insert(savedScriptsTable)
      .values({
        userId,
        title: `Brand Story — ${brandName.slice(0, 60)} — ${dayLabel}`.slice(0, 200),
        scenesJson,
        voiceoverUrl: null,
      })
      .returning({ id: savedScriptsTable.id });

    const workDir = join(tmpdir(), `brand-story-${randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const compileScenes: CompileScene[] = scenesJson.map((s) => ({
        duration: typeof s.duration === "number" && s.duration > 0 ? s.duration : 5,
        image_url: s.image_url ?? null,
        video_url: s.video_url ?? null,
        dialogue: (s.script_text || s.caption || "").replace(/\r?\n/g, " ").trim() || null,
      }));

      const concatenated = await concatVoiceoverUrls(workDir, voiceUrls);
      const HOLD_SEC = 0.15;
      for (let i = 0; i < compileScenes.length; i++) {
        const measured = concatenated.sceneDurationsSec[i] ?? 0;
        if (measured > 0.2) {
          compileScenes[i] = {
            ...compileScenes[i],
            duration: Math.max(1, Number((measured + HOLD_SEC).toFixed(2))),
          };
        }
      }

      const finalPath = await compileVideoToFile(
        workDir,
        compileScenes,
        "",
        concatenated.path,
        undefined,
        {
          bgmPath: null,
          bgmVolume: BGM_MIX_VOLUME,
          outputAspect: "9:16",
        }
      );

      const buffer = await readFile(finalPath);
      const fileName = `brand-story-${Date.now()}.mp4`;
      const storagePath = `${userId}/brand-story/${saved?.id ?? randomUUID()}/${fileName}`;

      const { data, error } = await supabase.storage.from(TIMELINE_BUCKET).upload(storagePath, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });

      if (error) {
        console.error("[brand-story-video] upload:", error);
        return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
      }

      const { data: urlData } = supabase.storage.from(TIMELINE_BUCKET).getPublicUrl(data.path);

      return NextResponse.json({
        url: urlData.publicUrl,
        scriptId: saved?.id ?? null,
        scenes: scriptScenes.map((s, i) => ({
          scene_number: s.scene_number,
          narration: s.narration,
          image_url: imageUrls[i],
        })),
      });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[template-studio/brand-story-video]", err);
    const message = err instanceof Error ? err.message : "Brand story video failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
