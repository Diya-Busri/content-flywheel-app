/**
 * Motion Graphics Studio — Render Pipeline
 *
 * 1. Bundle the Remotion project (cached in-process after first run).
 * 2. Select the "MotionGraphicsStudio" composition with the template's
 *    scenes as input props.
 * 3. Render via @remotion/renderer, codec chosen from the requested
 *    ExportFormat (mp4 → h264, webm → vp8, gif → gif).
 * 4. Upload the rendered file to Cloudflare R2 (lib/storage.ts) and store
 *    the public URL on the job — unlike the CF Video Engine's render
 *    pipeline (lib/video-engine/render-pipeline.ts), which writes to
 *    /public/engine-renders and only works on a single, long-lived dev
 *    server. Uploading to R2 means renders work the same way on Vercel's
 *    ephemeral/multi-instance serverless environment.
 *
 * Scene/element asset URLs are expected to already be public HTTPS URLs
 * (uploaded via the Asset Library → lib/storage.ts), so — unlike the video
 * engine — no local-disk-to-data-URI workaround is needed here.
 */

import os from "os";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { upload } from "@/lib/storage";
import { updateRenderJob } from "@/lib/motion-graphics/job-store";
import { EXPORT_FORMAT_CODEC } from "@/lib/motion-graphics/types";
import type { Template } from "@/lib/motion-graphics/types";
import type { MotionGraphicsCompositionProps } from "@/src/remotion/motion-graphics/MotionGraphicsComposition";

const TAG = "[motion-graphics/render-pipeline]";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s during: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// Cached independently from the CF Video Engine's bundle cache — both target
// the same entry point (./src/remotion/index.tsx, which registers every
// composition in the app including this one) but the two features own their
// pipelines separately so neither can break the other's cache lifecycle.
let cachedBundleUrl: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  const entryPoint = path.resolve("./src/remotion/index.tsx");
  console.log(TAG, "bundling —", entryPoint);
  cachedBundleUrl = await withTimeout(
    bundle({
      entryPoint,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve(".") },
        },
      }),
    }),
    180_000,
    "Remotion bundle()"
  );
  console.log(TAG, "bundle ready —", cachedBundleUrl);
  return cachedBundleUrl;
}

const EXTENSION_BY_FORMAT: Record<string, string> = { mp4: "mp4", webm: "webm", gif: "gif" };

export async function runMotionGraphicsRenderPipeline(
  jobId: string,
  template: Template,
  format: "mp4" | "gif" | "webm"
): Promise<string> {
  console.log(TAG, `starting — jobId=${jobId} templateId=${template.id} format=${format}`);

  const inputProps: MotionGraphicsCompositionProps = {
    templateName: template.name,
    aspectRatio: template.aspectRatio,
    scenes: template.scenes,
  };

  // ── Bundle ────────────────────────────────────────────────────────────
  await updateRenderJob(jobId, { stage: "bundling", progress: 10, message: "Bundling Remotion composition…" });
  let serveUrl: string;
  try {
    serveUrl = await getBundle();
  } catch (err) {
    throw new Error(`Remotion bundle failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Select composition ────────────────────────────────────────────────
  await updateRenderJob(jobId, { progress: 25, message: "Selecting composition…" });
  const composition = await withTimeout(
    selectComposition({ serveUrl, id: "MotionGraphicsStudio", inputProps }),
    60_000,
    "selectComposition()"
  );
  console.log(
    TAG,
    "composition ready — frames:",
    composition.durationInFrames,
    "size:",
    composition.width,
    "×",
    composition.height
  );

  // ── Render ─────────────────────────────────────────────────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mgs-render-"));
  const ext = EXTENSION_BY_FORMAT[format] ?? "mp4";
  const outputPath = path.join(tmpDir, `output.${ext}`);
  const codec = EXPORT_FORMAT_CODEC[format] as "h264" | "vp8" | "gif";

  await updateRenderJob(jobId, { stage: "rendering", progress: 30, message: "Launching Chromium…" });

  let started = false;
  try {
    await withTimeout(
      renderMedia({
        composition,
        serveUrl,
        codec,
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: { disableWebSecurity: true },
        onProgress: ({ progress }) => {
          if (!started) {
            started = true;
            void updateRenderJob(jobId, { message: "Rendering frames…" });
          }
          const pct = 30 + Math.round(progress * 60);
          void updateRenderJob(jobId, { progress: pct, message: `Rendering… ${Math.round(progress * 100)}%` });
        },
      }),
      20 * 60_000,
      "renderMedia()"
    );
  } catch (err) {
    throw new Error(`renderMedia failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Upload to R2 ───────────────────────────────────────────────────────
  await updateRenderJob(jobId, { progress: 92, message: "Uploading render…" });
  const fileBuffer = fs.readFileSync(outputPath);
  const contentType = format === "mp4" ? "video/mp4" : format === "webm" ? "video/webm" : "image/gif";
  const { url } = await upload(
    `motion-graphics/renders/${template.id}/${jobId}.${ext}`,
    fileBuffer,
    { contentType }
  );

  // best-effort local cleanup — safe to ignore failures (ephemeral tmp dir)
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* noop */
  }

  await updateRenderJob(jobId, {
    stage: "complete",
    progress: 100,
    message: "Render complete ✓",
    outputUrl: url,
    completedAt: new Date(),
  });

  console.log(TAG, "pipeline done — outputUrl:", url);
  return url;
}
