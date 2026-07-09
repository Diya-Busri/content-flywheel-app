/** Block-based lesson content model for the Academy lesson editor + viewer. */

export type BlockType =
  | "heading"
  | "text"
  | "video"
  | "image"
  | "download"
  | "checklist"
  | "divider"
  | "callout"
  | "button";

export interface Block {
  id: string;
  type: BlockType;
  // heading
  content?: string;
  level?: 1 | 2 | 3;
  // text uses `content`
  // video
  videoUrl?: string; // Supabase storage URL or YouTube URL
  videoType?: "upload" | "youtube";
  // image
  imageUrl?: string;
  imageAlt?: string;
  // download
  downloadUrl?: string;
  downloadLabel?: string;
  fileType?: string;
  // checklist
  items?: string[];
  // callout
  calloutType?: "info" | "warning" | "success" | "tip";
  // button
  buttonLabel?: string;
  buttonUrl?: string;
  // divider has no extra fields
}

export function generateBlockId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Parse a lesson's stored `content` field into a Block array.
 * Backwards-compatible: if `content` is not valid block JSON (old plain text
 * or markdown), it is wrapped in a single text block.
 */
export function parseLessonBlocks(content: string | null | undefined): Block[] {
  if (!content || !content.trim()) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.every((b) => b && typeof b === "object" && "type" in b)) {
      return parsed as Block[];
    }
  } catch {
    // not JSON — fall through to plain-text fallback
  }
  return [{ id: generateBlockId(), type: "text", content }];
}

export function serializeLessonBlocks(blocks: Block[]): string {
  return JSON.stringify(blocks);
}

export function newBlock(type: BlockType): Block {
  const base: Block = { id: generateBlockId(), type };
  switch (type) {
    case "heading":
      return { ...base, content: "", level: 2 };
    case "text":
      return { ...base, content: "" };
    case "video":
      return { ...base, videoUrl: "", videoType: "upload" };
    case "image":
      return { ...base, imageUrl: "", imageAlt: "" };
    case "download":
      return { ...base, downloadUrl: "", downloadLabel: "" };
    case "checklist":
      return { ...base, items: [""] };
    case "callout":
      return { ...base, calloutType: "info", content: "" };
    case "button":
      return { ...base, buttonLabel: "", buttonUrl: "" };
    case "divider":
    default:
      return base;
  }
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  video: "Video",
  image: "Image",
  download: "Download",
  checklist: "Checklist",
  divider: "Divider",
  callout: "Callout",
  button: "Button",
};
