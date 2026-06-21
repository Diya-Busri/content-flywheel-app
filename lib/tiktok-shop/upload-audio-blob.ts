import { upload } from "@/lib/storage";

const PREFIX = "voiceovers";

/** Upload voiceover audio to R2 and return the public URL. */
export async function uploadAudioToBlob(
  buffer: Buffer,
  contentType: string,
  key: string
): Promise<string> {
  const pathname = key.startsWith(PREFIX) ? key : `${PREFIX}/${key}`;
  const blob = await upload(pathname, buffer, {
    access: "public",
    contentType: contentType || "audio/mpeg",
    addRandomSuffix: true,
  });
  return blob.url;
}
