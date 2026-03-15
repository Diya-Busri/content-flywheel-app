/**
 * POST /api/videos/compile/test
 * Creates a 2-scene test script (public image URLs + voiceover URL), compiles, uploads to Supabase, returns URL.
 * Requires auth. Use to verify Phase 4 pipeline.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { savedScriptsTable } from "@/db/schema/library-schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { compileVideoToFile, cleanupWorkDir, type CompileScene } from "@/lib/videos/compile";
import { mkdir, readFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { tmpdir } from "os";

const BUCKET = "timeline-media";

const TEST_SCENES: CompileScene[] = [
  { duration: 5, image_url: "https://picsum.photos/1920/1080", video_url: null },
  { duration: 5, image_url: "https://picsum.photos/1920/1080", video_url: null },
];
const TEST_VOICEOVER_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

function storageErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 503 }
      );
    }

    const scenesJson = TEST_SCENES.map((s, i) => ({
      scene_number: i + 1,
      duration: s.duration,
      script_text: `Test scene ${i + 1}`,
      image_url: s.image_url,
      video_url: null,
    }));

    const [row] = await db
      .insert(savedScriptsTable)
      .values({
        userId,
        title: "Test Compile " + Date.now(),
        scenesJson,
        voiceoverUrl: TEST_VOICEOVER_URL,
      })
      .returning();

    if (!row) return NextResponse.json({ error: "Failed to create test script" }, { status: 500 });

    const scriptId = row.id;
    const workDir = join(tmpdir(), `video-compile-test-${randomUUID().slice(0, 8)}`);
    await mkdir(workDir, { recursive: true });

    try {
      const finalPath = await compileVideoToFile(workDir, TEST_SCENES, TEST_VOICEOVER_URL);
      const buffer = await readFile(finalPath);
      const fileName = `compiled-test-${Date.now()}.mp4`;
      const storagePath = `${userId}/${scriptId}/${fileName}`;

      let uploadResult = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: "video/mp4",
        upsert: true,
      });
      if (uploadResult.error && /bucket|not found|does not exist/i.test(storageErrorMessage(uploadResult.error))) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        uploadResult = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
          contentType: "video/mp4",
          upsert: true,
        });
      }
      if (uploadResult.error) {
        return NextResponse.json(
          { error: `Upload failed: ${storageErrorMessage(uploadResult.error)}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadResult.data.path);
      return NextResponse.json({ url: urlData.publicUrl, scriptId });
    } finally {
      await cleanupWorkDir(workDir);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[videos/compile/test] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
