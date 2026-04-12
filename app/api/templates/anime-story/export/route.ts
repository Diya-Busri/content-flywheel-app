import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { getElevenLabsApiKey } from "@/lib/elevenlabs-api-key";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, cleanupWorkDir, runFfmpeg, resolveDrawtextFontFile, type CompileScene } from "@/lib/videos/compile";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { getFfmpegPath } from "@/lib/videos/compile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BUCKET = "timeline-media";
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

function escapeFfmpegText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

async function probeAudioDurationSeconds(filePath: string): Promise<number> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ["-i", filePath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (!m) return resolve(4);
      const hh = Number(m[1] ?? 0);
      const mm = Number(m[2] ?? 0);
      const ss = Number(m[3] ?? 0);
      const seconds = hh * 3600 + mm * 60 + ss;
      resolve(seconds > 0 ? seconds : 4);
    });
    proc.on("error", () => resolve(4));
  });
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkApiRateLimit(userId);
    if (rl) return rl;

    const body = (await request.json().catch(() => ({}))) as {
      scenes?: Array<{ subtitleText?: string; voiceoverLine?: string }>;
      imageUrls?: string[];
      voiceId?: string;
      format?: "short" | "long" | "epic";
      channelName?: string;
      videoTitle?: string;
    };

    const scenes = Array.isArray(body.scenes) ? body.scenes : [];
    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
    const isLong = body.format === "long" || body.format === "epic";
    const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";
    const videoTitle = typeof body.videoTitle === "string" ? body.videoTitle.trim().slice(0, 55) : "Story";

    if (scenes.length === 0) return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    if (imageUrls.length === 0) return NextResponse.json({ error: "No image URLs provided" }, { status: 400 });
    if (scenes.length !== imageUrls.length) {
      return NextResponse.json({ error: "scenes and imageUrls must have the same length" }, { status: 400 });
    }

    const apiKey = getElevenLabsApiKey();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs API key not configured" }, { status: 500 });

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

    const voiceId =
      typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;

    const workDir = join(tmpdir(), `anime-story-export-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      // Step 1: Generate TTS for each scene and probe duration
      const audioTempPaths: string[] = [];
      const sceneDurations: number[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const voiceoverLine = scenes[i]?.voiceoverLine ?? "";
        const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: voiceoverLine || "...",
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.4, similarity_boost: 0.8 },
          }),
        });

        if (!ttsRes.ok) {
          const errText = await ttsRes.text().catch(() => "unknown");
          throw new Error(`TTS failed for scene ${i + 1}: ${errText}`);
        }

        const buffer = Buffer.from(await ttsRes.arrayBuffer());
        const audioPath = join(workDir, `tts_${i}.mp3`);
        await writeFile(audioPath, buffer);
        audioTempPaths.push(audioPath);

        const duration = await probeAudioDurationSeconds(audioPath);
        // Add a small buffer so the image holds slightly longer than the audio
        sceneDurations.push(Math.max(2, duration + 0.3));
      }

      // Step 1.5: If long/epic, prepend intro silence and append outro silence
      const INTRO_DURATION = 5;
      const OUTRO_DURATION = 8;
      if (isLong) {
        const introSilencePath = join(workDir, "intro_silence.mp3");
        await runFfmpeg(["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(INTRO_DURATION), "-c:a", "libmp3lame", "-b:a", "192k", introSilencePath]);
        const outroSilencePath = join(workDir, "outro_silence.mp3");
        await runFfmpeg(["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(OUTRO_DURATION), "-c:a", "libmp3lame", "-b:a", "192k", outroSilencePath]);
        audioTempPaths.unshift(introSilencePath);
        audioTempPaths.push(outroSilencePath);
      }

      // Step 2: Concatenate all scene audio into a single voiceover
      const voiceListPath = join(workDir, "voice_list.txt");
      const voiceListContent = audioTempPaths
        .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
        .join("\n");
      await writeFile(voiceListPath, voiceListContent);
      const concatAudioPath = join(workDir, "voiceover.mp3");
      await runFfmpeg([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", voiceListPath,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        concatAudioPath,
      ]);

      // Step 3: Download images and burn subtitle text onto each one
      const compileScenes: CompileScene[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const imageUrl = imageUrls[i] ?? "";
        const subtitleText = scenes[i]?.subtitleText ?? "";

        // Download image
        const rawImagePath = join(workDir, `raw_image_${i}.jpg`);
        if (imageUrl) {
          const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
          if (!imgRes.ok) throw new Error(`Failed to download image ${i + 1}: ${imgRes.status}`);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          await writeFile(rawImagePath, imgBuf);
        } else {
          // Generate a dark placeholder image using ffmpeg
          await runFfmpeg([
            "-y",
            "-f", "lavfi",
            "-i", "color=c=black:s=1080x1920:d=1",
            "-frames:v", "1",
            rawImagePath,
          ]);
        }

        const processedImagePath = join(workDir, `processed_image_${i}.jpg`);

        if (subtitleText.trim()) {
          const escapedText = escapeFfmpegText(subtitleText.trim());
          const fontFile = resolveDrawtextFontFile();
          const fontFileArg = fontFile ? `fontfile='${fontFile}':` : "";
          await runFfmpeg([
            "-y",
            "-i", rawImagePath,
            "-vf",
            `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2,drawtext=${fontFileArg}text='${escapedText}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h*0.82:box=1:boxcolor=black@0.55:boxborderw=16`,
            "-frames:v", "1",
            processedImagePath,
          ]);
        } else {
          // No subtitle — just resize/crop
          await runFfmpeg([
            "-y",
            "-i", rawImagePath,
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(iw-1080)/2:(ih-1920)/2",
            "-frames:v", "1",
            processedImagePath,
          ]);
        }

        compileScenes.push({
          duration: sceneDurations[i] ?? 4,
          image_url: null,
          video_url: null,
          localImagePath: processedImagePath,
          disableKenBurns: false,
          kenBurnsZoomMax: 1.04,
        });
      }

      // Step 3.5: If long/epic, prepend intro card and append outro card
      if (isLong) {
        const fontFile = resolveDrawtextFontFile();
        const fa = fontFile ? `fontfile='${fontFile}':` : "";
        const dims = "1920x1080";
        const escapedTitle = escapeFfmpegText(videoTitle);
        const escapedChannel = channelName ? escapeFfmpegText(channelName) : "";

        // Intro card — title + channel name on dark background
        const introCardPath = join(workDir, "intro_card.jpg");
        let introVf = `scale=1920:1080,drawtext=${fa}text='${escapedTitle}':fontsize=80:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2${channelName ? `-80` : ""}`;
        if (escapedChannel) {
          introVf += `,drawtext=${fa}text='${escapedChannel}':fontsize=44:fontcolor=#aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+80`;
        }
        await runFfmpeg(["-y", "-f", "lavfi", "-i", `color=c=0x111111:s=${dims}:d=1`, "-vf", introVf, "-frames:v", "1", introCardPath]);

        // Outro card — thanks + subscribe + channel
        const outroCardPath = join(workDir, "outro_card.jpg");
        let outroVf = `scale=1920:1080,drawtext=${fa}text='Thanks for watching':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80,drawtext=${fa}text='Like & Subscribe for more':fontsize=48:fontcolor=#f97316:x=(w-text_w)/2:y=(h-text_h)/2+20`;
        if (escapedChannel) {
          outroVf += `,drawtext=${fa}text='${escapedChannel}':fontsize=36:fontcolor=#aaaaaa:x=(w-text_w)/2:y=(h-text_h)/2+100`;
        }
        await runFfmpeg(["-y", "-f", "lavfi", "-i", `color=c=0x111111:s=${dims}:d=1`, "-vf", outroVf, "-frames:v", "1", outroCardPath]);

        compileScenes.unshift({ duration: INTRO_DURATION, image_url: null, video_url: null, localImagePath: introCardPath, disableKenBurns: true });
        compileScenes.push({ duration: OUTRO_DURATION, image_url: null, video_url: null, localImagePath: outroCardPath, disableKenBurns: true });
      }

      // Step 4: Compile to final video
      const finalPath = await compileVideoToFile(workDir, compileScenes, "", concatAudioPath, undefined, {
        outputAspect: isLong ? "16:9" : "9:16",
        videoPreset: "veryfast",
      });

      // Step 5: Upload to Supabase storage
      const videoBuffer = await readFile(finalPath);
      const storagePath = `${userId}/anime-story/${randomUUID()}/video.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });

      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

      return NextResponse.json({ url: urlData.publicUrl });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    console.error("[templates/anime-story/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
