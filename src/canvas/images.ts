// Image loading for the renderer. Draw calls are synchronous, so images are
// requested once, cached by URL, and the canvas is asked to repaint when one
// finishes — never awaited inside a frame.

type Entry = { image: HTMLImageElement; loaded: boolean; failed: boolean };

const cache = new Map<string, Entry>();

export function getImage(src: string, onLoad: () => void): Entry | null {
  if (!src) return null;
  const hit = cache.get(src);
  if (hit) return hit;

  const image = new Image();
  image.crossOrigin = "anonymous";
  const entry: Entry = { image, loaded: false, failed: false };
  image.onload = () => {
    entry.loaded = true;
    onLoad();
  };
  image.onerror = () => {
    entry.failed = true;
    onLoad();
  };
  image.src = src;
  cache.set(src, entry);
  return entry;
}

/** Cover-fit: fills the box, cropping the overflowing axis. */
export function coverRect(
  natural: { w: number; h: number },
  box: { x: number; y: number; w: number; h: number },
) {
  const scale = Math.max(box.w / natural.w, box.h / natural.h);
  const w = natural.w * scale;
  const h = natural.h * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
