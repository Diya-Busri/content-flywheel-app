/**
 * Use proxy URL for external background images so editor canvas and PDF export (html2canvas)
 * don't hit CORS. Data URLs and same-origin URLs are returned as-is.
 *
 * Set NEXT_PUBLIC_USE_DIRECT_IMAGE_URLS=1 to bypass the proxy and use Pexels/Unsplash URLs
 * directly (for testing if the proxy is the cause of broken images).
 */
const PROXY_PATH = "/api/proxy-image";

const DIRECT_ORIGINS = [
  "images.pexels.com",
  "www.pexels.com",
  "pexels.com",
  "images.unsplash.com",
  "unsplash.com",
];

function isDirectAllowedOrigin(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DIRECT_ORIGINS.some((o) => host === o || host.endsWith("." + o));
  } catch {
    return false;
  }
}

/** When true, use Pexels/Unsplash URL directly instead of proxy (for testing). */
function useDirectImageUrls(): boolean {
  const v = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_USE_DIRECT_IMAGE_URLS : undefined;
  if (v == null || typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function getProxiedBackgroundImageUrl(url: string | null | undefined): string | null {
  const u =
    typeof url === "string"
      ? url.trim()
      : "";
  if (!u) return null;
  if (
    u.startsWith("data:") ||
    (u.startsWith("/") && !u.startsWith("//"))
  ) {
    return u;
  }
  // Bypass proxy for testing: use Pexels/Unsplash URL directly
  if (u.startsWith("http://") || u.startsWith("https://")) {
    if (useDirectImageUrls() && isDirectAllowedOrigin(u)) return u;
    return `${PROXY_PATH}?url=${encodeURIComponent(u)}&format=raw`;
  }
  // Already proxied URL: when testing direct URLs, extract target and return it if allowed
  if (u.startsWith(PROXY_PATH)) {
    try {
      const parsed = new URL(u, "https://dummy");
      const target = parsed.searchParams.get("url");
      if (useDirectImageUrls() && target && isDirectAllowedOrigin(target)) return target;
    } catch {
      // ignore
    }
    const sep = u.includes("?") ? "&" : "?";
    return u.includes("format=") ? u : `${u}${sep}format=raw`;
  }
  return u;
}

/** Proxy URL for storage (no format=raw). PDF export fetches this to get base64 data URL. */
function getProxyUrlForStorage(url: string): string {
  const u = url.trim();
  if (u.startsWith("data:") || (u.startsWith("/") && !u.startsWith("//"))) return u;
  if (u.startsWith("http://") || u.startsWith("https://"))
    return `${PROXY_PATH}?url=${encodeURIComponent(u)}`;
  if (u.startsWith(PROXY_PATH)) {
    const withoutFormat = u.replace(/[?&]format=raw&?|[?&]format=raw$/i, "").replace(/\?&/, "?").replace(/\?$/, "");
    return withoutFormat || u;
  }
  return u;
}

/** When saving a background image URL to the product, use proxy for external URLs (no format=raw so export can get base64). */
export function getBackgroundUrlToSave(url: string | null | undefined): string | null {
  const u =
    typeof url === "string"
      ? url.trim()
      : "";
  if (!u) return null;
  return getProxyUrlForStorage(u);
}
