export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { del } from "@/lib/storage";
import { checkApiRateLimit } from "@/lib/rate-limit-api";

export const runtime = "nodejs";
export const maxDuration = 120;

// Whisper API limit
const MAX_BYTES = 24 * 1024 * 1024; // 24 MB

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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

    let file: File;
    let blobUrlToDelete: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      // Large file path: video was uploaded directly to Vercel Blob by the client
      const { url, filename } = (await req.json()) as { url?: string; filename?: string };
      if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

      const fetchRes = await fetch(url);
      if (!fetchRes.ok) return NextResponse.json({ error: "Failed to fetch video from storage" }, { status: 400 });

      const buffer = await fetchRes.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        // Clean up blob then reject
        await del(url).catch(() => {});
        return NextResponse.json(
          { error: `Video is too large to transcribe (max 24 MB). Try trimming it first.` },
          { status: 400 }
        );
      }

      file = new File([buffer], filename || "video.mp4", {
        type: fetchRes.headers.get("content-type") || "video/mp4",
      });
      blobUrlToDelete = url;
    } else {
      // Small file path: sent directly as multipart form data
      const formData = await req.formData().catch(() => null);
      const f = formData?.get("file");
      if (!f || !(f instanceof File) || f.size === 0) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (f.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `Video is too large to transcribe (max 24 MB). Try trimming it first.` },
          { status: 400 }
        );
      }
      file = f;
    }

    const openai = new OpenAI({ apiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: whisperFile(file),
      model: "whisper-1",
      response_format: "text",
    });

    // Clean up the temporary blob after successful transcription
    if (blobUrlToDelete) {
      await del(blobUrlToDelete).catch(() => {});
    }

    return NextResponse.json({ transcript: transcription });
  } catch (err) {
    console.error("[transcribe-video]", err);
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
