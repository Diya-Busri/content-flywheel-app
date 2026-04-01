import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

type StickmanSceneInput = {
  caption?: string;
  pose?: string;
  keyObject?: string;
  layout?: string;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function drawScenePpm(width: number, height: number, scene: StickmanSceneInput): Buffer {
  const pixels = Buffer.alloc(width * height * 3, 255);
  const setPx = (x: number, y: number, rgb: [number, number, number]) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
    const o = (iy * width + ix) * 3;
    pixels[o] = rgb[0];
    pixels[o + 1] = rgb[1];
    pixels[o + 2] = rgb[2];
  };
  const fillRect = (x: number, y: number, w: number, h: number, rgb: [number, number, number]) => {
    const x0 = clamp(Math.floor(x), 0, width - 1);
    const y0 = clamp(Math.floor(y), 0, height - 1);
    const x1 = clamp(Math.floor(x + w), 0, width);
    const y1 = clamp(Math.floor(y + h), 0, height);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) setPx(xx, yy, rgb);
    }
  };
  const drawLine = (x0: number, y0: number, x1: number, y1: number, t: number, rgb: [number, number, number]) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (dx * i) / steps;
      const y = y0 + (dy * i) / steps;
      for (let oy = -t; oy <= t; oy++) {
        for (let ox = -t; ox <= t; ox++) {
          if (ox * ox + oy * oy <= t * t) setPx(x + ox, y + oy, rgb);
        }
      }
    }
  };
  const drawCircle = (cx: number, cy: number, r: number, t: number, rgb: [number, number, number]) => {
    for (let a = 0; a < 360; a += 1) {
      const rad = (a * Math.PI) / 180;
      const x = cx + Math.cos(rad) * r;
      const y = cy + Math.sin(rad) * r;
      for (let oy = -t; oy <= t; oy++) {
        for (let ox = -t; ox <= t; ox++) {
          if (ox * ox + oy * oy <= t * t) setPx(x + ox, y + oy, rgb);
        }
      }
    }
  };

  // whiteboard-like background
  fillRect(0, 0, width, height, [255, 254, 248]);
  for (let y = 20; y < height; y += 28) {
    for (let x = 20; x < width; x += 28) setPx(x, y, [220, 210, 188]);
  }
  fillRect(0, 0, width, 10, [245, 158, 11]);
  fillRect(80, 80, 760, 170, [248, 232, 216]);
  drawLine(80, 505, 1200, 505, 4, [145, 145, 145]);

  // stickman
  const layout = scene.layout ?? "left-presenter";
  const left = layout === "right-presenter" ? 900 : layout === "center-presenter" ? 640 : 460;
  const pose = scene.pose ?? "standing";
  const armY = pose === "pointing" ? 430 : pose === "celebrating" ? 380 : 445;
  drawCircle(left, 360, 26, 3, [30, 40, 55]);
  drawLine(left, 386, left, 468, 3, [30, 40, 55]);
  drawLine(left, 420, left - 58, armY, 3, [30, 40, 55]);
  drawLine(left, 420, left + 82, armY, 3, [30, 40, 55]);
  drawLine(left, 468, left - 45, 548, 3, [30, 40, 55]);
  drawLine(left, 468, left + 45, 548, 3, [30, 40, 55]);

  // board/object
  fillRect(left + 95, 322, 195, 140, [255, 255, 255]);
  drawLine(left + 95, 322, left + 290, 322, 2, [17, 24, 39]);
  drawLine(left + 95, 462, left + 290, 462, 2, [17, 24, 39]);
  drawLine(left + 95, 322, left + 95, 462, 2, [17, 24, 39]);
  drawLine(left + 290, 322, left + 290, 462, 2, [17, 24, 39]);
  const object = scene.keyObject ?? "idea";
  if (object === "chart") {
    drawLine(left + 120, 430, left + 260, 430, 2, [17, 24, 39]);
    drawLine(left + 120, 430, left + 120, 350, 2, [17, 24, 39]);
    drawLine(left + 132, 416, left + 170, 385, 2, [17, 24, 39]);
    drawLine(left + 170, 385, left + 230, 350, 2, [17, 24, 39]);
  } else if (object === "clock") {
    drawCircle(left + 192, 392, 46, 2, [110, 110, 110]);
    drawLine(left + 192, 392, left + 192, 360, 2, [110, 110, 110]);
    drawLine(left + 192, 392, left + 218, 392, 2, [110, 110, 110]);
  } else {
    drawLine(left + 125, 352, left + 255, 352, 2, [17, 24, 39]);
    drawLine(left + 125, 382, left + 255, 382, 2, [17, 24, 39]);
    drawLine(left + 125, 412, left + 210, 412, 2, [17, 24, 39]);
  }
  return Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`, "ascii"), pixels]);
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      scenes?: StickmanSceneInput[];
      topic?: string;
      longMode?: boolean;
      voiceId?: string;
    };

    const scenesRaw = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenesRaw.length === 0) return NextResponse.json({ error: "No stickman scenes to export." }, { status: 400 });
    const scenes = scenesRaw.slice(0, 60);
    const estimateDurationForCaption = (caption: string): number => {
      const words = caption.trim().split(/\s+/).filter(Boolean).length;
      const base = words > 0 ? words / 2.7 : 4;
      return Math.max(3.5, Math.min(9, Number((base + 0.8).toFixed(2))));
    };

    const scriptText = scenes
      .map((s, i) => `${i + 1}. ${typeof s.caption === "string" ? s.caption.trim() : ""}`)
      .filter(Boolean)
      .join(" ");
    if (!scriptText) return NextResponse.json({ error: "Scenes have empty captions." }, { status: 400 });

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs API key not configured." }, { status: 500 });
    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: scriptText,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
    });
    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "unknown");
      return NextResponse.json({ error: `Voiceover failed: ${errText}` }, { status: 502 });
    }
    const audioBytes = Buffer.from(await ttsRes.arrayBuffer());

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Storage not configured." }, { status: 503 });

    const workDir = join(tmpdir(), `stickman-export-${randomUUID().slice(0, 8)}-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });
    try {
      const compileScenes: CompileScene[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const ppmPath = join(workDir, `stickman_scene_${i}.ppm`);
        await writeFile(ppmPath, drawScenePpm(1280, 720, scene));
        compileScenes.push({
          duration: estimateDurationForCaption(typeof scene.caption === "string" ? scene.caption : ""),
          image_url: null,
          video_url: null,
          localImagePath: ppmPath,
          dialogue: typeof scene.caption === "string" ? scene.caption : null,
        });
      }

      const voicePath = join(workDir, "voiceover.mp3");
      await writeFile(voicePath, audioBytes);

      const finalPath = await compileVideoToFile(workDir, compileScenes, "", voicePath, "fade", {
        outputAspect: "16:9",
        videoPreset: "veryfast",
      });
      const buffer = await readFile(finalPath);
      const fileName = `stickman-${Date.now()}.mp4`;
      const storagePath = `${userId}/stickman/${randomUUID()}/${fileName}`;
      const uploaded = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (uploaded.error) return NextResponse.json({ error: uploaded.error.message }, { status: 500 });
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.data.path);
      return NextResponse.json({ url: data.publicUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Export failed" }, { status: 500 });
  }
}
