/**
 * CF Video Engine – Render Pipeline
 *
 * Orchestrates the full render loop:
 *   1. Generate TTS audio for every scene (OpenAI tts-1)
 *   2. Bundle the Remotion composition (cached after first run)
 *   3. Select the "VideoEngine" composition with input props
 *   4. Render the MP4 via @remotion/renderer (Chrome-based)
 *   5. Save output to /public/engine-renders/{projectId}/output.mp4
 *
 * The bundle is cached in-process so subsequent renders skip the 30–60 s
 * webpack step. Restart the dev server to bust the cache.
 *
 * Audio files are saved to /public/engine-renders/{projectId}/audio/ and
 * served by the Next.js dev server so the Remotion Chrome renderer can
 * fetch them at http://localhost:{PORT}/engine-renders/...
 */

import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { VideoEngineProject } from './schema';
import type { EngineSceneData, VideoEngineCompositionProps } from '../../src/remotion/engine/VideoEngineComposition';
import { updateJob } from './job-store';

// ─── Logging prefix ───────────────────────────────────────────────────────────

const TAG = '[render-pipeline]';

// ─── Timeout helper ───────────────────────────────────────────────────────────

/**
 * Races `promise` against a timeout.
 * If the timeout fires first, rejects with a descriptive error so the stuck
 * stage shows up as a visible failure instead of hanging indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms / 1000}s during: ${label}`));
    }, ms);

    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Bundle cache ─────────────────────────────────────────────────────────────

let cachedBundleUrl: string | null = null;

async function getBundle(): Promise<string> {
  if (cachedBundleUrl) {
    console.log(TAG, 'bundle: using cached bundle →', cachedBundleUrl);
    return cachedBundleUrl;
  }

  const entryPoint = path.resolve('./src/remotion/index.tsx');
  console.log(TAG, 'bundle: starting webpack compilation — entry:', entryPoint);

  cachedBundleUrl = await withTimeout(
    bundle({
      entryPoint,
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias ?? {}),
            '@': path.resolve('.'),
          },
        },
      }),
    }),
    180_000, // 3 min — bundle is documented as 30–60 s; give 3× margin
    'Remotion bundle()',
  );

  console.log(TAG, 'bundle: compilation complete →', cachedBundleUrl);
  return cachedBundleUrl;
}

// ─── TTS generation ───────────────────────────────────────────────────────────

async function generateTts(
  openai: OpenAI,
  text: string,
  outputPath: string,
): Promise<void> {
  const response = await withTimeout(
    openai.audio.speech.create({
      model: 'tts-1',        // faster; use 'tts-1-hd' for higher quality
      voice: 'alloy',        // clear, neutral voice good for faceless content
      input: text,
      response_format: 'mp3',
    }),
    45_000, // 45 s per TTS call
    `OpenAI TTS for "${text.slice(0, 40)}…"`,
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function runRenderPipeline(
  jobId: string,
  project: VideoEngineProject,
): Promise<string> {
  console.log(
    TAG,
    `starting — jobId=${jobId} projectId=${project.id} scenes=${project.scenes.length}`,
  );

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Derive the local server base URL for audio asset delivery to Chrome
  const port    = process.env.PORT ?? '3000';
  const baseUrl = process.env.NEXTAUTH_URL ?? `http://localhost:${port}`;
  console.log(TAG, 'asset base URL:', baseUrl);

  // ── Directory setup ──────────────────────────────────────────────────────
  const projectDir = path.resolve(`public/engine-renders/${project.id}`);
  const audioDir   = path.join(projectDir, 'audio');
  const outputPath = path.join(projectDir, 'output.mp4');
  console.log(TAG, 'output path:', outputPath);

  try {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log(TAG, 'created audio dir:', audioDir);
  } catch (err) {
    throw new Error(
      `Failed to create audio directory: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Stage 1: TTS audio per scene ─────────────────────────────────────────
  updateJob(jobId, { stage: 'generating_audio', progress: 5, message: 'Generating voiceovers…' });
  console.log(TAG, 'stage: generating_audio — TTS for', project.scenes.length, 'scenes');

  const audioUrls: Record<string, string> = {};
  const sceneCount = project.scenes.length;

  for (let i = 0; i < sceneCount; i++) {
    const scene   = project.scenes[i];
    const pct     = 5 + Math.round(((i + 1) / sceneCount) * 35);
    const preview = scene.voiceover.slice(0, 40);

    console.log(TAG, `TTS ${i + 1}/${sceneCount}: sceneId=${scene.id} text="${preview}…"`);
    updateJob(jobId, {
      progress: pct,
      message: `Voiceover ${i + 1}/${sceneCount}: "${preview}…"`,
    });

    const audioFile = path.join(audioDir, `${scene.id}.mp3`);

    if (scene.voiceover.trim()) {
      try {
        await generateTts(openai, scene.voiceover, audioFile);
        console.log(TAG, `TTS ${i + 1}/${sceneCount}: written →`, audioFile);
      } catch (err) {
        throw new Error(
          `TTS failed for scene ${scene.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      // Write silent placeholder — minimal valid MP3 frame
      const silentMp3 = Buffer.from(
        'fffb9000000000000000000000000000000000000000000000000000000000000000',
        'hex',
      );
      fs.writeFileSync(audioFile, silentMp3);
      console.log(TAG, `TTS ${i + 1}/${sceneCount}: no voiceover — wrote silent placeholder`);
    }

    audioUrls[scene.id] = `${baseUrl}/engine-renders/${project.id}/audio/${scene.id}.mp3`;
  }

  console.log(TAG, 'stage: generating_audio — all TTS done');

  // ── Stage 2: Bundle Remotion ─────────────────────────────────────────────
  const bundleMsg = cachedBundleUrl
    ? 'Using cached Remotion bundle…'
    : 'Bundling Remotion composition (one-time, ~60s)…';

  updateJob(jobId, { stage: 'bundling', progress: 42, message: bundleMsg });
  console.log(TAG, 'stage: bundling —', bundleMsg);

  let serveUrl: string;
  try {
    serveUrl = await getBundle();
  } catch (err) {
    throw new Error(
      `Remotion bundle failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Stage 3: Build input props ────────────────────────────────────────────

  /**
   * Resolve an asset URL for Remotion's Chromium renderer.
   *
   * SVG files: read from disk and embed as a base64 data URI.
   *   Reason: Remotion's webpack bundler registers every file in /public as a
   *   "static asset" served by its own local bundle server.  When the composition
   *   passes an absolute http://localhost:3000/... URL for an SVG, Chromium's
   *   <Img> fetch goes to the Next.js server — a *different* origin from the
   *   bundle server — and that cross-server SVG fetch fails silently (the render
   *   still completes because delayRender() eventually times out, but the frame
   *   shows the black composition background instead of the SVG).
   *
   *   Data URIs are self-contained: no network request, no origin mismatch,
   *   no MIME-type or timing issues.  A 13KB SVG ≈ 17KB base64 — negligible.
   *
   * Other files (JPEG, PNG, MP4, …): pass the absolute http://localhost URL.
   *   These work fine because Remotion / Chromium handles raster images and
   *   audio differently (they go through the bundle server's proxy, not a direct
   *   cross-origin fetch).
   */
  const resolveAssetUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('data:')) return url;                       // already a data URI
    if (url.startsWith('http://') || url.startsWith('https://')) return url; // external

    // Local path (starts with /) — check extension
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const localPath = path.resolve(`public${url.startsWith('/') ? url : `/${url}`}`);

    if (ext === 'svg') {
      if (fs.existsSync(localPath)) {
        console.log(TAG, `SVG → data URI: ${url}`);
        const svgContent = fs.readFileSync(localPath, 'utf8');
        const b64 = Buffer.from(svgContent).toString('base64');
        return `data:image/svg+xml;base64,${b64}`;
      }
      console.warn(TAG, `SVG not found on disk, falling back to HTTP: ${localPath}`);
    }

    return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  };

  const scenes: EngineSceneData[] = project.scenes.map((s) => ({
    id:              s.id,
    sceneNumber:     s.sceneNumber,
    durationSeconds: s.durationSeconds,
    sceneType:       s.sceneType as EngineSceneData['sceneType'],
    onScreenText:    s.onScreenText ?? '',
    voiceover:       s.voiceover ?? '',
    transition:      s.transition,
    assetUrl:        resolveAssetUrl(s.assetUrl),
  }));

  console.log(
    TAG,
    'input props ready:',
    scenes.map((s) => ({
      id: s.id,
      type: s.sceneType,
      duration: s.durationSeconds,
      hasAsset: !!s.assetUrl,
      hasAudio: !!audioUrls[s.id],
    })),
  );

  const inputProps: VideoEngineCompositionProps = {
    projectTitle: project.title,
    scenes,
    audioUrls,
  };

  // ── Stage 4: Select composition ───────────────────────────────────────────
  updateJob(jobId, { progress: 50, message: 'Selecting composition…' });
  console.log(TAG, 'stage: selectComposition');

  let composition: Awaited<ReturnType<typeof selectComposition>>;
  try {
    composition = await withTimeout(
      selectComposition({ serveUrl, id: 'VideoEngine', inputProps }),
      60_000,
      'selectComposition()',
    );
    console.log(
      TAG,
      'selectComposition OK — fps:', composition.fps,
      'frames:', composition.durationInFrames,
      'size:', composition.width, '×', composition.height,
    );
  } catch (err) {
    throw new Error(
      `selectComposition failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Stage 5: Render ───────────────────────────────────────────────────────
  updateJob(jobId, { stage: 'rendering', progress: 55, message: 'Launching Chromium…' });
  console.log(TAG, 'stage: renderMedia — codec=h264, output:', outputPath);

  let chromiumStarted = false;

  try {
    await withTimeout(
      renderMedia({
        composition,
        serveUrl,
        codec:          'h264',
        outputLocation: outputPath,
        inputProps,
        chromiumOptions: {
          disableWebSecurity: true,   // allow localhost audio URLs cross-origin
        },
        onBrowserLog: (log) => {
          // Remotion uses 'warning' (not 'warn') for browser console.warn calls
          if (log.type === 'warning' || log.type === 'assert') {
            console.warn(TAG, `chromium [${log.type}]:`, log.text);
          } else if (log.type === 'verbose' || log.type === 'debug') {
            // skip noisy debug messages
          } else {
            // 'log' and 'info' are captured so composition-level logs appear here
            console.log(TAG, `chromium [${log.type}]:`, log.text);
          }
        },
        onProgress: ({ progress, renderedFrames, encodedFrames }) => {
          if (!chromiumStarted) {
            chromiumStarted = true;
            console.log(TAG, 'Chromium launched — first frame received');
            updateJob(jobId, { message: 'Rendering frames…' });
          }
          const pct        = 55 + Math.round(progress * 42);
          const pctDisplay = Math.round(progress * 100);
          // Log every 10% to avoid noise (skip the 0% boundary — 0 % 10 is always 0)
          if (pctDisplay > 0 && pctDisplay % 10 === 0 || pct >= 97) {
            console.log(
              TAG,
              `render progress: ${pctDisplay}%`,
              `(rendered=${renderedFrames}, encoded=${encodedFrames})`,
            );
          }
          updateJob(jobId, {
            progress: pct,
            message: `Rendering… ${pctDisplay}%`,
          });
        },
      }),
      20 * 60_000, // 20 min hard cap — catches truly stuck renders
      'renderMedia()',
    );
    console.log(TAG, 'renderMedia: complete');
  } catch (err) {
    throw new Error(
      `renderMedia failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const downloadUrl = `/engine-renders/${project.id}/output.mp4`;

  updateJob(jobId, {
    stage:       'complete',
    progress:    100,
    message:     'Render complete ✓',
    downloadUrl,
    completedAt: new Date().toISOString(),
  });

  console.log(TAG, 'pipeline done — downloadUrl:', downloadUrl);
  return downloadUrl;
}
