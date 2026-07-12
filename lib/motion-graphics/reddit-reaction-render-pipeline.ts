/**
 * Motion Graphics Studio — Reddit Reaction Render Pipeline
 *
 * Mirrors lib/motion-graphics/render-pipeline.ts but targets the
 * "RedditReaction" Remotion composition instead of "MotionGraphicsStudio".
 *
 * The two pipelines share the same bundle (same entry point) and the same
 * bundle cache variable — so if MotionGraphicsStudio has already been
 * bundled, this pipeline reuses that bundle without a second webpack run.
 */

import os from "os";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { upload } from "@/lib/storage";
import { updateRenderJob } from "@/lib/motion-graphics/job-store";
import { EXPORT_FORMAT_CODEC } from "@/lib/motion-graphics/types";
import type {
  ContentProject,
  ExportFormat,
  RedditReactionCompositionProps,
} from "@/lib/motion-graphics/types";

const TAG = "[reddit-reaction/render-pipeline]";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s during: ${label}`)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

// Shared with the existing pipeline — both target the same Remotion index.
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

const EXTENSION: Record<string, string> = { mp4: "mp4", webm: "webm", gif: "gif" };

export async function runRedditReactionRenderPipeline(
  jobId: string,
  project: ContentProject,
  format: ExportFormat
): Promise<string> {
  console.log(TAG, `starting — jobId=${jobId} projectId=${project.id} format=${format}`);

  const inputProps: RedditReactionCompositionProps = {
    projectName: project.name,
    aspectRatio: project.aspectRatio,
    scenes: project.shortForm?.scenes ?? [],
    brandAccent: "#F89520",
    brandBg: "#0d0d0d",
  };

  await updateRenderJob(jobId, { stage: "bundling", progress: 10, message: "Bundling Remotion composition…" });
  let serveUrl: string;
  try {
    serveUrl = await getBundle();
  } catch (err) {
    throw new Error(`Remotion bundle failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  await updateRenderJob(jobId, { progress: 25, message: "Selecting composition…" });
  const composition = await withTimeout(
    selectComposition({ serveUrl, id: "RedditReaction", inputProps }),
    60_000,
    "selectComposition()"
  );
  console.log(TAG, "composition ready — frames:", composition.durationInFrames);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rr-render-"));
  const ext = EXTENSION[format] ?? "mp4";
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

  await updateRenderJob(jobId, { progress: 92, message: "Uploading render…" });
  const fileBuffer = fs.readFileSync(outputPath);
  const contentType = format === "mp4" ? "video/mp4" : format === "webm" ? "video/webm" : "image/gif";
  const { url } = await upload(
    `motion-graphics/reddit-renders/${project.id}/${jobId}.${ext}`,
    fileBuffer,
    { contentType }
  );

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* noop */ }

  await updateRenderJob(jobId, {
    stage: "complete",
    progress: 100,
    message: "Render complete ✓",
    outputUrl: url,
    completedAt: new Date(),
  });

  console.log(TAG, "done — outputUrl:", url);
  return url;
}
