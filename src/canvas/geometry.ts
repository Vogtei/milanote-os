import type { AnyItem, Rect, Vec } from "@/canvas/types";

export function itemBounds(item: AnyItem): Rect {
  return { x: item.x, y: item.y, w: item.w, h: item.h };
}

export function rectContains(rect: Rect, point: Vec): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/** Axis-aligned union. Returns a zero rect for an empty list, not null, so
 *  callers don't have to branch before doing arithmetic. */
export function unionBounds(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfPoints(points: Vec[]): Rect {
  return unionBounds(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}

export function normalizeRect(a: Vec, b: Vec): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from `p` to segment `a`–`b`; used to hit-test strokes
 *  and arrows, which have no meaningful interior. */
export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: HandleId[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** Handle centre in world space. */
export function handlePoint(bounds: Rect, handle: HandleId): Vec {
  const { x, y, w, h } = bounds;
  switch (handle) {
    case "nw": return { x, y };
    case "n": return { x: x + w / 2, y };
    case "ne": return { x: x + w, y };
    case "e": return { x: x + w, y: y + h / 2 };
    case "se": return { x: x + w, y: y + h };
    case "s": return { x: x + w / 2, y: y + h };
    case "sw": return { x, y: y + h };
    case "w": return { x, y: y + h / 2 };
  }
}

/** Which corners offer a manual-resize handle, per item type — shared by the
 *  renderer (what to draw) and the editor (what to hit-test). Everything
 *  else gets none: note/todo auto-grow to content, board/document/link/file
 *  are fixed tiles, and arrow has its own dedicated start/end interaction
 *  entirely outside this system. */
export const RESIZE_HANDLES: Partial<Record<AnyItem["type"], HandleId[]>> = {
  image: ["se"],
  text: ["se"],
  shape: ["nw", "ne", "se", "sw"],
  draw: ["nw", "ne", "se", "sw"],
};

export const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

/**
 * Resize `bounds` by dragging `handle` to `point`. `min` stops an item from
 * being collapsed to nothing; the box is allowed to flip through zero, which
 * is what users expect when they drag a handle past the opposite edge.
 */
export function resizeBounds(
  bounds: Rect,
  handle: HandleId,
  point: Vec,
  min = 24,
): Rect {
  let { x, y, w, h } = bounds;
  const right = x + w;
  const bottom = y + h;

  if (handle.includes("w")) {
    x = Math.min(point.x, right - min);
    w = right - x;
  }
  if (handle.includes("e")) {
    w = Math.max(min, point.x - x);
  }
  if (handle.includes("n")) {
    y = Math.min(point.y, bottom - min);
    h = bottom - y;
  }
  if (handle.includes("s")) {
    h = Math.max(min, point.y - y);
  }
  return { x, y, w, h };
}

/** Scale a rect from `from` to `to` — used to move an item's inner points
 *  (draw strokes, arrow endpoints) along with its box during a resize. */
export function remapPoint(point: Vec, from: Rect, to: Rect): Vec {
  const sx = from.w === 0 ? 1 : to.w / from.w;
  const sy = from.h === 0 ? 1 : to.h / from.h;
  return {
    x: to.x + (point.x - from.x) * sx,
    y: to.y + (point.y - from.y) * sy,
  };
}
