/**
 * Use proxy URL for external background images so editor canvas and PDF export (html2canvas)
 * don't hit CORS. Data URLs and same-origin URLs are returned as-is.
 */
const PROXY_PATH = "/api/proxy-image";

export function getProxiedBackgroundImageUrl(url: string | null | undefined): string | null {
  const u =
    typeof url === "string"
      ? url.trim()
      : "";
  if (!u) return null;
  if (
    u.startsWith("data:") ||
    u.startsWith("/api/proxy-image") ||
    (u.startsWith("/") && !u.startsWith("//"))
  ) {
    return u;
  }
  if (u.startsWith("http://") || u.startsWith("https://")) {
    return `${PROXY_PATH}?url=${encodeURIComponent(u)}&format=raw`;
  }
  // Already proxied URL (no format): add format=raw so <img> gets binary and displays
  if (u.startsWith(PROXY_PATH)) {
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
