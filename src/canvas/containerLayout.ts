import type { Rect } from "@/canvas/types";

// Folder and document cards share one silhouette — tile/sheet on top, name
// and a meta line underneath — so they share this layout math too. Kept
// separate from renderer.ts so the editor's rename-click hit-test can use the
// exact same numbers without importing drawing code.

export function containerTileHeight(item: { h: number }): number {
  return Math.max(24, item.h - 44);
}

/** The folder tile itself — not the label or meta line below it. Used for
 *  both drawing and the selection outline, so it wraps the visible card
 *  instead of the whole item box (which reserves 44px underneath for the
 *  label). */
export function containerTileRect(item: { x: number; y: number; w: number; h: number }): Rect {
  return { x: item.x + item.w * 0.14, y: item.y, w: item.w * 0.72, h: containerTileHeight(item) };
}

/** The document's sheet itself — same idea as `containerTileRect`, but the
 *  sheet's width is derived from its own height (a fixed page aspect ratio)
 *  and centred, rather than a fixed fraction of the item's width. */
export function documentSheetRect(item: { x: number; y: number; w: number; h: number }): Rect {
  const h = containerTileHeight(item);
  const w = h * 0.78;
  return { x: item.x + (item.w - w) / 2, y: item.y, w, h };
}

/** The name label's clickable/editable bounds — not the meta line below it. */
export function containerLabelRect(item: { x: number; y: number; w: number; h: number }): Rect {
  const tileH = containerTileHeight(item);
  return { x: item.x, y: item.y + tileH + 6, w: item.w, h: 18 };
}
