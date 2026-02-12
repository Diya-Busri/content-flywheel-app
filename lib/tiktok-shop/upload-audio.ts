import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Use same bucket as lib/elevenlabs.ts so one Storage bucket covers all voiceovers. */
const BUCKET = "voiceovers";

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * Ensure the "voiceovers" bucket exists in Supabase Dashboard → Storage and is public if needed.
 */
export async function uploadAudioToSupabase(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("Supabase not configured (set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
  }

  try {
    const { data, error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("[upload-audio] Supabase upload error:", error);
      throw new Error(
        "Failed to upload audio: " +
          (error.message ?? "unknown") +
          ". Create a Storage bucket named 'voiceovers' in Supabase if it doesn't exist."
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("network")) {
      console.error("[upload-audio] Supabase unreachable:", err);
      throw new Error(
        "Audio upload failed: Supabase is unreachable. Check NEXT_PUBLIC_SUPABASE_URL and network, or try again later."
      );
    }
    throw err;
  }
}
