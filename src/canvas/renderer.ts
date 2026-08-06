import type { AnyItem, Camera, Item, Rect } from "@/canvas/types";
import type { CanvasPalette } from "@/canvas/theme";
import { viewportBounds } from "@/canvas/camera";
import { HANDLES, handlePoint, itemBounds, rectsIntersect, unionBounds } from "@/canvas/geometry";
import { ellipsize, font, wrapText } from "@/canvas/text";
import { coverRect, getImage } from "@/canvas/images";

export type RenderState = {
  camera: Camera;
  /** Viewport size in CSS pixels. */
  size: { w: number; h: number };
  items: AnyItem[];
  selected: Set<string>;
  hovered: string | null;
  /** Item currently edited through a DOM overlay — its text is skipped so the
   *  canvas doesn't draw a second copy underneath the live editor. */
  editingId: string | null;
  marquee: Rect | null;
  palette: CanvasPalette;
  showGrid: boolean;
  /** Repaint request, used by async image loads. */
  invalidate: () => void;
};

const HANDLE_SIZE = 8;
const PADDING = 14;

export function render(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { camera, size, palette } = state;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.w, size.h);

  if (state.showGrid) drawGrid(ctx, state);

  ctx.scale(camera.z, camera.z);
  ctx.translate(camera.x, camera.y);

  const visible = viewportBounds(camera, size);
  for (const item of state.items) {
    if (!rectsIntersect(itemBounds(item), visible)) continue;
    drawItem(ctx, item, state);
  }

  drawSelection(ctx, state);

  ctx.restore();

  if (state.marquee) drawMarquee(ctx, state);
}

// Dot grid. The spacing doubles as you zoom out so dots never crowd into a
// solid wash, and fades out entirely below the point where they'd be noise.
function drawGrid(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { camera, size, palette } = state;
  let spacing = 24;
  while (spacing * camera.z < 16) spacing *= 2;
  const step = spacing * camera.z;
  if (step < 8) return;

  const offsetX = ((camera.x * camera.z) % step + step) % step;
  const offsetY = ((camera.y * camera.z) % step + step) % step;
  const radius = Math.min(1.4, Math.max(0.7, camera.z));

  ctx.fillStyle = palette.grid;
  for (let x = offsetX; x < size.w; x += step) {
    for (let y = offsetY; y < size.h; y += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function withShadow(ctx: CanvasRenderingContext2D, palette: CanvasPalette, fn: () => void) {
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  fn();
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: AnyItem, state: RenderState) {
  switch (item.type) {
    case "note": return drawNote(ctx, item, state);
    case "text": return drawText(ctx, item, state);
    case "image": return drawImageItem(ctx, item, state);
    case "link": return drawLink(ctx, item, state);
    case "file": return drawFile(ctx, item, state);
    case "board": return drawBoard(ctx, item, state);
    case "todo": return drawTodo(ctx, item, state);
    case "shape": return drawShape(ctx, item, state);
    case "draw": return drawStroke(ctx, item, state);
    case "arrow": return drawArrow(ctx, item, state);
  }
}

function drawNote(ctx: CanvasRenderingContext2D, item: Item<"note">, state: RenderState) {
  const colors = state.palette.note[item.props.color];
  withShadow(ctx, state.palette, () => {
    ctx.fillStyle = colors.fill;
    roundRect(ctx, itemBounds(item), 8);
    ctx.fill();
  });
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  roundRect(ctx, itemBounds(item), 8);
  ctx.stroke();

  if (state.editingId === item.id || !item.props.text) return;
  const f = font(15);
  const lines = wrapText(ctx, item.props.text, item.w - PADDING * 2, f);
  ctx.fillStyle = colors.text;
  ctx.font = f;
  ctx.textBaseline = "top";
  let y = item.y + PADDING;
  for (const line of lines) {
    if (y > item.y + item.h - PADDING) break;
    ctx.fillText(line, item.x + PADDING, y);
    y += 22;
  }
}

function drawText(ctx: CanvasRenderingContext2D, item: Item<"text">, state: RenderState) {
  if (state.editingId === item.id) return;
  const f = font(item.props.size, 500);
  const lines = wrapText(ctx, item.props.text || "Text", item.w, f);
  ctx.fillStyle = item.props.text
    ? item.props.color === "grey"
      ? state.palette.text
      : state.palette.stroke[item.props.color]
    : state.palette.textMuted;
  ctx.font = f;
  ctx.textBaseline = "top";
  let y = item.y;
  for (const line of lines) {
    ctx.fillText(line, item.x, y);
    y += item.props.size * 1.35;
  }
}

function drawImageItem(ctx: CanvasRenderingContext2D, item: Item<"image">, state: RenderState) {
  const bounds = itemBounds(item);
  const entry = getImage(item.props.src, state.invalidate);
  ctx.save();
  roundRect(ctx, bounds, 8);
  ctx.clip();
  if (entry?.loaded) {
    const fitted = coverRect(
      { w: entry.image.naturalWidth, h: entry.image.naturalHeight },
      bounds,
    );
    ctx.drawImage(entry.image, fitted.x, fitted.y, fitted.w, fitted.h);
  } else {
    ctx.fillStyle = state.palette.cardBackground;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = state.palette.textMuted;
    ctx.font = font(13);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      entry?.failed ? "Bild nicht verfügbar" : "Lädt…",
      bounds.x + bounds.w / 2,
      bounds.y + bounds.h / 2,
    );
    ctx.textAlign = "start";
  }
  ctx.restore();
}

function drawCardFrame(ctx: CanvasRenderingContext2D, bounds: Rect, state: RenderState) {
  withShadow(ctx, state.palette, () => {
    ctx.fillStyle = state.palette.cardBackground;
    roundRect(ctx, bounds, 10);
    ctx.fill();
  });
  ctx.strokeStyle = state.palette.cardBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, bounds, 10);
  ctx.stroke();
}

function drawLink(ctx: CanvasRenderingContext2D, item: Item<"link">, state: RenderState) {
  const bounds = itemBounds(item);
  drawCardFrame(ctx, bounds, state);

  const previewHeight = Math.min(item.h * 0.58, item.h - 64);
  if (item.props.image && previewHeight > 20) {
    const entry = getImage(item.props.image, state.invalidate);
    if (entry?.loaded) {
      const box = { x: item.x, y: item.y, w: item.w, h: previewHeight };
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, [10, 10, 0, 0]);
      ctx.clip();
      const fitted = coverRect(
        { w: entry.image.naturalWidth, h: entry.image.naturalHeight },
        box,
      );
      ctx.drawImage(entry.image, fitted.x, fitted.y, fitted.w, fitted.h);
      ctx.restore();
    }
  }

  const textTop = item.props.image ? item.y + previewHeight + 12 : item.y + 14;
  const titleFont = font(14, 600);
  const titleLines = wrapText(
    ctx,
    item.props.title || item.props.url,
    item.w - 28,
    titleFont,
  ).slice(0, 2);
  ctx.fillStyle = state.palette.text;
  ctx.font = titleFont;
  ctx.textBaseline = "top";
  let y = textTop;
  for (const line of titleLines) {
    ctx.fillText(line, item.x + 14, y);
    y += 19;
  }

  ctx.fillStyle = state.palette.textMuted;
  ctx.font = font(12);
  ctx.fillText(ellipsize(ctx, hostOf(item.props.url), item.w - 28, font(12)), item.x + 14, y + 4);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function drawFile(ctx: CanvasRenderingContext2D, item: Item<"file">, state: RenderState) {
  const bounds = itemBounds(item);
  drawCardFrame(ctx, bounds, state);

  const iconSize = 32;
  const iconX = item.x + 14;
  const iconY = item.y + (item.h - iconSize) / 2;
  ctx.fillStyle = state.palette.grid;
  ctx.beginPath();
  ctx.roundRect(iconX, iconY, iconSize, iconSize, 6);
  ctx.fill();
  ctx.strokeStyle = state.palette.textMuted;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(iconX + 10, iconY + 8);
  ctx.lineTo(iconX + 18, iconY + 8);
  ctx.lineTo(iconX + 23, iconY + 13);
  ctx.lineTo(iconX + 23, iconY + 24);
  ctx.lineTo(iconX + 10, iconY + 24);
  ctx.closePath();
  ctx.stroke();

  const textX = iconX + iconSize + 12;
  const textWidth = item.x + item.w - textX - 14;
  ctx.textBaseline = "middle";
  ctx.fillStyle = state.palette.text;
  ctx.font = font(13, 600);
  ctx.fillText(
    ellipsize(ctx, item.props.name || "Datei", textWidth, font(13, 600)),
    textX,
    item.y + item.h / 2 - 9,
  );
  ctx.fillStyle = state.palette.textMuted;
  ctx.font = font(12);
  ctx.fillText(formatSize(item.props.size), textX, item.y + item.h / 2 + 10);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function drawBoard(ctx: CanvasRenderingContext2D, item: Item<"board">, state: RenderState) {
  const bounds = itemBounds(item);
  drawCardFrame(ctx, bounds, state);

  const cx = item.x + item.w / 2;
  const iconY = item.y + item.h / 2 - 22;
  ctx.strokeStyle = state.palette.textMuted;
  ctx.lineWidth = 1.6;
  for (const [dx, dy] of [[-11, -11], [1, -11], [-11, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.roundRect(cx + dx, iconY + dy, 10, 10, 2);
    ctx.stroke();
  }

  ctx.fillStyle = state.palette.text;
  ctx.font = font(13, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    ellipsize(ctx, item.props.title, item.w - 24, font(13, 600)),
    cx,
    item.y + item.h / 2 + 12,
  );
  ctx.textAlign = "start";
}

function drawTodo(ctx: CanvasRenderingContext2D, item: Item<"todo">, state: RenderState) {
  const colors = state.palette.note.yellow;
  withShadow(ctx, state.palette, () => {
    ctx.fillStyle = colors.fill;
    roundRect(ctx, itemBounds(item), 8);
    ctx.fill();
  });
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  roundRect(ctx, itemBounds(item), 8);
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = font(14, 700);
  ctx.textBaseline = "top";
  ctx.fillText(
    ellipsize(ctx, item.props.title, item.w - 28, font(14, 700)),
    item.x + 14,
    item.y + 12,
  );

  let y = item.y + 38;
  ctx.font = font(13);
  for (const entry of item.props.entries) {
    if (y > item.y + item.h - 18) break;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(item.x + 14, y + 1, 13, 13, 3);
    ctx.stroke();
    if (entry.done) {
      ctx.beginPath();
      ctx.moveTo(item.x + 17, y + 7.5);
      ctx.lineTo(item.x + 20, y + 11);
      ctx.lineTo(item.x + 24, y + 4);
      ctx.stroke();
    }
    ctx.fillStyle = colors.text;
    const label = ellipsize(ctx, entry.text || "…", item.w - 48, font(13));
    ctx.fillText(label, item.x + 34, y);
    if (entry.done) {
      const width = ctx.measureText(label).width;
      ctx.beginPath();
      ctx.moveTo(item.x + 34, y + 8);
      ctx.lineTo(item.x + 34 + width, y + 8);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    y += 24;
  }
}

function drawShape(ctx: CanvasRenderingContext2D, item: Item<"shape">, state: RenderState) {
  const stroke = state.palette.stroke[item.props.color];
  const { x, y, w, h } = item;
  ctx.beginPath();
  if (item.props.kind === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (item.props.kind === "diamond") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  } else {
    ctx.roundRect(x, y, w, h, 6);
  }
  if (item.props.fill) {
    ctx.fillStyle = stroke;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, item: Item<"draw">, state: RenderState) {
  const points = item.props.points;
  if (points.length < 2) return;
  ctx.strokeStyle = state.palette.stroke[item.props.color];
  ctx.lineWidth = item.props.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  // Quadratic through midpoints: smooths the raw pointer samples without
  // needing a separate simplification pass.
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, item: Item<"arrow">, state: RenderState) {
  const start = { x: item.x, y: item.y };
  const end = item.props.end;
  ctx.strokeStyle = state.palette.stroke[item.props.color];
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = item.props.width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 12;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle - 0.4), end.y - head * Math.sin(angle - 0.4));
  ctx.lineTo(end.x - head * Math.cos(angle + 0.4), end.y - head * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
}

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { palette, camera } = state;
  // Outline widths are specified in screen pixels, so they're divided by the
  // zoom to survive the camera transform at any scale.
  const hairline = 1.5 / camera.z;

  if (state.hovered && !state.selected.has(state.hovered)) {
    const item = state.items.find((i) => i.id === state.hovered);
    if (item) {
      ctx.strokeStyle = palette.accent;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = hairline;
      roundRect(ctx, inflate(itemBounds(item), 2 / camera.z), 8 / camera.z);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const selected = state.items.filter((i) => state.selected.has(i.id));
  if (selected.length === 0) return;

  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = hairline;
  for (const item of selected) {
    roundRect(ctx, inflate(itemBounds(item), 2 / camera.z), 8 / camera.z);
    ctx.stroke();
  }

  const bounds = unionBounds(selected.map(itemBounds));
  if (selected.length > 1) {
    ctx.setLineDash([4 / camera.z, 4 / camera.z]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.setLineDash([]);
  }

  const size = HANDLE_SIZE / camera.z;
  ctx.fillStyle = palette.handleFill;
  ctx.lineWidth = hairline;
  for (const handle of HANDLES) {
    const point = handlePoint(bounds, handle);
    ctx.beginPath();
    ctx.roundRect(point.x - size / 2, point.y - size / 2, size, size, 2 / camera.z);
    ctx.fill();
    ctx.stroke();
  }
}

function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + by * 2, h: rect.h + by * 2 };
}

function drawMarquee(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { marquee, palette } = state;
  if (!marquee) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = palette.marqueeFill;
  ctx.strokeStyle = palette.marquee;
  ctx.lineWidth = 1;
  ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
  ctx.strokeRect(marquee.x + 0.5, marquee.y + 0.5, marquee.w, marquee.h);
  ctx.restore();
}
