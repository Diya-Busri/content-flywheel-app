import { NextResponse } from "next/server";
import { checkApiRateLimit, getClientIp } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { faceProfilesTable } from "@/db/schema/face-profiles-schema";
import { eq } from "drizzle-orm";
import {
  createHiggsfieldJob,
  pollHiggsfieldUntilDone,
} from "@/lib/ugc-lab/higgsfield-provider";
import { uploadVideoFromUrlToBlob } from "@/lib/tiktok-shop/upload-video-blob";

/** UGC Lab job processing can take several minutes (Higgsfield ~2–6 min). */
export const maxDuration = 300;

/**
 * POST: Process a single video job (internal, fire-and-forget).
 * Uses Higgsfield image-to-video API.
 */
export async function POST(request: Request) {
  const rl = await checkApiRateLimit(getClientIp(request));
  if (rl) return rl;
  const body = await request.json().catch(() => ({}));
  const jobId = body.jobId as string | undefined;
  const userId = body.userId as string | undefined;

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const [job] = await db
      .select()
      .from(videoJobsTable)
      .where(eq(videoJobsTable.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.faceProfileId) {
      throw new Error("Face profile is required to generate a video");
    }

    await db
      .update(videoJobsTable)
      .set({ status: "processing", progress: "10", updatedAt: new Date() })
      .where(eq(videoJobsTable.id, jobId));

    // Fetch the face image URL from the profile
    const [profile] = await db
      .select()
      .from(faceProfilesTable)
      .where(eq(faceProfilesTable.id, job.faceProfileId));

    if (!profile?.imageUrl) {
      throw new Error("Face profile not found or missing image URL");
    }

    // Submit to Higgsfield
    const requestId = await createHiggsfieldJob({
      imageUrl: profile.imageUrl,
      templateId: job.templateId || "selfie-talk",
      script: job.fullScript ?? undefined,
    });

    await db
      .update(videoJobsTable)
      .set({ externalJobId: requestId, progress: "20", updatedAt: new Date() })
      .where(eq(videoJobsTable.id, jobId));

    // Poll until done
    const rawUrl = await pollHiggsfieldUntilDone(requestId, async (progress) => {
      try {
        await db
          .update(videoJobsTable)
          .set({ progress: String(progress), updatedAt: new Date() })
          .where(eq(videoJobsTable.id, jobId));
      } catch {
        // ignore progress update errors
      }
    });

    // Optionally persist to Vercel Blob for durability
    let videoUrl = rawUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        videoUrl = await uploadVideoFromUrlToBlob(rawUrl);
      } catch (e) {
        console.warn("[process-job] Blob persist failed, using raw URL:", e);
        videoUrl = rawUrl;
      }
    }

    await db
      .update(videoJobsTable)
      .set({
        status: "completed",
        progress: "100",
        videoUrl,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(videoJobsTable.id, jobId));

    return NextResponse.json({ ok: true, videoUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Processing failed";
    try {
      await db
        .update(videoJobsTable)
        .set({ status: "failed", error: msg, updatedAt: new Date() })
        .where(eq(videoJobsTable.id, jobId));
    } catch {
      // ignore
    }
    console.error("[process-job] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
