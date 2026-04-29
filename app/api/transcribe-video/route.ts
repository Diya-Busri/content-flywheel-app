import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";
export const maxDuration = 120;

// Whisper API limit
const MAX_BYTES = 24 * 1024 * 1024; // 24MB (Whisper limit is 25MB)

// Whisper accepts these formats. .mov is QuickTime — rename to .mp4 since
// both are ISO Base Media containers and ffmpeg handles them identically.
function whisperFile(file: File): File {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mov")) {
    return new File([file], file.name.replace(/\.mov$/i, ".mp4"), { type: "video/mp4" });
  }
  return file;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiRl = await checkApiRateLimit(userId);
    if (apiRl) return apiRl;

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Video is too large to transcribe (max 24 MB). Try trimming it first.` },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: whisperFile(file),
      model: "whisper-1",
      response_format: "text",
    });

    return NextResponse.json({ transcript: transcription });
  } catch (err) {
    console.error("[transcribe-video]", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
