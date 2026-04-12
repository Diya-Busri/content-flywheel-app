import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/rate-limit-api";
import { db } from "@/db/db";
import { videosTable } from "@/db/schema/library-schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

const SCENE_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#6366F1",
  "#EC4899",
];

type TimelineScene = {
  id: string;
  title: string;
  duration: number;
  color: string;
  startTime: number;
  elements: Array<{ id: string; type: "background"; media: { type: "image"; url: string } | null }>;
};

type TimelineCaption = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
};

function isRenderableTimelineScene(raw: unknown): raw is TimelineScene {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  return typeof s.duration === "number" && s.duration > 0 && Array.isArray(s.elements);
}

function migrateScenesFromLegacy(rawScenes: unknown[], prefix: string): { scenes: TimelineScene[]; captions: TimelineCaption[]; totalDuration: number } {
  const fallbackDuration = 12;
  let runStart = 0;
  const scenes: TimelineScene[] = [];
  const captions: TimelineCaption[] = [];

  rawScenes.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const node = raw as Record<string, unknown>;
    const caption =
      typeof node.caption === "string"
        ? node.caption.trim()
        : typeof node.title === "string"
          ? node.title.trim()
          : "";
    const duration =
      typeof node.duration === "number" && Number.isFinite(node.duration) && node.duration > 0
        ? node.duration
        : fallbackDuration;
    const id = typeof node.id === "string" && node.id.trim() ? node.id : `${prefix}-${idx + 1}`;
    const startTime =
      typeof node.startTime === "number" && Number.isFinite(node.startTime) && node.startTime >= 0
        ? node.startTime
        : runStart;
    scenes.push({
      id,
      title: (caption || `Scene ${idx + 1}`).slice(0, 80),
      duration,
      color: SCENE_COLORS[idx % SCENE_COLORS.length] ?? "#3B82F6",
      startTime,
      elements: [{
        id: `${id}-bg`,
        type: "background",
        media: {
          type: "image",
          url: renderStickmanSceneDataUrl({
            caption,
            pose: typeof node.pose === "string" ? node.pose : undefined,
            keyObject: typeof node.keyObject === "string" ? node.keyObject : undefined,
            layout: typeof node.layout === "string" ? node.layout : undefined,
          }),
        },
      }],
    });
    if (caption) {
      captions.push({
        id: `cap-${prefix}-${idx + 1}`,
        text: caption,
        startTime,
        endTime: startTime + duration,
      });
    }
    runStart = startTime + duration;
  });

  return {
    scenes,
    captions,
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
  };
}

function renderStickmanSceneDataUrl(input: { caption: string; pose?: string; keyObject?: string; layout?: string }): string {
  const text = (input.caption || "").slice(0, 210).replace(/[<>&"]/g, "");
  const left = input.layout === "right-presenter" ? 900 : input.layout === "center-presenter" ? 640 : 460;
  const pose = input.pose ?? "standing";
  const armY = pose === "pointing" ? 468 : pose === "celebrating" ? 410 : 452;
  const icon = input.keyObject === "money" ? "$" : input.keyObject === "warning" ? "!" : input.keyObject === "clock" ? "O" : input.keyObject === "chart" ? "/" : "*";
  const dots: string[] = [];
  for (let y = 28; y <= 690; y += 28) {
    for (let x = 28; x <= 1250; x += 28) {
      dots.push(`<circle cx="${x}" cy="${y}" r="1.6" fill="#d8cfb5" opacity="0.38" />`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#FFFEF8"/>
  ${dots.join("")}
  <rect x="0" y="0" width="1280" height="10" fill="#F59E0B"/>
  <rect x="80" y="85" width="720" height="170" rx="16" fill="#f8e8d8" opacity="0.85"/>
  <text x="110" y="150" font-family="Caveat, Arial, sans-serif" font-size="58" font-weight="700" fill="#b45309">In a world obsessed with personal branding...</text>
  <text x="110" y="215" font-family="Caveat, Arial, sans-serif" font-size="46" fill="#111827">${text}</text>
  <line x1="80" y1="505" x2="1200" y2="505" stroke="#8f8f8f" stroke-width="14" stroke-linecap="round" opacity="0.6"/>
  <circle cx="${left}" cy="360" r="26" fill="none" stroke="#1f2937" stroke-width="8"/>
  <line x1="${left}" y1="386" x2="${left}" y2="468" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="420" x2="${left - 58}" y2="${armY}" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="420" x2="${left + 82}" y2="${armY}" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="468" x2="${left - 45}" y2="548" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <line x1="${left}" y1="468" x2="${left + 45}" y2="548" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <rect x="${left + 95}" y="322" width="195" height="140" rx="10" fill="none" stroke="#111827" stroke-width="6"/>
  <line x1="${left + 120}" y1="430" x2="${left + 260}" y2="430" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 120}" y1="430" x2="${left + 120}" y2="350" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 132}" y1="416" x2="${left + 170}" y2="385" stroke="#111827" stroke-width="5"/>
  <line x1="${left + 170}" y1="385" x2="${left + 230}" y2="350" stroke="#111827" stroke-width="5"/>
  <circle cx="${left + 250}" cy="392" r="14" fill="#f97316"/>
  <text x="${left + 248}" y="368" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#f59e0b">${icon}</text>
  <text x="1135" y="662" font-family="Caveat, Arial, sans-serif" font-size="34" fill="#b45309">1 / 39</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeTimelineMetadata(metadata: unknown): { metadata: Record<string, unknown>; changed: boolean } {
  if (!metadata || typeof metadata !== "object") return { metadata: {}, changed: false };
  const current = metadata as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  let changed = false;

  const scenes = Array.isArray(current.scenes) ? current.scenes : [];
  const sourceType = typeof current.sourceType === "string" ? current.sourceType : "";
  const stickmanScenes = Array.isArray(current.stickmanScenes) ? current.stickmanScenes : [];
  const caps = Array.isArray(current.captions) ? current.captions : [];
  const validCaps = caps
    .map((c, i) => {
      const row = (c ?? {}) as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      const startTime = typeof row.startTime === "number" ? row.startTime : 0;
      const endTime = typeof row.endTime === "number" ? row.endTime : 0;
      if (!text || endTime <= startTime) return null;
      return {
        id: typeof row.id === "string" ? row.id : `cap-${i + 1}`,
        text,
        startTime,
        endTime,
      };
    })
    .filter((c): c is TimelineCaption => c !== null);

  if (sourceType === "stickman-whiteboard" && stickmanScenes.length > 0) {
    const migrated = migrateScenesFromLegacy(stickmanScenes, "stickman-migrated");
    if (migrated.scenes.length > 0) {
      next.scenes = migrated.scenes;
      next.captions = validCaps.length > 0 ? validCaps : migrated.captions;
      next.totalDuration = migrated.totalDuration;
      next.aspectRatio = "16:9";
      changed = true;
    }
  } else if (scenes.length > 0) {
    const allRenderable = scenes.every(isRenderableTimelineScene);
    if (!allRenderable) {
      const migrated = migrateScenesFromLegacy(scenes, "scene-migrated");
      if (migrated.scenes.length > 0) {
        next.scenes = migrated.scenes;
        if (validCaps.length > 0) {
          next.captions = validCaps;
        } else {
          next.captions = migrated.captions;
        }
        next.totalDuration = migrated.totalDuration;
        changed = true;
      }
    } else {
      // Finance Documentary and Story Video are always 16:9
      const isFinanceOrStory = sourceType === "finance-documentary" || sourceType === "story-video";
      // Legacy projects saved before sourceType was set correctly:
      // Finance docs saved as "ai-story" but have 100+ scenes (Finance Doc standard is 150)
      const isLikelyFinanceDoc = scenes.length >= 100;
      if (isFinanceOrStory || isLikelyFinanceDoc) {
        if (current.aspectRatio !== "16:9") {
          next.aspectRatio = "16:9";
          changed = true;
        }
        if (isLikelyFinanceDoc && sourceType !== "finance-documentary") {
          next.sourceType = "finance-documentary";
          changed = true;
        }
      }
      if (sourceType === "stickman-whiteboard") {
        if (current.aspectRatio !== "16:9") {
          next.aspectRatio = "16:9";
          changed = true;
        }
        const withMedia = (scenes as Record<string, unknown>[]).map((raw, idx) => {
          const s = raw as Record<string, unknown>;
          const id = typeof s.id === "string" ? s.id : `scene-${idx + 1}`;
          const title = typeof s.title === "string" ? s.title : "";
          const captionFromLegacy =
            Array.isArray(current.stickmanScenes) && current.stickmanScenes[idx] && typeof current.stickmanScenes[idx] === "object"
              ? (current.stickmanScenes[idx] as { caption?: unknown }).caption
              : undefined;
          const text = typeof captionFromLegacy === "string" ? captionFromLegacy : title;
          const currentElements = Array.isArray(s.elements) ? s.elements : [];
          const first = (currentElements[0] ?? null) as Record<string, unknown> | null;
          const firstMedia = first && typeof first === "object" ? first.media : null;
          if (firstMedia && typeof firstMedia === "object" && typeof (firstMedia as { url?: unknown }).url === "string") {
            return raw;
          }
          const bgEl = {
            id: `${id}-bg`,
            type: "background",
            media: {
              type: "image",
              url: renderStickmanSceneDataUrl({ caption: typeof text === "string" ? text : "" }),
            },
          };
          return { ...s, elements: [bgEl, ...currentElements.slice(1)] };
        });
        next.scenes = withMedia;
        changed = true;
      }
      if (validCaps.length !== caps.length) {
        next.captions = validCaps;
        changed = true;
      }
    }
  } else {
    if (stickmanScenes.length > 0) {
      const migrated = migrateScenesFromLegacy(stickmanScenes, "stickman-migrated");
      if (migrated.scenes.length > 0) {
        next.scenes = migrated.scenes;
        next.captions = validCaps.length > 0 ? validCaps : migrated.captions;
        next.totalDuration = migrated.totalDuration;
        next.aspectRatio = "16:9";
        if (typeof next.sourceType !== "string") next.sourceType = "stickman-whiteboard";
        changed = true;
      }
    }
  }

  return { metadata: next, changed };
}

/**
 * GET: Fetch a single video by id (for loading timeline project).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video id required" }, { status: 400 });

    const [row] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    const normalized = normalizeTimelineMetadata(row.metadata);
    if (normalized.changed) {
      try {
        await db
          .update(videosTable)
          .set({ metadata: normalized.metadata, updatedAt: new Date() } as Record<string, unknown>)
          .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)));
      } catch (e) {
        console.error("[video-timeline/videos GET normalize persist]", e);
      }
    }

    return NextResponse.json({
      id: row.id,
      title: row.title,
      status: row.status,
      scriptId: row.scriptId,
      metadata: normalized.metadata,
      platforms: row.platforms,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("[video-timeline/videos GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load video" },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update a video (e.g. set status to 'completed' and exportedAt after export).
 * Body: { status?: string, title?: string, metadata?: Record<string, unknown> }.
 * Merges metadata.exportedAt when provided.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Video id required" }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "JSON body required" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status : undefined;
    const metadataUpdate = body.metadata && typeof body.metadata === "object" ? body.metadata : undefined;
    const titleUpdate = typeof body.title === "string" && body.title.trim() ? body.title.trim() : undefined;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (titleUpdate) updates.title = titleUpdate.slice(0, 500);
    if (metadataUpdate) {
      const [current] = await db
        .select({ metadata: videosTable.metadata })
        .from(videosTable)
        .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
        .limit(1);
      const merged =
        current?.metadata && typeof current.metadata === "object"
          ? { ...current.metadata, ...metadataUpdate }
          : metadataUpdate;
      updates.metadata = merged;
    }

    const [row] = await db
      .update(videosTable)
      .set(updates as Record<string, unknown>)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, userId)))
      .returning({ id: videosTable.id, status: videosTable.status });

    if (!row) return NextResponse.json({ error: "Video not found" }, { status: 404 });

    return NextResponse.json({ id: row.id, status: row.status });
  } catch (err) {
    console.error("[video-timeline/videos PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
