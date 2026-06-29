/** Client-side upload helper using XMLHttpRequest so we get progress events. */

export function uploadFile(
  file: File,
  bucket: "academy-videos" | "academy-images" | "academy-downloads" | "academy-community",
  folder: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", bucket);
    fd.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/academy/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.url) {
          resolve({ url: res.url });
        } else {
          reject(new Error(res.error || "Upload failed"));
        }
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(fd);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
