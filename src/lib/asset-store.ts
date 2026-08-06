// Uploads a file to MinIO via /api/upload and returns its public URL. Used by
// the Bild and Datei rail buttons; the canvas stores only the URL, so a board
// document stays small no matter how many assets it references.
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
