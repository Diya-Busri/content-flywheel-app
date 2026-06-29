/** Shared Academy helpers (safe to import from client or server). */

/** Extract a YouTube video ID from common URL formats. Returns null if not found. */
export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function youTubeEmbedUrl(url: string | null | undefined): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export const ACADEMY_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "questions", label: "Questions" },
  { id: "wins", label: "Wins" },
  { id: "feedback", label: "Feedback" },
  { id: "product_showcase", label: "Product Showcase" },
  { id: "marketing", label: "Marketing" },
  { id: "general", label: "General" },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  questions: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  wins: "bg-green-500/15 text-green-500 border-green-500/30",
  feedback: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  product_showcase: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  marketing: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  general: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  admin: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-green-500/15 text-green-500 border-green-500/30",
  intermediate: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  advanced: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function categoryLabel(id: string): string {
  return ACADEMY_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, " ");
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
