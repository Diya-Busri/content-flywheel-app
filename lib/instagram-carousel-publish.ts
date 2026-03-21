/**
 * Instagram Graph API (Facebook Graph) — carousel publish.
 * Uses graph.facebook.com with Page Access Token + Instagram Business Account id from /me/accounts.
 *
 * @see https://developers.facebook.com/docs/instagram-api/content-publishing
 */

const FB_GRAPH = "https://graph.facebook.com/v21.0";

export type MediaStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED" | string;

function logStep(label: string, payload: unknown) {
  try {
    console.log(`[instagram-carousel-publish] ${label}:`, JSON.stringify(payload, null, 2));
  } catch {
    console.log(`[instagram-carousel-publish] ${label}:`, payload);
  }
}

async function postForm(
  path: string,
  params: Record<string, string>
): Promise<{ id?: string; error?: { message?: string; type?: string; code?: number } }> {
  const body = new URLSearchParams(params);
  const url = `${FB_GRAPH}${path}`;
  logStep("POST request", { path, params: { ...params, access_token: "[REDACTED]" } });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  logStep("POST response raw", { path, status: res.status, statusText: res.statusText, body: text.slice(0, 4000) });
  try {
    return text ? (JSON.parse(text) as { id?: string; error?: { message?: string } }) : {};
  } catch {
    return { error: { message: `Invalid JSON: ${text.slice(0, 200)}` } };
  }
}

async function getJson(
  path: string
): Promise<{ status_code?: MediaStatus; id?: string; error?: { message?: string } }> {
  const url = `${FB_GRAPH}${path}`;
  logStep("GET request", { path });
  const res = await fetch(url);
  const text = await res.text();
  logStep("GET response raw", { path, status: res.status, body: text.slice(0, 4000) });
  try {
    return text ? (JSON.parse(text) as { status_code?: MediaStatus; error?: { message?: string } }) : {};
  } catch {
    return {};
  }
}

export async function waitForMediaContainerReady(
  creationId: string,
  pageAccessToken: string,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const delayMs = opts?.delayMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const q = new URLSearchParams({
      fields: "status_code,status",
      access_token: pageAccessToken,
    });
    const data = await getJson(`/${creationId}?${q.toString()}`);
    const code = data.status_code;
    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR" || code === "EXPIRED") {
      return { ok: false, error: data.error?.message || `Container status: ${code}` };
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { ok: false, error: "Timed out waiting for Instagram media to process" };
}

/**
 * Publish one image or a carousel (2–10 images) using IG Business Account id + Page access token.
 */
export async function publishInstagramCarousel(params: {
  igBusinessAccountId: string;
  pageAccessToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<{ mediaId?: string; error: string | null }> {
  const { igBusinessAccountId, pageAccessToken, caption } = params;
  const imageUrls = params.imageUrls.filter(Boolean).slice(0, 10);

  if (imageUrls.length === 0) {
    return { error: "At least one image URL is required" };
  }

  if (caption.length > 2200) {
    return { error: "Caption exceeds Instagram 2200 character limit" };
  }

  const tokenParam = { access_token: pageAccessToken };

  if (imageUrls.length === 1) {
    const created = await postForm(`/${igBusinessAccountId}/media`, {
      ...tokenParam,
      image_url: imageUrls[0],
      caption,
    });
    if (!created.id) {
      return { error: created.error?.message || "Failed to create media container" };
    }
    const ready = await waitForMediaContainerReady(created.id, pageAccessToken);
    if (!ready.ok) return { error: ready.error };

    const pub = await postForm(`/${igBusinessAccountId}/media_publish`, {
      ...tokenParam,
      creation_id: created.id,
    });
    if (!pub.id) {
      return { error: pub.error?.message || "Failed to publish media" };
    }
    return { mediaId: pub.id, error: null };
  }

  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const child = await postForm(`/${igBusinessAccountId}/media`, {
      ...tokenParam,
      image_url: imageUrl,
      is_carousel_item: "true",
    });
    if (!child.id) {
      return { error: child.error?.message || "Failed to create carousel item" };
    }
    const ready = await waitForMediaContainerReady(child.id, pageAccessToken);
    if (!ready.ok) return { error: ready.error };
    childIds.push(child.id);
  }

  const carousel = await postForm(`/${igBusinessAccountId}/media`, {
    ...tokenParam,
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  if (!carousel.id) {
    return { error: carousel.error?.message || "Failed to create carousel container" };
  }
  const carouselReady = await waitForMediaContainerReady(carousel.id, pageAccessToken);
  if (!carouselReady.ok) return { error: carouselReady.error };

  const pub = await postForm(`/${igBusinessAccountId}/media_publish`, {
    ...tokenParam,
    creation_id: carousel.id,
  });
  if (!pub.id) {
    return { error: pub.error?.message || "Failed to publish carousel" };
  }
  return { mediaId: pub.id, error: null };
}
