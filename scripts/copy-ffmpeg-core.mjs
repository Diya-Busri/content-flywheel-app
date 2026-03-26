/**
 * 1) Copies @ffmpeg/core into public/ffmpeg-core/ (wasm + js).
 * 2) Copies @ffmpeg/ffmpeg ESM worker + tiny deps into public/ffmpeg-wasm/ so Next.js does NOT
 *    bundle worker.js (webpack rewrites dynamic import() and breaks blob/http core URLs).
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcDir = join(root, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destDir = join(root, "public", "ffmpeg-core");
const ffmpegEsmDir = join(root, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const destWorkerDir = join(root, "public", "ffmpeg-wasm");

try {
  if (!statSync(srcDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.warn("[copy-ffmpeg] Skip: @ffmpeg/core not installed");
    process.exit(0);
  }
  mkdirSync(destDir, { recursive: true });
  let nCore = 0;
  for (const name of readdirSync(srcDir)) {
    const src = join(srcDir, name);
    if (statSync(src).isFile()) {
      copyFileSync(src, join(destDir, name));
      nCore += 1;
    }
  }
  console.log(`[copy-ffmpeg] Wrote ${nCore} file(s) to public/ffmpeg-core/`);

  if (!statSync(ffmpegEsmDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.warn("[copy-ffmpeg] Skip worker copy: @ffmpeg/ffmpeg not installed");
    process.exit(0);
  }
  mkdirSync(destWorkerDir, { recursive: true });
  const workerFiles = ["worker.js", "const.js", "errors.js"];
  for (const name of workerFiles) {
    const src = join(ffmpegEsmDir, name);
    if (!statSync(src, { throwIfNoEntry: false })?.isFile()) {
      console.error(`[copy-ffmpeg] Missing ${name} in @ffmpeg/ffmpeg`);
      process.exit(1);
    }
    copyFileSync(src, join(destWorkerDir, name));
  }
  console.log(`[copy-ffmpeg] Wrote ${workerFiles.length} file(s) to public/ffmpeg-wasm/`);
} catch (e) {
  console.error("[copy-ffmpeg]", e);
  process.exit(1);
}
