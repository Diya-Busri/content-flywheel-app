import { existsSync } from "fs";
import { join } from "path";
import { BGM_TRACKS, type BgmSelectValue } from "@/lib/bgm-tracks";

/** Absolute path to bundled MP3 in public/bgm/, or null if missing / "none". */
export function resolveLocalBgmPath(trackId: BgmSelectValue): string | null {
  if (trackId === "none") return null;
  const row = BGM_TRACKS.find((t) => t.id === trackId);
  if (!row?.filename) return null;
  const p = join(process.cwd(), "public", "bgm", row.filename);
  return existsSync(p) ? p : null;
}
