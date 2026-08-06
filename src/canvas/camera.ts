import type { Camera, Rect, Vec } from "@/canvas/types";

// The viewport transform, and nothing else. Everything that needs to convert
// between what the user points at and where things live on the board goes
// through here, so there is exactly one definition of the mapping.
//
//   screen = (world + camera) * z
//   world  = screen / z - camera

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

export function screenToWorld(camera: Camera, point: Vec): Vec {
  return {
    x: point.x / camera.z - camera.x,
    y: point.y / camera.z - camera.y,
  };
}

export function worldToScreen(camera: Camera, point: Vec): Vec {
  return {
    x: (point.x + camera.x) * camera.z,
    y: (point.y + camera.y) * camera.z,
  };
}

/** The world-space rectangle currently visible in a viewport of `size`. */
export function viewportBounds(camera: Camera, size: { w: number; h: number }): Rect {
  const topLeft = screenToWorld(camera, { x: 0, y: 0 });
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: size.w / camera.z,
    h: size.h / camera.z,
  };
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Zoom by `factor` while keeping the world point currently under `anchor`
 * (a screen point) pinned in place — the behaviour every canvas app has for
 * ctrl-wheel and pinch, and the reason zoom can't just scale `z`.
 */
export function zoomAround(camera: Camera, anchor: Vec, factor: number): Camera {
  const z = clampZoom(camera.z * factor);
  if (z === camera.z) return camera;
  const world = screenToWorld(camera, anchor);
  return {
    z,
    x: anchor.x / z - world.x,
    y: anchor.y / z - world.y,
  };
}

/** Zoom to an exact level, keeping the viewport centre fixed. */
export function zoomTo(camera: Camera, size: { w: number; h: number }, z: number): Camera {
  return zoomAround(camera, { x: size.w / 2, y: size.h / 2 }, clampZoom(z) / camera.z);
}

export function panBy(camera: Camera, delta: Vec): Camera {
  return { ...camera, x: camera.x - delta.x / camera.z, y: camera.y - delta.y / camera.z };
}

/** Fit `bounds` into the viewport with a little breathing room. */
export function cameraForBounds(
  bounds: Rect,
  size: { w: number; h: number },
  padding = 64,
): Camera {
  if (bounds.w <= 0 || bounds.h <= 0) {
    return { x: size.w / 2 - bounds.x, y: size.h / 2 - bounds.y, z: 1 };
  }
  const z = clampZoom(
    Math.min((size.w - padding * 2) / bounds.w, (size.h - padding * 2) / bounds.h),
  );
  return {
    z,
    x: (size.w / z - bounds.w) / 2 - bounds.x,
    y: (size.h / z - bounds.h) / 2 - bounds.y,
  };
}
