/**
 * Server-side video compilation using FFmpeg.
 * - Image scenes: Ken Burns (zoom/pan) for scene duration
 * - Video scenes: trim to scene duration
 * - Scene stitching with concat filter
 * - Voiceover as main audio; optional looped BGM mixed under voice (low volume)
 * - Burned-in captions (drawtext): dialogue per scene from script_text when provided
 * - Output: MP4 (1920x1080, 25fps)
 *
 * FFmpeg path: tries @ffmpeg-installer/ffmpeg, then ffmpeg-static, then system "ffmpeg".
 */

import { writeFile, rm, copyFile, access } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";
import {
  buildViralCaptionDrawtextChain,
  buildViralCaptionDrawtextFlatVf,
  VIRAL_CAPTION_FONT_SIZES,
} from "@/lib/video-caption-ffmpeg";
import { BGM_MIX_VOLUME } from "@/lib/bgm-tracks";

const FPS = 25;
const WIDTH = 1920;
const HEIGHT = 1080;

export type CompileScene = {
  duration: number;
  /** Image URL (for Ken Burns) or null if video_url is set */
  image_url: string | null;
  /** Video URL (trimmed to duration) or null if image_url is set */
  video_url: string | null;
  /** Full dialogue line (e.g. "Name: …") for burned-in captions; optional */
  dialogue?: string | null;
};

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

async function downloadToFile(url: string, filePath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buf);
}

/** Download URL to file and return path (use correct image extension from Content-Type). */
async function downloadAsset(url: string, workDir: string, index: number, isImage: boolean): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  let ext = "jpg";
  if (isImage && (contentType.includes("png") || url.toLowerCase().includes(".png"))) ext = "png";
  else if (!isImage) ext = "mp4";
  const base = isImage ? `input_${index}` : `input_${index}`;
  const filePath = join(workDir, `${base}.${ext}`);
  await writeFile(filePath, buf);
  return filePath;
}

/** Resolve FFmpeg binary path. Prefer project node_modules so Next.js bundling doesn't break the path. */
export function getFfmpegPath(): string {
  const platform = process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "ia32" ? "ia32" : "arm64";
  const cwd = process.cwd();
  // Prefer binary from project node_modules (avoids .next/server/vendor-chunks broken path)
  const installerDir =
    platform === "win32"
      ? join(cwd, "node_modules", "@ffmpeg-installer", "win32-" + arch)
      : platform === "darwin"
        ? join(cwd, "node_modules", "@ffmpeg-installer", "darwin-" + arch)
        : join(cwd, "node_modules", "@ffmpeg-installer", "linux-" + arch);
  const localExe = platform === "win32" ? join(installerDir, "ffmpeg.exe") : join(installerDir, "ffmpeg");
  if (existsSync(localExe)) return localExe;

  try {
    const installer = require("@ffmpeg-installer/ffmpeg");
    if (installer?.path && existsSync(installer.path)) return installer.path;
  } catch {
    // optional
  }
  try {
    const ffmpegStatic = require("ffmpeg-static");
    const path = typeof ffmpegStatic === "string" ? ffmpegStatic : ffmpegStatic?.path;
    if (path && existsSync(path)) return path;
  } catch {
    // optional
  }
  return "ffmpeg";
}

export function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });
}

/**
 * Download per-scene voiceover URLs and concatenate into a single MP3 in workDir.
 * Returns path to workDir/voiceover.mp3.
 */
export async function concatVoiceoverUrls(workDir: string, urls: string[]): Promise<string> {
  if (urls.length === 0) throw new Error("At least one voiceover URL required");
  const paths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const p = join(workDir, `vo_${i}.mp3`);
    await downloadToFile(urls[i], p);
    paths.push(p);
  }
  const listPath = join(workDir, "vo_list.txt");
  const listContent = paths.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(listPath, listContent);
  const outPath = join(workDir, "voiceover.mp3");
  /** Re-encode instead of -c copy: MP3 concat copy often drops or clips the last segment across VBR/sample-rate boundaries. */
  await runFfmpeg([
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c:a", "libmp3lame",
    "-b:a", "192k",
    outPath,
  ]);
  return outPath;
}

/** Ken Burns: zoompan from image for duration seconds. Output segPath, no audio. */
async function renderImageSegment(
  imagePath: string,
  duration: number,
  segPath: string,
  dialogueLine?: string | null
): Promise<void> {
  const dFrames = Math.max(1, Math.round(FPS * duration));
  const zoom =
    `[0:v]scale=${WIDTH}:-2,setsar=1:1,crop=${WIDTH}:${HEIGHT},` +
    `scale=8000:-1,zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dFrames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}[vz]`;
  let filterComplex = zoom;
  let mapLabel = "vz";
  if (dialogueLine?.trim()) {
    const cap = buildViralCaptionDrawtextChain("vz", "vout", {
      videoWidth: WIDTH,
      dialogueLine: dialogueLine.trim(),
      fontSize: VIRAL_CAPTION_FONT_SIZES.medium,
      midLabel: "capimg",
    });
    filterComplex += `;${cap}`;
    mapLabel = "vout";
  }
  const args = [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-filter_complex", filterComplex,
    "-map", `[${mapLabel}]`,
    "-an",
    "-t", String(duration),
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    segPath,
  ];
  await runFfmpeg(args);
}

/** Trim video to duration, strip audio. Output segPath. */
async function renderVideoSegment(
  videoPath: string,
  duration: number,
  segPath: string,
  dialogueLine?: string | null
): Promise<void> {
  const scale = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2`;
  let vf = scale;
  if (dialogueLine?.trim()) {
    const cap = buildViralCaptionDrawtextFlatVf(dialogueLine.trim(), WIDTH, VIRAL_CAPTION_FONT_SIZES.medium);
    vf = `${scale},${cap}`;
  }
  const args = [
    "-y",
    "-i", videoPath,
    "-t", String(duration),
    "-an",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-vf", vf,
    segPath,
  ];
  await runFfmpeg(args);
}

export type CompileVideoOptions = {
  /** Absolute path to MP3 on disk (server). Looped under voice if set. */
  bgmPath?: string | null;
  /** BGM linear volume 0–1; default BGM_MIX_VOLUME */
  bgmVolume?: number;
};

/**
 * Compile scenes + voiceover into a single MP4 in workDir.
 * workDir must exist. Creates workDir/final.mp4.
 * Returns path to final.mp4.
 * If existingVoicePath is provided and the file exists, use it; otherwise download from voiceoverUrl.
 * transition: optional UI value from caller (currently unused in concat mode).
 */
export async function compileVideoToFile(
  workDir: string,
  scenes: CompileScene[],
  voiceoverUrl: string,
  existingVoicePath?: string,
  transition?: string,
  compileOpts?: CompileVideoOptions
): Promise<string> {
  void transition;
  const voicePath = join(workDir, "voiceover.mp3");
  if (existingVoicePath) {
    try {
      await access(existingVoicePath);
      await copyFile(existingVoicePath, voicePath);
    } catch {
      if (!isHttpUrl(voiceoverUrl)) throw new Error("voiceover_url must be http(s) when existing voice path is missing");
      await downloadToFile(voiceoverUrl, voicePath);
    }
  } else {
    if (!isHttpUrl(voiceoverUrl)) throw new Error("voiceover_url must be http(s)");
    await downloadToFile(voiceoverUrl, voicePath);
  }
  if (scenes.length === 0) throw new Error("At least one scene required");

  // 2) Download each scene asset and render segment (video-only, no audio)
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dur = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;

    const imageUrl = s.image_url?.trim() || null;
    const videoUrl = s.video_url?.trim() || null;
    if (imageUrl && !videoUrl) {
      if (!isHttpUrl(imageUrl)) throw new Error(`Scene ${i + 1} image_url must be http(s)`);
      const inputPath = await downloadAsset(imageUrl, workDir, i, true);
      const segPath = join(workDir, `seg_${i}.mp4`);
      await renderImageSegment(inputPath, dur, segPath, s.dialogue);
    } else if (videoUrl) {
      if (!isHttpUrl(videoUrl)) throw new Error(`Scene ${i + 1} video_url must be http(s)`);
      const inputPath = await downloadAsset(videoUrl, workDir, i, false);
      const segPath = join(workDir, `seg_${i}.mp4`);
      await renderVideoSegment(inputPath, dur, segPath, s.dialogue);
    } else {
      throw new Error(`Scene ${i + 1} must have image_url or video_url`);
    }
  }

  // 3) Concatenate all rendered scene segments and mux voiceover (+ optional BGM).

  const segInputs = scenes.map((_, i) => ["-i", join(workDir, `seg_${i}.mp4`)]).flat();
  const concatInputs = scenes.map((_, i) => `[${i}:v]`).join("");
  const videoGraph = `${concatInputs}concat=n=${scenes.length}:v=1:a=0,format=yuv420p[vout]`;

  const finalPath = join(workDir, "final.mp4");
  const inputCount = scenes.length;
  const bgmAbs = compileOpts?.bgmPath?.trim() || null;
  const bgmVol =
    typeof compileOpts?.bgmVolume === "number" && compileOpts.bgmVolume > 0 && compileOpts.bgmVolume <= 1
      ? compileOpts.bgmVolume
      : BGM_MIX_VOLUME;

  let filterComplex = videoGraph;
  let extraInputs: string[] = [];
  let mapAudioStream: string;

  if (bgmAbs) {
    const voiceIdx = inputCount;
    const bgmIdx = inputCount + 1;
    filterComplex += `;[${bgmIdx}:a]volume=${bgmVol}[bgm];[${voiceIdx}:a][bgm]amix=inputs=2:duration=first[aout]`;
    extraInputs = ["-stream_loop", "-1", "-i", bgmAbs];
    mapAudioStream = "[aout]";
  } else {
    mapAudioStream = `${inputCount}:a`;
  }

  const args = [
    "-y",
    ...segInputs,
    "-i", voicePath,
    ...extraInputs,
    "-filter_complex", filterComplex,
    "-map", "[vout]",
    "-map", mapAudioStream,
    // Do not use -shortest: if total VO duration > sum(scene video durations), -shortest trims the audio tail (often the last scene).
    "-c:v", "libx264",
    "-preset", "medium",
    "-c:a", "aac",
    "-movflags", "+faststart",
    finalPath,
  ];
  await runFfmpeg(args);

  return finalPath;
}

/**
 * Clean up work directory (temp files). Call after upload.
 */
export async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
