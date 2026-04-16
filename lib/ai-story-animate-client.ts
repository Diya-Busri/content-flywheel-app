const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

type AnimateStartResponse = {
  requestId?: string | null;
  request_id?: string | null;
  videoUrl?: string;
  error?: string;
  code?: string;
};

type AnimateStatusResponse = {
  status?: string;
  videoUrl?: string;
  error?: string;
};

/** Error thrown when user has no video credits. Callers can check err.code === "NO_VIDEO_CREDITS". */
export class NoVideoCreditsError extends Error {
  code = "NO_VIDEO_CREDITS";
  constructor(message = "You need 1 video credit to animate a scene.") {
    super(message);
    this.name = "NoVideoCreditsError";
  }
}

/** Calls the content-studio animate API and polls until a video URL is ready (matches scene-card polling behavior). */
export async function animateAiStorySceneFromImage(imageUrl: string, motionPrompt: string): Promise<string> {
  const res = await fetch("/api/content-studio/ai-story/animate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl,
      motionPrompt: motionPrompt.trim() || imageUrl,
    }),
  });
  const data = (await res.json()) as AnimateStartResponse;
  if (!res.ok) {
    if (res.status === 402 || data?.code === "NO_VIDEO_CREDITS") {
      throw new NoVideoCreditsError(data?.error ?? "You need 1 video credit to animate a scene.");
    }
    throw new Error(data?.error ?? "Animation failed");
  }
  if (typeof data.videoUrl === "string" && data.videoUrl.trim()) return data.videoUrl.trim();

  const requestId = data.requestId ?? data.request_id ?? null;
  if (!requestId) throw new Error("No requestId or videoUrl returned");

  for (let count = 0; count < MAX_POLLS; count++) {
    const stRes = await fetch(
      `/api/content-studio/ai-story/animate/status?requestId=${encodeURIComponent(requestId)}`
    );
    const st = (await stRes.json()) as AnimateStatusResponse;
    const status = st.status ?? "IN_QUEUE";
    if (status === "COMPLETED" && typeof st.videoUrl === "string" && st.videoUrl.trim()) {
      return st.videoUrl.trim();
    }
    if (status === "FAILED") {
      throw new Error(st.error ?? "Animation failed");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Animation timed out");
}
