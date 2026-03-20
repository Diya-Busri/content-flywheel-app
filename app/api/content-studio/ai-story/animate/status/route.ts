import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FAL_ENDPOINT = "fal-ai/kling-video/v1.6/standard/image-to-video";

/**
 * GET: Poll animation job status via Fal SDK. Query: requestId=...
 * Returns: { status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED", videoUrl?: string, error?: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestId = request.nextUrl.searchParams.get("requestId")?.trim() ?? "";
    if (!requestId) {
      return NextResponse.json(
        { error: "requestId is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FAL_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_API_KEY is not configured" },
        { status: 503 }
      );
    }

    fal.config({ credentials: apiKey });

    const statusResult = await fal.queue.status(FAL_ENDPOINT, {
      requestId,
      logs: false,
    });

    const statusObj = statusResult as {
      status?: string;
      error?: string;
      [key: string]: unknown;
    };
    console.log("[fal-status] SDK status response:", JSON.stringify(statusObj, null, 2));

    const status =
      statusObj?.status ?? (statusObj as { data?: { status?: string } })?.data?.status ?? undefined;

    if (status === "COMPLETED") {
      const result = await fal.queue.result(FAL_ENDPOINT, { requestId });
      const resultObj = result as {
        video?: { url?: string };
        data?: { video?: { url?: string } };
        video_url?: string;
        url?: string;
      };
      const videoUrl =
        resultObj?.video?.url ??
        resultObj?.data?.video?.url ??
        resultObj?.video_url ??
        resultObj?.url;
      if (videoUrl && typeof videoUrl === "string") {
        return NextResponse.json({ status: "COMPLETED", videoUrl });
      }
      return NextResponse.json({
        status: "COMPLETED",
        error: "No video URL in result",
      });
    }

    if (status === "FAILED") {
      const errMsg =
        statusObj?.error ??
        (statusObj as { data?: { error?: string } })?.data?.error ??
        "Animation failed";
      return NextResponse.json({
        status: "FAILED",
        error: errMsg,
      });
    }

    return NextResponse.json({
      status: status ?? "IN_QUEUE",
    });
  } catch (e) {
    console.error("[animate/status]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status check failed" },
      { status: 500 }
    );
  }
}
