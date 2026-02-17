/**
 * Platform constants for multi-platform Video Creation Guide.
 * Primary content type determines what we generate (video vs thread/post/pins).
 */

export const VIDEO_GUIDE_PLATFORMS = [
  { id: "tiktok", label: "TikTok", contentType: "Short Video", aspect: "9:16", duration: "15-60s", note: "Fast cuts, trending sounds, hook in 1s" },
  { id: "instagram_reels", label: "Instagram", contentType: "Reels + Carousels", aspect: "9:16", duration: "15-30s", note: "Reels, carousels, stories" },
  { id: "youtube_shorts", label: "YouTube Shorts", contentType: "Short Video", aspect: "9:16", duration: "Under 60s", note: "Subscribe CTA, SEO title" },
  { id: "youtube_longform", label: "YouTube", contentType: "Long Video", aspect: "16:9", duration: "3-10 min", note: "Tutorial/review, thumbnail critical" },
  { id: "facebook_reels", label: "Facebook", contentType: "Reels + Group Posts", aspect: "9:16", duration: "15-30s", note: "Reels + Groups, Marketplace" },
  { id: "pinterest_video", label: "Pinterest", contentType: "Pins + Idea Pins", aspect: "9:16 or 2:3", duration: "15-30s", note: "Static pins, SEO, evergreen" },
  { id: "linkedin_video", label: "LinkedIn", contentType: "Text Posts + Images", aspect: "16:9 or 1:1", duration: "30-90s", note: "Posts, carousels, professional" },
  { id: "x_video", label: "X (Twitter)", contentType: "Threads + Tweets", aspect: "16:9 or 1:1", duration: "N/A", note: "Text threads, not video-first" },
] as const;

export type VideoGuidePlatformId = (typeof VIDEO_GUIDE_PLATFORMS)[number]["id"];
