/**
 * Instagram Graph API (Instagram Login) — carousel publish.
 * @see https://developers.facebook.com/docs/instagram-platform/content-publishing
 */

const GRAPH = "https://graph.instagram.com/v21.0";

export type MediaStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED" | string;

async function postForm(path: string, params: Record<string, string>): Promise<{ id?: string; error?: { message?: string } }> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.json().catch(() => ({}));
}

async function getJson(path: string): Promise<{ status_code?: MediaStatus; id?: string; error?: { message?: string } }> {
  const res = await fetch(`${GRAPH}${path}`);
  return res.json().catch(() => ({}));
}

export async function waitForMediaContainerReady(
  creationId: string,
  accessToken: string,
  opts?: { maxAttempts?: number; delayMs?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const delayMs = opts?.delayMs ?? 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const q = new URLSearchParams({
      fields: "status_code",
      access_token: accessToken,
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
 * Publish one image or a carousel (2–10 images) to an Instagram professional account.
 */
export async function publishInstagramCarousel(params: {
  igUserId: string;
  accessToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<{ mediaId?: string; error: string | null }> {
  const { igUserId, accessToken, caption } = params;
  const imageUrls = params.imageUrls.filter(Boolean).slice(0, 10);

  if (imageUrls.length === 0) {
    return { error: "At least one image URL is required" };
  }

  if (caption.length > 2200) {
    return { error: "Caption exceeds Instagram 2200 character limit" };
  }

  const tokenParam = { access_token: accessToken };

  if (imageUrls.length === 1) {
    const created = await postForm(`/${igUserId}/media`, {
      ...tokenParam,
      image_url: imageUrls[0],
      caption,
    });
    if (!created.id) {
      return { error: created.error?.message || "Failed to create media container" };
    }
    const ready = await waitForMediaContainerReady(created.id, accessToken);
    if (!ready.ok) return { error: ready.error };

    const pub = await postForm(`/${igUserId}/media_publish`, {
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
    const child = await postForm(`/${igUserId}/media`, {
      ...tokenParam,
      image_url: imageUrl,
      is_carousel_item: "true",
    });
    if (!child.id) {
      return { error: child.error?.message || "Failed to create carousel item" };
    }
    const ready = await waitForMediaContainerReady(child.id, accessToken);
    if (!ready.ok) return { error: ready.error };
    childIds.push(child.id);
  }

  const carousel = await postForm(`/${igUserId}/media`, {
    ...tokenParam,
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
  });
  if (!carousel.id) {
    return { error: carousel.error?.message || "Failed to create carousel container" };
  }
  const carouselReady = await waitForMediaContainerReady(carousel.id, accessToken);
  if (!carouselReady.ok) return { error: carouselReady.error };

  const pub = await postForm(`/${igUserId}/media_publish`, {
    ...tokenParam,
    creation_id: carousel.id,
  });
  if (!pub.id) {
    return { error: pub.error?.message || "Failed to publish carousel" };
  }
  return { mediaId: pub.id, error: null };
}
