import type { Rect } from "@/canvas/types";

// Folder and document cards share one silhouette — tile/sheet on top, name
// and a meta line underneath — so they share this layout math too. Kept
// separate from renderer.ts so the editor's rename-click hit-test can use the
// exact same numbers without importing drawing code.

export function containerTileHeight(item: { h: number }): number {
  return Math.max(24, item.h - 44);
}

/** The name label's clickable/editable bounds — not the meta line below it. */
export function containerLabelRect(item: { x: number; y: number; w: number; h: number }): Rect {
  const tileH = containerTileHeight(item);
  return { x: item.x, y: item.y + tileH + 6, w: item.w, h: 18 };
}
