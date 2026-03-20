/**
 * If an MP3 is longer than maxSeconds, speed it up with FFmpeg atempo (chained 0.5–2.0 per stage)
 * so duration fits within maxSeconds. Shorter audio is returned unchanged.
 */

import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { getFfmpegPath, runFfmpeg } from "@/lib/videos/compile";

const EPS = 0.02;

function parseDurationFromFfmpegStderr(stderr: string): number | null {
  const m = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = parseFloat(m[3]);
  return h * 3600 + min * 60 + sec;
}

async function probeMp3DurationSeconds(filePath: string): Promise<number> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, ["-nostats", "-i", filePath], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    proc.stderr?.on("data", (c: Buffer) => {
      err += c.toString();
    });
    proc.on("close", () => {
      const d = parseDurationFromFfmpegStderr(err);
      if (d == null || !Number.isFinite(d)) {
        reject(new Error("Could not read audio duration from FFmpeg"));
        return;
      }
      resolve(d);
    });
    proc.on("error", reject);
  });
}

/** Build -af chain: product of atempo factors = ratio (speed-up so duration / ratio <= max). */
function buildAtempoFilterArg(ratio: number): string {
  if (ratio <= 1 + 1e-6) return "";
  const factors: number[] = [];
  let r = ratio;
  while (r > 2 + 1e-6) {
    factors.push(2);
    r /= 2;
  }
  if (r > 1 + 1e-6) factors.push(Number(r.toFixed(5)));
  return factors.map((f) => `atempo=${f}`).join(",");
}

/**
 * Returns a new buffer (or the same logical content) with duration <= maxSeconds when possible.
 */
export async function fitMp3BufferToMaxDuration(
  input: Buffer,
  maxSeconds: number
): Promise<{ buffer: Buffer; adjusted: boolean; durationBefore: number; durationAfter: number }> {
  if (maxSeconds <= 0 || !Number.isFinite(maxSeconds)) {
    throw new Error("maxSeconds must be a positive finite number");
  }

  const dir = await mkdtemp(join(tmpdir(), "vo-fit-"));
  const inPath = join(dir, "in.mp3");
  const outPath = join(dir, "out.mp3");
  try {
    await writeFile(inPath, input);
    const durationBefore = await probeMp3DurationSeconds(inPath);
    if (durationBefore <= maxSeconds + EPS) {
      return { buffer: input, adjusted: false, durationBefore, durationAfter: durationBefore };
    }

    const ratio = durationBefore / maxSeconds;
    const af = buildAtempoFilterArg(ratio);
    if (!af) {
      return { buffer: input, adjusted: false, durationBefore, durationAfter: durationBefore };
    }

    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-af",
      af,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outPath,
    ]);

    const outBuf = await readFile(outPath);
    const durationAfter = await probeMp3DurationSeconds(outPath);
    return { buffer: outBuf, adjusted: true, durationBefore, durationAfter };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
