import type { TLAssetStore } from "tldraw";

// Uploads images/files to MinIO via /api/upload instead of tldraw's default
// inline-base64 fallback, so large assets don't bloat every synced snapshot.
export const minioAssetStore: TLAssetStore = {
  async upload(_asset, file, abortSignal) {
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
  },
};
