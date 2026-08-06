import type { AnyItem } from "@/canvas/types";
import type { CanvasPalette } from "@/canvas/theme";
import { itemBounds, unionBounds } from "@/canvas/geometry";
import { render } from "@/canvas/renderer";

/**
 * Renders the whole board to a PNG off-screen. Reuses the same render() the
 * live canvas uses, with selection state emptied and the grid off, so an export
 * can never drift from what's on screen.
 */
export async function exportBoardPng(
  items: AnyItem[],
  palette: CanvasPalette,
  options: { scale?: number; padding?: number; filename?: string } = {},
): Promise<boolean> {
  if (items.length === 0) return false;

  const scale = options.scale ?? 2;
  const padding = options.padding ?? 48;
  const bounds = unionBounds(items.map(itemBounds));
  const width = bounds.w + padding * 2;
  const height = bounds.h + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const draw = () =>
    render(ctx, {
      dpr: scale,
      camera: { x: -bounds.x + padding, y: -bounds.y + padding, z: 1 },
      size: { w: width, h: height },
      items,
      selected: new Set(),
      hovered: null,
      editingId: null,
      marquee: null,
      palette,
      showGrid: false,
      invalidate: () => {},
    });

  // First pass kicks off any image loads; the second draws them once they've
  // landed. Without it, exports of boards with images come out with grey
  // placeholders where the pictures should be.
  draw();
  await new Promise((resolve) => setTimeout(resolve, 350));
  draw();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename ?? "board.png";
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
