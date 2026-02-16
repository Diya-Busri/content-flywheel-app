/**
 * HeyGen API client for AI avatar videos.
 * Uses POST /v2/video/generate (Create Avatar Video v2) - scene-based, NOT template-based.
 * https://docs.heygen.com/reference/create-an-avatar-video-v2
 */

const HEYGEN_BASE = "https://api.heygen.com";

/** 9:16 vertical format - TikTok/Reels. 720p for free tier; paid plans can use 1080x1920. */
const DIMENSION_9_16 = { width: 720, height: 1280 } as const;

/** Background presets (hex). Default white #FFFFFF avoided in favor of branded presets. */
export const HEYGEN_BACKGROUND_PRESETS = {
  studio: { type: "color" as const, value: "#0f0f0f" },
  office: { type: "color" as const, value: "#e8e8e8" },
  bedroom: { type: "color" as const, value: "#f5e6d3" },
  gradient: { type: "color" as const, value: "#e0e7ff" },
  warm: { type: "color" as const, value: "#fef3c7" },
} as const;

export type HeyGenBackgroundPreset = keyof typeof HEYGEN_BACKGROUND_PRESETS;

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key?.trim()) {
    throw new Error("HEYGEN_API_KEY is not set. Add it to .env.local for avatar videos.");
  }
  return key.trim();
}

export type HeyGenAvatar = {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  premium?: boolean;
};

export type HeyGenVoice = {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
};

/** List available avatars (non-premium first). */
export async function listAvatars(): Promise<HeyGenAvatar[]> {
  const res = await fetch(`${HEYGEN_BASE}/v2/avatars`, {
    headers: { "X-Api-Key": getApiKey() },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[heygen] listAvatars failed:", res.status, err);
    throw new Error(`HeyGen list avatars failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { data?: { avatars?: HeyGenAvatar[] } };
  const avatars = data.data?.avatars ?? [];
  return avatars.sort((a, b) => (a.premium ? 1 : 0) - (b.premium ? 1 : 0));
}

/** List available voices. */
export async function listVoices(): Promise<HeyGenVoice[]> {
  const res = await fetch(`${HEYGEN_BASE}/v2/voices`, {
    headers: { "X-Api-Key": getApiKey() },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[heygen] listVoices failed:", res.status, err);
    throw new Error(`HeyGen list voices failed: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { data?: { voices?: HeyGenVoice[] } };
  return data.data?.voices ?? [];
}

/** Character framing: scale (0.5–2) and offset {x,y} (-1–1) for crop/position. */
export type HeyGenFraming = {
  scale?: number;
  offset?: { x?: number; y?: number };
};

export type GenerateAvatarVideoOptions = {
  script: string;
  avatarId?: string;
  voiceId?: string;
  /** Avatar display style: normal, circle, or closeUp */
  avatarStyle?: "normal" | "circle" | "closeUp";
  /** 9:16 forced by default. Override only if needed. */
  dimension?: { width: number; height: number };
  /** Background preset (studio, office, bedroom, etc.) instead of plain white */
  backgroundPreset?: HeyGenBackgroundPreset;
  /** Product/image URL to show behind avatar. Uses image background when provided. */
  backgroundImageUrl?: string;
  /** Character framing: scale and offset for crop/position */
  framing?: HeyGenFraming;
  caption?: boolean;
  /** Voice emotion: adds expressiveness (Friendly, Excited, etc.) to reduce static feel */
  voiceEmotion?: "Friendly" | "Excited" | "Serious" | "Soothing" | "Broadcaster";
  /** Use Avatar IV for more natural movement (when available) */
  useAvatarIV?: boolean;
};

/**
 * Create an avatar video from a script. Returns the video URL when complete.
 * Uses first available avatar/voice if not specified.
 */
export async function generateAvatarVideo(options: GenerateAvatarVideoOptions): Promise<string> {
  const apiKey = getApiKey();
  const script = options.script.trim();
  if (!script || script.length > 5000) {
    throw new Error("HeyGen script must be 1–5000 characters.");
  }

  let avatarId = options.avatarId;
  let voiceId = options.voiceId;

  if (!avatarId || !voiceId) {
    const [avatars, voices] = await Promise.all([listAvatars(), listVoices()]);
    const getId = (a: HeyGenAvatar) => (a.avatar_id ?? (a as Record<string, unknown>).avatarId) as string | undefined;
    const getVoiceId = (v: HeyGenVoice) => (v.voice_id ?? (v as Record<string, unknown>).voiceId) as string | undefined;
    const bestAvatar = avatars.find((a) => !a.premium) ?? avatars[0];
    const bestVoice = voices.find((v) => v.gender === "female" || v.language === "en") ?? voices[0];
    avatarId = avatarId ?? (bestAvatar ? getId(bestAvatar) : undefined);
    voiceId = voiceId ?? (bestVoice ? getVoiceId(bestVoice) : undefined);
    if (!avatarId || !voiceId) {
      throw new Error("HeyGen: no avatars or voices available. Check your API key and plan.");
    }
  }

  // Force 9:16 vertical format (TikTok/Reels); override only if explicitly provided
  const dimension = options.dimension ?? DIMENSION_9_16;

  // Use product image as background when provided; otherwise background preset (no plain white)
  const background =
    options.backgroundImageUrl?.trim() && options.backgroundImageUrl.startsWith("http")
      ? { type: "image" as const, url: options.backgroundImageUrl.trim() }
      : HEYGEN_BACKGROUND_PRESETS[options.backgroundPreset ?? "office"];

  const character: Record<string, unknown> = {
    type: "avatar",
    avatar_id: avatarId,
    avatar_style: options.avatarStyle ?? "normal",
  };
  if (options.framing?.scale != null) character.scale = options.framing.scale;
  if (options.framing?.offset?.x != null || options.framing?.offset?.y != null) {
    character.offset = options.framing.offset;
  }
  if (options.useAvatarIV === true) character.use_avatar_iv_model = true;

  const voicePayload: Record<string, unknown> = {
    type: "text",
    input_text: script,
    voice_id: voiceId,
  };
  if (options.voiceEmotion) voicePayload.emotion = options.voiceEmotion;

  const payload = {
    video_inputs: [
      {
        character,
        voice: voicePayload,
        background,
      },
    ],
    dimension,
    caption: options.caption ?? true,
  };
  console.log("[heygen] Creating avatar video, avatarId:", avatarId, "voiceId:", voiceId, "scriptLen:", script.length, "payloadKeys:", Object.keys(payload));
  const createRes = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    let errJson: unknown;
    try {
      errJson = JSON.parse(errText);
    } catch {
      errJson = errText;
    }
    console.error("[heygen] Avatar video create failed:", createRes.status, "body:", errJson);
    throw new Error(`HeyGen create video failed: ${createRes.status} ${errText.slice(0, 500)}`);
  }

  const createRaw = (await createRes.json()) as Record<string, unknown>;
  const createData = createRaw.data as Record<string, unknown> | undefined;
  const videoId = (createData?.video_id ?? createRaw.video_id) as string | undefined;
  if (!videoId || typeof videoId !== "string") {
    console.error("[heygen] Create response missing video_id. Raw:", JSON.stringify(createRaw).slice(0, 600));
    throw new Error("HeyGen did not return a video_id. Check API response and plan limits.");
  }

  console.log("[heygen] Video created, polling for completion:", videoId);

  return pollVideoStatus(videoId, apiKey);
}

async function pollVideoStatus(videoId: string, apiKey: string): Promise<string> {
  const maxAttempts = 120; // ~4 min at 2s interval
  const intervalMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(`${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`, {
      headers: { "X-Api-Key": apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn("[heygen] Status poll failed:", res.status, err);
      if (attempt < maxAttempts - 1) continue;
      throw new Error(`HeyGen status check failed: ${res.status}`);
    }

    const raw = (await res.json()) as Record<string, unknown>;
    // HeyGen can return { data: { status, video_url } } or nested data.data
    const dataObj = (raw.data ?? raw) as Record<string, unknown>;
    const inner = (dataObj?.data ?? dataObj) as Record<string, unknown>;
    const status = String(inner?.status ?? dataObj?.status ?? "");

    if (status === "completed") {
      const url = (inner?.video_url ?? dataObj?.video_url) as string | undefined;
      if (url && typeof url === "string") {
        console.log("[heygen] Video ready:", url.slice(0, 60) + "...");
        return url;
      }
    }

    if (status === "failed") {
      const errVal = inner?.error ?? dataObj?.error;
      const msg =
        (errVal && typeof errVal === "object" && "message" in errVal ? (errVal as { message?: string }).message : null) ??
        (typeof errVal === "string" ? errVal : "Unknown error");
      throw new Error(`HeyGen video generation failed: ${msg}`);
    }

    console.log("[heygen] Poll", attempt + 1, "status:", status);
  }

  throw new Error("HeyGen video generation timed out.");
}

const HEYGEN_UPLOAD_BASE = "https://upload.heygen.com";

/**
 * Upload an image as a talking photo. Returns talking_photo_id for use in video generation.
 * Image must show a single face clearly (person holding product).
 */
export async function uploadTalkingPhoto(imageBuffer: Buffer, contentType: "image/jpeg" | "image/png" = "image/png"): Promise<string> {
  const apiKey = getApiKey();
  const res = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/talking_photo`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": contentType,
    },
    body: imageBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HeyGen talking photo upload failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const inner = (data.data ?? data) as Record<string, unknown>;
  const talkingPhotoId = (inner?.id ?? inner?.talking_photo_id ?? data.talking_photo_id) as string | undefined;
  if (!talkingPhotoId || typeof talkingPhotoId !== "string") {
    console.error("[heygen] Talking photo upload response:", JSON.stringify(data).slice(0, 400));
    throw new Error("HeyGen did not return a talking_photo_id.");
  }
  return talkingPhotoId;
}

export type GenerateProductInHandVideoOptions = {
  script: string;
  talkingPhotoId: string;
  voiceId?: string;
  dimension?: { width: number; height: number };
  caption?: boolean;
  backgroundPreset?: HeyGenBackgroundPreset;
  voiceEmotion?: "Friendly" | "Excited" | "Soothing" | "Serious" | "Broadcaster";
};

/**
 * Generate a video from a talking photo (e.g. AI-generated person-holding-product image).
 */
export async function generateVideoFromTalkingPhoto(
  options: GenerateProductInHandVideoOptions
): Promise<string> {
  const apiKey = getApiKey();
  const script = options.script.trim();
  if (!script || script.length > 5000) {
    throw new Error("HeyGen script must be 1–5000 characters.");
  }

  let voiceId = options.voiceId;
  if (!voiceId) {
    const voices = await listVoices();
    const getVoiceId = (v: HeyGenVoice) => (v.voice_id ?? (v as Record<string, unknown>).voiceId) as string | undefined;
    const best = voices.find((v) => v.gender === "female" || v.language === "en") ?? voices[0];
    voiceId = best ? getVoiceId(best) : undefined;
    if (!voiceId) throw new Error("HeyGen: no voices available.");
  }

  const dimension = options.dimension ?? DIMENSION_9_16;
  const character: Record<string, unknown> = {
    type: "talking_photo" as const,
    talking_photo_id: options.talkingPhotoId,
    talking_style: "expressive" as const,
    expression: "happy" as const,
  };

  const voicePayload: Record<string, unknown> = {
    type: "text",
    input_text: script,
    voice_id: voiceId,
  };
  if (options.voiceEmotion) voicePayload.emotion = options.voiceEmotion;

  const createRes = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character,
          voice: voicePayload,
          background: options.backgroundPreset ? HEYGEN_BACKGROUND_PRESETS[options.backgroundPreset] : HEYGEN_BACKGROUND_PRESETS.office,
        },
      ],
      dimension,
      caption: options.caption ?? true,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("[heygen] talking photo video create failed:", createRes.status, err);
    throw new Error(`HeyGen create video failed: ${createRes.status} ${err}`);
  }

  const createRaw = (await createRes.json()) as Record<string, unknown>;
  const createData = createRaw.data as Record<string, unknown> | undefined;
  const videoId = (createData?.video_id ?? createRaw.video_id) as string | undefined;
  if (!videoId || typeof videoId !== "string") {
    console.error("[heygen] talking photo create response missing video_id:", JSON.stringify(createRaw).slice(0, 400));
    throw new Error("HeyGen did not return a video_id.");
  }

  return pollVideoStatus(videoId, apiKey);
}
