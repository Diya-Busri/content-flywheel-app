/**
 * Server-side video compilation using FFmpeg.
 * - Image scenes: Ken Burns (zoom/pan) for scene duration
 * - Video scenes: trim to scene duration
 * - Scene stitching with concat filter
 * - Voiceover as main audio; optional looped BGM mixed under voice (low volume)
 * - Burned-in captions (drawtext): dialogue per scene from script_text when provided
 * - Output: MP4 (default 1920x1080 or 1080x1920 when outputAspect is 9:16, 25fps)
 *
 * FFmpeg path: tries @ffmpeg-installer/ffmpeg, then ffmpeg-static, then system "ffmpeg".
 */

import { writeFile, rm, copyFile, access } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { spawn } from "child_process";
import { buildViralCaptionDrawtextFlatVf, VIRAL_CAPTION_FONT_SIZES } from "@/lib/video-caption-ffmpeg";
import { BGM_MIX_VOLUME } from "@/lib/bgm-tracks";

const FPS = 25;

function compileDimensions(outputAspect: "16:9" | "9:16" | undefined, resolution?: "1080p" | "720p" | "480p"): { width: number; height: number } {
  if (resolution === "480p") {
    if (outputAspect === "9:16") return { width: 480, height: 854 };
    return { width: 854, height: 480 };
  }
  const is720 = resolution === "720p";
  if (outputAspect === "9:16") return is720 ? { width: 720, height: 1280 } : { width: 1080, height: 1920 };
  return is720 ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
}

export function resolveDrawtextFontFile(): string | null {
  const env = process.env.FFMPEG_DRAWTEXT_FONTFILE?.trim();
  if (env && existsSync(env)) return env;
  const cwd = process.cwd();
  // Common paths across macOS + Linux server images + bundled node_modules fallback.
  const candidates = [
    // Committed to public/fonts/ — always present in the deployed repo
    join(cwd, "public/fonts/LiberationSans-Regular.ttf"),
    // Next.js bundled font — always present since it ships with the next package
    join(cwd, "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf"),
    // Bundled via pdfjs-dist
    join(cwd, "node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"),
    // System Linux paths (Vercel, Ubuntu)
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    // macOS paths
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttf",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export type CompileScene = {
  duration: number;
  /** Image URL (for Ken Burns) or null if video_url / localImagePath is set */
  image_url: string | null;
  /** Video URL (trimmed to duration) or null if image_url / localImagePath is set */
  video_url: string | null;
  /** Absolute local path to an already-downloaded image (skips network download) */
  localImagePath?: string | null;
  /** Full dialogue line (e.g. "Name: …") for burned-in captions; optional */
  dialogue?: string | null;
  /** When true, image scenes use a static full-frame shot (no Ken Burns zoom/pan). */
  disableKenBurns?: boolean;
  /**
   * When set (e.g. 1.05), Ken Burns uses a slow linear zoom from 1.0 to this factor over the scene.
   * When unset, uses the default stronger incremental zoom (legacy AI Story / compile look).
   * Ignored when disableKenBurns is true.
   */
  kenBurnsZoomMax?: number | null;
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

async function probeAudioDurationSeconds(filePath: string): Promise<number | null> {
  const ffmpeg = getFfmpegPath();
  return await new Promise((resolve) => {
    const proc = spawn(ffmpeg, ["-i", filePath, "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);
      if (!m) return resolve(null);
      const hh = Number(m[1] ?? 0);
      const mm = Number(m[2] ?? 0);
      const ss = Number(m[3] ?? 0);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
        return resolve(null);
      }
      const seconds = hh * 3600 + mm * 60 + ss;
      resolve(seconds > 0 ? seconds : null);
    });
    proc.on("error", () => resolve(null));
  });
}

/**
 * Download per-scene voiceover URLs and concatenate into a single MP3 in workDir.
 * Returns path + per-scene measured durations (seconds).
 */
export async function concatVoiceoverUrls(
  workDir: string,
  urls: string[]
): Promise<{ path: string; sceneDurationsSec: number[] }> {
  if (urls.length === 0) throw new Error("At least one voiceover URL required");
  const paths: string[] = [];
  const sceneDurationsSec: number[] = [];
  for (let i = 0; i < urls.length; i++) {
    const p = join(workDir, `vo_${i}.mp3`);
    await downloadToFile(urls[i], p);
    paths.push(p);
    // Probe each scene VO so callers can align scene video duration to narration length.
    const d = await probeAudioDurationSeconds(p);
    sceneDurationsSec.push(d ?? 0);
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
  return { path: outPath, sceneDurationsSec };
}

/** Ken Burns: zoompan from image for duration seconds. Output segPath, no audio. */
async function renderImageSegment(
  imagePath: string,
  duration: number,
  segPath: string,
  width: number,
  height: number,
  dialogueLine?: string | null,
  opts?: { staticShot?: boolean; kenBurnsZoomMax?: number | null }
): Promise<void> {
  const dFrames = Math.max(1, Math.round(FPS * duration));
  /** Cover WxH: scale up with aspect preserved until both dimensions meet target, then center-crop.
   * The old scale=W:-2,crop=WxH breaks for 9:16 on wide images (height after scale is below 1920). */
  const coverCrop =
    `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-${width})/2:(ih-${height})/2`;
  /**
   * Single-input chain via -vf (no stream labels). Avoids -filter_complex + -map [label] failures when
   * the graph is misparsed or pads are missing on some FFmpeg builds.
   */
  const staticToYuv = `${coverCrop},setsar=1:1,format=yuv420p`;
  const kenZoomMax = opts?.kenBurnsZoomMax;
  const useSubtleZoom =
    !opts?.staticShot &&
    typeof kenZoomMax === "number" &&
    Number.isFinite(kenZoomMax) &&
    kenZoomMax > 1 &&
    kenZoomMax <= 2;
  const delta = useSubtleZoom ? kenZoomMax! - 1 : 0;
  /** Comma inside max() must be escaped for the filtergraph. */
  const kenBurnsToYuv = useSubtleZoom
    ? `${coverCrop},setsar=1:1,` +
      `scale=8000:-1,zoompan=z='1+${delta}*on/max(1\\,${dFrames}-1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dFrames}:s=${width}x${height}:fps=${FPS},format=yuv420p`
    : `${coverCrop},setsar=1:1,` +
      `scale=8000:-1,zoompan=z='min(zoom+0.001,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${dFrames}:s=${width}x${height}:fps=${FPS},format=yuv420p`;
  let baseVf = opts?.staticShot ? staticToYuv : kenBurnsToYuv;
  let vf = baseVf;
  if (dialogueLine?.trim()) {
    const fontFile = resolveDrawtextFontFile();
    const flatCaps = buildViralCaptionDrawtextFlatVf(
      dialogueLine.trim(),
      width,
      VIRAL_CAPTION_FONT_SIZES.medium,
      fontFile ?? undefined
    );
    if (flatCaps) vf = `${baseVf},${flatCaps}`;
  }
  const args = [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-vf",
    vf,
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
  width: number,
  height: number,
  dialogueLine?: string | null
): Promise<void> {
  const scale = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  let vf = scale;
  if (dialogueLine?.trim()) {
    const fontFile = resolveDrawtextFontFile();
    const cap = buildViralCaptionDrawtextFlatVf(
      dialogueLine.trim(),
      width,
      VIRAL_CAPTION_FONT_SIZES.medium,
      fontFile ?? undefined
    );
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
  /** Landscape 1920×1080 (default) or vertical 1080×1920 for TikTok-style MP4. */
  outputAspect?: "16:9" | "9:16";
  /** Optional x264 preset override for faster exports on some flows. */
  videoPreset?: "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium";
  /**
   * Output resolution. "720p" = 1280×720 (landscape) / 720×1280 (portrait).
   * "480p" = 854×480 — use for very long videos (>60 scenes or >10 min) to compile within timeout.
   * Defaults to "1080p" (1920×1080 or 1080×1920).
   * Use "720p" for long-form videos (>20 scenes) to keep file size under Supabase limits.
   */
  resolution?: "1080p" | "720p" | "480p";
  /**
   * x264 CRF value (0–51). Lower = better quality + larger file. Default 23.
   * Use 28–30 for large documentary exports to keep file size manageable.
   */
  crf?: number;
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
  const { width, height } = compileDimensions(compileOpts?.outputAspect, compileOpts?.resolution);
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

  if (scenes.length === 1) {
    const audioDur = await probeAudioDurationSeconds(voicePath);
    if (audioDur != null && audioDur > 0.25) {
      const hold = 0.2;
      scenes[0] = {
        ...scenes[0],
        duration: Math.max(1, Number((audioDur + hold).toFixed(2))),
      };
    }
  }

  // 2a) Pre-download all remote assets in parallel (network I/O, not CPU bound)
  //     This cuts download time from O(n*latency) to O(latency) for large documentaries.
  const DOWNLOAD_CONCURRENCY = 8;
  type AssetInfo = { index: number; localPath: string; isVideo: boolean };
  const assetMap = new Map<number, AssetInfo>();

  // Build download queue for remote assets only
  const downloadQueue: Array<{ index: number; url: string; isVideo: boolean }> = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.localImagePath?.trim()) continue; // already local
    const imageUrl = s.image_url?.trim() || null;
    const videoUrl = s.video_url?.trim() || null;
    if (videoUrl && isHttpUrl(videoUrl)) {
      downloadQueue.push({ index: i, url: videoUrl, isVideo: true });
    } else if (imageUrl && isHttpUrl(imageUrl)) {
      downloadQueue.push({ index: i, url: imageUrl, isVideo: false });
    }
  }

  // Process downloads with concurrency cap
  for (let qi = 0; qi < downloadQueue.length; qi += DOWNLOAD_CONCURRENCY) {
    const batch = downloadQueue.slice(qi, qi + DOWNLOAD_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ index, url, isVideo }) => {
        const localPath = await downloadAsset(url, workDir, index, !isVideo);
        assetMap.set(index, { index, localPath, isVideo });
      })
    );
  }

  // 2b) Render each scene segment sequentially (FFmpeg is CPU-bound; parallel spawn causes thrashing)
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const dur = typeof s.duration === "number" && s.duration > 0 ? s.duration : 5;

    const localImg = s.localImagePath?.trim() || null;
    const downloaded = assetMap.get(i);
    const segPath = join(workDir, `seg_${i}.mp4`);

    if (localImg && !downloaded?.isVideo) {
      await access(localImg);
      await renderImageSegment(localImg, dur, segPath, width, height, s.dialogue, {
        staticShot: Boolean(s.disableKenBurns),
        kenBurnsZoomMax: s.kenBurnsZoomMax,
      });
    } else if (downloaded?.isVideo) {
      await renderVideoSegment(downloaded.localPath, dur, segPath, width, height, s.dialogue);
    } else if (downloaded) {
      await renderImageSegment(downloaded.localPath, dur, segPath, width, height, s.dialogue, {
        staticShot: Boolean(s.disableKenBurns),
        kenBurnsZoomMax: s.kenBurnsZoomMax,
      });
    } else {
      throw new Error(`Scene ${i + 1} must have image_url, video_url, or localImagePath`);
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

  const preset = compileOpts?.videoPreset ?? "medium";
  const crfValue = typeof compileOpts?.crf === "number" && compileOpts.crf >= 0 && compileOpts.crf <= 51
    ? compileOpts.crf
    : 23;

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
    "-preset", preset,
    "-crf", String(crfValue),
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
