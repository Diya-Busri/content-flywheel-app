import { getSupabaseAdmin } from "@/lib/supabase/server";

/** Bucket name: use env or default. Must exist in Supabase Storage and be public for getPublicUrl to work. */
const BUCKET = process.env.SUPABASE_VOICEOVERS_BUCKET ?? "tiktok-audio";

/**
 * Upload a buffer to Supabase Storage and return the public URL.
 * Requirements:
 * - NEXT_PUBLIC_SUPABASE_URL = your project URL (https://xxxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY = service_role key from Project Settings → API
 * - A Storage bucket named "voiceovers" (or SUPABASE_VOICEOVERS_BUCKET), set to Public so the URL is accessible.
 */
export async function uploadAudioToSupabase(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error(
      "Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL (https://your-project.supabase.co) and SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role)."
    );
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
          ". Ensure the Storage bucket '" +
          BUCKET +
          "' exists in Supabase and is Public (or has a policy allowing uploads and public read)."
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
      console.error("[upload-audio] Supabase unreachable:", err);
      throw new Error(
        "Audio upload failed: Supabase is unreachable. Check NEXT_PUBLIC_SUPABASE_URL is https://your-project.supabase.co and SUPABASE_SERVICE_ROLE_KEY is correct. If using local dev, video generation will fall back to temporary audio."
      );
    }
    throw err;
  }
}
