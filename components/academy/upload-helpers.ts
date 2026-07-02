/**
 * Client-side upload helper.
 *
 * Flow:
 *  1. POST /api/academy/upload/presigned  →  get a Supabase signed upload URL (tiny JSON request, no file bytes)
 *  2. PUT {signedUrl} with the raw file   →  browser uploads directly to Supabase (no Vercel body-size limit)
 *  3. Resolve with the public URL
 *
 * This bypasses Vercel's 4.5 MB serverless request-body limit entirely.
 */

export function uploadFile(
  file: File,
  bucket: "academy-videos" | "academy-images" | "academy-downloads" | "academy-community",
  folder: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    // Step 1 — ask the server for a presigned upload URL (small JSON request)
    fetch("/api/academy/upload/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket,
        folder,
        filename: file.name || "file",
        contentType: file.type || "application/octet-stream",
      }),
    })
      .then((r) => r.json())
      .then(({ signedUrl, publicUrl, error }) => {
        if (!signedUrl) {
          reject(new Error(error || "Failed to get upload URL"));
          return;
        }

        // Step 2 — upload the file directly from the browser to Supabase
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        );

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ url: publicUrl });
          } else {
            reject(new Error(`Upload failed (HTTP ${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      })
      .catch((e) =>
        reject(e instanceof Error ? e : new Error("Upload failed"))
      );
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
