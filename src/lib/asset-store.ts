import type { TLAssetStore } from "tldraw";

// Shared raw upload used both by tldraw's asset store (images/video, below)
// and by the Milanote-style "Upload" rail button for arbitrary file types
// (which builds its own "file" shape instead of an image/video asset).
export async function uploadRawFile(file: File, abortSignal?: AbortSignal) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    signal: abortSignal,
  });

  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }

  const data = await res.json();
  return { src: data.src as string };
}

// Uploads images/files to MinIO via /api/upload instead of tldraw's default
// inline-base64 fallback, so large assets don't bloat every synced snapshot.
export const minioAssetStore: TLAssetStore = {
  async upload(_asset, file, abortSignal) {
    return uploadRawFile(file, abortSignal);
  },
};
