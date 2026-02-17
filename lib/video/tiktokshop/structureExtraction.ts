import type { StructureBlueprint } from "./types";

/**
 * Extract transcript from a video/audio URL using OpenAI Whisper.
 * Fetches the URL, sends to Whisper, returns transcript text.
 */
export async function getTranscriptFromVideoUrl(inputVideoUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch(inputVideoUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error("Failed to fetch video/audio: " + response.status);

  const contentType = response.headers.get("content-type") ?? "";
  const isAudioOrVideo =
    /audio\/|video\/|application\/octet-stream/.test(contentType) ||
    inputVideoUrl.match(/\.(mp4|mp3|m4a|wav|webm)(\?|$)/i);

  if (!isAudioOrVideo && response.headers.get("content-length") && Number(response.headers.get("content-length")) > 25 * 1024 * 1024) {
    throw new Error("File too large for Whisper (max 25MB). Use a shorter clip or compress.");
  }

  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType || "audio/mpeg" });
  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("model", "whisper-1");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  const text = await whisperRes.text();
  if (!whisperRes.ok) {
    console.error("[tiktokshop/structure] Whisper error:", whisperRes.status, text.slice(0, 200));
    throw new Error("Transcript extraction failed: " + whisperRes.status);
  }

  let result: { text?: string };
  try {
    result = JSON.parse(text);
  } catch {
    return text.trim();
  }
  return (result.text ?? text).trim();
}

/**
 * Analyze transcript and return a structure blueprint (hook type, pacing, CTA style).
 * No copying of script or visuals – structural pattern only.
 */
export async function extractStructure(transcript: string): Promise<StructureBlueprint> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // gpt-4o-mini: structure extraction only, low complexity
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze short-form video structure only. Output STRICT JSON only. No markdown.
Return: { "hookType": string, "pacing": string, "ctaStyle": string, "transcriptSummary": string (1-2 sentences), "sceneDurationsHint": [number, number, number, number, number] (seconds per scene, 5 values, total 20-45) }
Do NOT copy any script, visuals, or creative content. Describe only structural patterns: e.g. hook type (question, bold claim, problem), pacing (fast cuts, slow build), CTA style (direct, soft, urgency).`,
        },
        {
          role: "user",
          content: `Transcript of a short-form video:\n\n${transcript.slice(0, 8000)}\n\nReturn the structure blueprint as JSON only.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("[tiktokshop/structure] OpenAI error:", res.status, body.slice(0, 200));
    throw new Error("Structure extraction failed: " + res.status);
  }

  const json = JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("No structure content");

  const cleaned = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
  const blueprint = JSON.parse(cleaned) as StructureBlueprint;
  if (!blueprint.hookType || !blueprint.pacing || !blueprint.ctaStyle) {
    throw new Error("Blueprint missing hookType, pacing, or ctaStyle");
  }
  return blueprint;
}

/**
 * Extract transcript from input video URL, then analyze and return structure blueprint.
 */
export async function structureExtractionMode(inputVideoUrl: string): Promise<StructureBlueprint> {
  const transcript = await getTranscriptFromVideoUrl(inputVideoUrl);
  if (!transcript.trim()) throw new Error("Transcript was empty");
  return extractStructure(transcript);
}
