import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (typeof globalThis.__dirname === "undefined") globalThis.__dirname = __dirname;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT ?? 3001;
const W = 1080;
const H = 1920;

const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.SUPABASE_VIDEO_RENDERS_BUCKET ?? "video-renders";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

function escapeDrawText(str) {
  if (typeof str !== "string") return "";
  return str.replace(/\\/g, "\\\\").replace(/'/g, "'\\\\\\''").replace(/\n/g, " ");
}

async function downloadToFile(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = path.extname(new URL(url).pathname) || ".bin";
  const tmp = path.join(os.tmpdir(), `render-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  await fs.writeFile(tmp, buf);
  return tmp;
}

function getExtension(url) {
  const p = new URL(url).pathname.toLowerCase();
  if (p.endsWith(".mp4") || p.endsWith(".mov")) return "video";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg") || p.endsWith(".png") || p.endsWith(".webp")) return "image";
  return "video";
}

function buildSegment(workDir, scene, index, clipPath, audioPath) {
  const outPath = path.join(workDir, `segment_${index}.mp4`);
  const duration = Number(scene.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return Promise.reject(new Error(`Scene ${index}: invalid duration ${scene.duration}`));
  }
  const caption = escapeDrawText(scene.captionText ?? "");
  const isImage = getExtension(scene.clipUrl) === "image";

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg();
    if (isImage) {
      cmd = cmd.input(clipPath).inputOptions(["-loop", "1"]).duration(duration);
    } else {
      cmd = cmd.input(clipPath).duration(duration);
    }
    cmd.input(audioPath);

    const scale = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
    const drawtext =
      caption !== ""
        ? `,drawtext=text='${caption}':fontsize=52:x=(w-text_w)/2:y=h-180:fontcolor=white:borderw=3:bordercolor=black`
        : "";
    const vf = scale + drawtext;

    cmd
      .output(outPath)
      .outputOptions([
        "-filter_complex",
        `[0:v]${vf}[v];[1:a]atrim=0:${duration},asetpts=PTS-RESTART[a]`,
        "-map",
        "[v]",
        "-map",
        "[a]",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-shortest",
      ])
      .on("end", () => resolve(outPath))
      .on("error", (err) => reject(err))
      .run();
  });
}

function concatSegments(workDir, segmentPaths, outputPath) {
  const listPath = path.join(workDir, "concat.txt");
  const listContent = segmentPaths.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n");

  return fs.writeFile(listPath, listContent).then(() => {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy"])
        .output(outputPath)
        .on("end", () => resolve(outputPath))
        .on("error", reject)
        .run();
    });
  });
}

app.post("/render", async (req, res) => {
  const scenes = req.body?.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return res.status(400).json({ error: "Missing or empty body.scenes array" });
  }

  const workDir = path.join(os.tmpdir(), `render-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const cleanup = async () => {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (_) {}
  };

  try {
    await fs.mkdir(workDir, { recursive: true });
  } catch (e) {
    return res.status(500).json({ error: "Failed to create work directory" });
  }

    const scenePaths = [];
    try {
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (!s?.clipUrl || !s?.audioUrl) {
          await cleanup();
          return res.status(400).json({ error: `Scene ${i} must have clipUrl and audioUrl` });
        }
        const clipPath = await downloadToFile(s.clipUrl);
        const audioPath = await downloadToFile(s.audioUrl);
        const ext = path.extname(clipPath) || ".mp4";
        const audioExt = path.extname(audioPath) || ".mp3";
        const clipDest = path.join(workDir, `scene_${i}_clip${ext}`);
        const audioDest = path.join(workDir, `scene_${i}_audio${audioExt}`);
        await fs.rename(clipPath, clipDest);
        await fs.rename(audioPath, audioDest);
        scenePaths.push({ clipDest, audioDest });
      }

      const segmentPaths = [];
      for (let i = 0; i < scenes.length; i++) {
        const { clipDest, audioDest } = scenePaths[i];
        const outPath = await buildSegment(workDir, scenes[i], i, clipDest, audioDest);
        segmentPaths.push(outPath);
      }

    const outputPath = path.join(workDir, "output.mp4");
    await concatSegments(workDir, segmentPaths, outputPath);

    const supabase = getSupabase();
    if (!supabase) {
      await cleanup();
      return res.status(503).json({
        error: "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    const buffer = await fs.readFile(outputPath);
    const fileName = `renders/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

    const { data: bucketList } = await supabase.storage.listBuckets();
    const bucketExists = bucketList?.some((b) => b.name === bucket);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucket, { public: true });
    }

    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, buffer, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (uploadError) {
      await cleanup();
      return res.status(500).json({ error: `Upload failed: ${uploadError.message}` });
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    await cleanup();
    return res.json({ url: urlData.publicUrl });
  } catch (e) {
    await cleanup();
    console.error("[render]", e);
    return res.status(500).json({ error: e?.message ?? "Render failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, ffmpeg: !!ffmpeg });
});

app.listen(PORT, () => {
  console.log(`Video render server listening on port ${PORT}`);
});
