#!/usr/bin/env node
/**
 * One-time fix: set exactText = scriptText (or full script from hook+body+cta) for every scene in every video guide.
 * Usage: node scripts/fix-video-guide-text-overlays.mjs
 * Requires: DATABASE_URL in .env.local or environment
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

function parseTiming(t) {
  const s = String(t ?? "").trim();
  const simple = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*s?$/i);
  if (simple) return { startSec: parseFloat(simple[1]), endSec: parseFloat(simple[2]) };
  const colon = s.match(/^(\d+):(\d{2}(?:\.\d+)?)\s*[-–]\s*(\d+):(\d{2}(?:\.\d+)?)\s*$/);
  if (colon) {
    return {
      startSec: parseInt(colon[1], 10) * 60 + parseFloat(colon[2]),
      endSec: parseInt(colon[3], 10) * 60 + parseFloat(colon[4]),
    };
  }
  return { startSec: 0, endSec: 0 };
}

function splitIntoSentences(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function distributeSentencesToScenes(sentences, timings) {
  const n = timings.length;
  if (n === 0 || sentences.length === 0) return Array(n).fill("");
  const totalDuration = timings.reduce((sum, t) => sum + Math.max(0, t.endSec - t.startSec), 0);
  if (totalDuration <= 0) {
    const equalCount = Math.max(1, Math.floor(sentences.length / n));
    const chunks = [];
    let offset = 0;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const count = isLast ? sentences.length - offset : Math.min(equalCount, sentences.length - offset);
      chunks.push(sentences.slice(offset, offset + count).join(" ").trim());
      offset += count;
    }
    return chunks;
  }
  const sentenceCount = sentences.length;
  const sentenceFractionPerSec = sentenceCount / totalDuration;
  const chunks = [];
  let sentenceOffset = 0;
  for (let i = 0; i < n; i++) {
    const { startSec, endSec } = timings[i];
    const duration = Math.max(0, endSec - startSec);
    const countForScene = Math.max(0, Math.round(sentenceFractionPerSec * duration));
    const isLast = i === n - 1;
    const take = isLast ? Math.max(countForScene, sentenceCount - sentenceOffset) : countForScene;
    const chunk = sentences.slice(sentenceOffset, sentenceOffset + take).join(" ").trim();
    sentenceOffset += take;
    chunks.push(chunk);
  }
  if (sentenceOffset < sentenceCount && chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    const remainder = sentences.slice(sentenceOffset).join(" ").trim();
    chunks[chunks.length - 1] = last ? `${last} ${remainder}`.trim() : remainder;
  }
  return chunks;
}

function fixScenes(content) {
  const scenes = content?.scenes;
  const script = content?.script;
  if (!Array.isArray(scenes) || scenes.length === 0) return content;
  const fullScript =
    script && typeof script === "object"
      ? [script.hook, script.body, script.cta].filter(Boolean).map((s) => String(s ?? "").trim()).join(" ").trim()
      : "";
  const sentences = fullScript ? splitIntoSentences(fullScript) : [];
  const timings = scenes.map((s) => parseTiming(s.timing));
  const derivedChunks = sentences.length > 0 ? distributeSentencesToScenes(sentences, timings) : [];
  const updatedScenes = scenes.map((scene, i) => {
    const scriptText =
      typeof scene.scriptText === "string" && scene.scriptText.trim().length > 0
        ? scene.scriptText.trim()
        : derivedChunks[i] ?? null;
    if (!scriptText) return scene;
    const raw = scene.textOverlay;
    const base =
      raw == null
        ? {}
        : typeof raw === "string"
          ? { exactText: raw }
          : Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object" && raw[0]
            ? { ...raw[0] }
            : typeof raw === "object" && raw && "exactText" in raw
              ? { ...raw }
              : {};
    return { ...scene, textOverlay: { ...base, exactText: scriptText }, scriptText: scriptText };
  });
  return { ...content, scenes: updatedScenes };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`
      SELECT id, content
      FROM scripts
      WHERE platform = 'video-guide'
        AND deleted_at IS NULL
    `;
    console.log(`Found ${rows.length} video guide(s).`);
    let updated = 0;
    for (const row of rows) {
      let content;
      try {
        content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
      } catch {
        console.warn(`Skip ${row.id}: invalid JSON`);
        continue;
      }
      const fixed = fixScenes(content);
      if (JSON.stringify(fixed) === JSON.stringify(content)) {
        continue;
      }
      await sql`
        UPDATE scripts
        SET content = ${JSON.stringify(fixed)}, updated_at = now()
        WHERE id = ${row.id}
      `;
      updated += 1;
      console.log(`Updated guide ${row.id}`);
    }
    console.log(`Done. Updated ${updated} of ${rows.length} guide(s).`);
  } catch (err) {
    console.error("Fix failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
