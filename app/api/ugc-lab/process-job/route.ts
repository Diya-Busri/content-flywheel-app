import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { videoJobsTable } from "@/db/schema/video-jobs-schema";
import { faceProfilesTable } from "@/db/schema/face-profiles-schema";
import { eq } from "drizzle-orm";
import {
  createFaceSwapJob,
  pollFaceSwapUntilDone,
  getTemplateVideoUrl,
} from "@/lib/ugc-lab/faceswap-provider";
import { uploadVideoFromUrlToBlob } from "@/lib/tiktok-shop/upload-video-blob";

/** UGC Lab job processing can take several minutes (FaceSwap ~2–5 min). */
export const maxDuration = 300;

const useFaceSwap = () =>
  Boolean(
    (process.env.FACESWAP_API_KEY || process.env.REMAKER_API_KEY)?.trim()
  );

/** Check if job should use FaceSwap provider. UGC Lab uses FaceSwap only; null/undefined treated as faceswap. */
const isFaceSwapProvider = (provider: string | null | undefined) => {
  const p = String(provider ?? "").toLowerCase();
  return p === "faceswap" || p === "";
};

/**
 * POST: Process a single video job (internal, fire-and-forget).
 * UGC Lab uses FaceSwap only. Do not mark completed until video_url exists.
 */
export async function POST(request: Request) {
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

    await db
      .update(videoJobsTable)
      .set({ status: "processing", progress: "10", updatedAt: new Date() })
      .where(eq(videoJobsTable.id, jobId));

    let videoUrl: string | null = null;

    if (isFaceSwapProvider(job.provider)) {
      // FaceSwap provider: face image + template video → poll until done
      if (!useFaceSwap()) {
        throw new Error(
          "FACESWAP_API_KEY or REMAKER_API_KEY is not set. Add it to .env.local for FaceSwap."
        );
      }
      if (!job.faceProfileId) {
        throw new Error("Face profile is required for FaceSwap");
      }

      const [profile] = await db
        .select()
        .from(faceProfilesTable)
        .where(eq(faceProfilesTable.id, job.faceProfileId));

      if (!profile?.imageUrl) {
        throw new Error("Face profile not found or missing image");
      }

      const templateVideoUrl = getTemplateVideoUrl(
        job.templateId || "selfie-talk"
      );

      const externalJobId = await createFaceSwapJob({
        faceImageUrl: profile.imageUrl,
        templateVideoUrl,
        script: job.fullScript ?? undefined,
      });

      await db
        .update(videoJobsTable)
        .set({
          externalJobId,
          progress: "20",
          updatedAt: new Date(),
        })
        .where(eq(videoJobsTable.id, jobId));

      const rawUrl = await pollFaceSwapUntilDone(externalJobId, async (progress) => {
        try {
          await db
            .update(videoJobsTable)
            .set({
              progress: String(progress),
              updatedAt: new Date(),
            })
            .where(eq(videoJobsTable.id, jobId));
        } catch {
          // ignore progress update errors
        }
      });

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          videoUrl = await uploadVideoFromUrlToBlob(rawUrl);
        } catch (e) {
          console.warn("[process-job] FaceSwap blob persist failed:", e);
          videoUrl = rawUrl;
        }
      } else {
        videoUrl = rawUrl;
      }

      if (!videoUrl) {
        throw new Error("FaceSwap did not return a video URL");
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
    } else {
      const missing: string[] = [];
      if (!isFaceSwapProvider(job.provider)) {
        missing.push("provider must be faceswap");
      } else if (!useFaceSwap()) {
        missing.push("FACESWAP_API_KEY or REMAKER_API_KEY");
      }
      if (!job.faceProfileId) missing.push("face profile");
      throw new Error(
        `Cannot render video. Missing: ${missing.join(", ")}. Add FACESWAP_API_KEY and FACESWAP_TEMPLATE_VIDEO_URL to .env.local.`
      );
    }

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
