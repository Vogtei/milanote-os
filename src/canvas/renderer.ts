import type { AnyItem, Camera, Item, NoteColor, Rect, Vec } from "@/canvas/types";
import type { CanvasPalette } from "@/canvas/theme";
import { viewportBounds } from "@/canvas/camera";
import { boundsOfPoints, handlePoint, itemBounds, RESIZE_HANDLES, rectsIntersect, unionBounds } from "@/canvas/geometry";
import { ellipsize, font, wrapText } from "@/canvas/text";
import { resolveArrowEndpoints, type ItemLookup } from "@/canvas/arrowBinding";
import { todoRows } from "@/canvas/todoLayout";
import { paintBlocks } from "@/canvas/richTextPaint";
import { isBlocksEmpty } from "@/canvas/richText";
import { containerTileHeight, containerTileRect, documentSheetRect } from "@/canvas/containerLayout";
import { coverRect, getImage } from "@/canvas/images";

export type RenderState = {
  /** How many children each nested board has, keyed by node id. Supplied by
   *  the page on load — the canvas can't know it, and a stored count would go
   *  stale the moment someone edits the other board. */
  boardCounts: Record<string, number>;
  /** Device pixel ratio. render() resets the transform, so the backing-store
   *  scale has to be re-applied here rather than set once at resize time. */
  dpr: number;
  camera: Camera;
  /** Viewport size in CSS pixels. */
  size: { w: number; h: number };
  items: AnyItem[];
  selected: Set<string>;
  hovered: string | null;
  /** Item currently edited through a DOM overlay — its text is skipped so the
   *  canvas doesn't draw a second copy underneath the live editor. */
  editingId: string | null;
  /** The one to-do row currently being edited, if any — only that row's text
   *  is skipped, not the rest of the card. */
  editingEntry: { itemId: string; entryId: string } | null;
  /** Folder/document item currently being renamed through a DOM overlay. */
  renaming: string | null;
  marquee: Rect | null;
  palette: CanvasPalette;
  showGrid: boolean;
  /** Repaint request, used by async image loads. */
  invalidate: () => void;
};

const HANDLE_SIZE = 8;
const PADDING = 14;

// Documents written by an older version of the app can be missing props that
// were added later — a board saved before todo cards had a colour, say. The
// renderer resolves colours through these so a stale document degrades to the
// default instead of throwing mid-frame and blanking the whole canvas.
function noteColors(palette: CanvasPalette, color: NoteColor | undefined) {
  return palette.note[color as NoteColor] ?? palette.note.yellow;
}

function strokeColor(palette: CanvasPalette, color: NoteColor | undefined) {
  return palette.stroke[color as NoteColor] ?? palette.stroke.grey;
}

export function render(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { camera, size, palette } = state;

  ctx.save();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size.w, size.h);

  if (state.showGrid) drawGrid(ctx, state);

  ctx.scale(camera.z, camera.z);
  ctx.translate(camera.x, camera.y);

  const lookup: ItemLookup = { getItem: (id) => byId.get(id) };
  const byId = new Map(state.items.map((i) => [i.id, i]));

  const visible = viewportBounds(camera, size);
  for (const item of state.items) {
    if (!rectsIntersect(arrowAwareBounds(item, lookup), visible)) continue;
    drawItem(ctx, item, state, lookup);
  }

  drawSelection(ctx, state, lookup);

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

function drawItem(ctx: CanvasRenderingContext2D, item: AnyItem, state: RenderState, lookup: ItemLookup) {
  switch (item.type) {
    case "note": return drawNote(ctx, item, state);
    case "text": return drawText(ctx, item, state);
    case "image": return drawImageItem(ctx, item, state);
    case "link": return drawLink(ctx, item, state);
    case "file": return drawFile(ctx, item, state);
    case "board": return drawFolder(ctx, item, state);
    case "document": return drawDocument(ctx, item, state);
    case "todo": return drawTodo(ctx, item, state);
    case "shape": return drawShape(ctx, item, state);
    case "draw": return drawStroke(ctx, item, state);
    case "arrow": return drawArrow(ctx, item, state, lookup);
  }
}

function drawNote(ctx: CanvasRenderingContext2D, item: Item<"note">, state: RenderState) {
  const colors = noteColors(state.palette, item.props.color);
  withShadow(ctx, state.palette, () => {
    ctx.fillStyle = colors.fill;
    roundRect(ctx, itemBounds(item), 8);
    ctx.fill();
  });
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  roundRect(ctx, itemBounds(item), 8);
  ctx.stroke();

  if (state.editingId === item.id) return;

  if (isBlocksEmpty(item.props.blocks)) {
    ctx.font = font(15);
    ctx.fillStyle = withAlpha(colors.text, 0.45);
    ctx.textBaseline = "top";
    ctx.fillText("Notiz schreiben…", item.x + PADDING, item.y + PADDING);
    return;
  }

  paintBlocks(
    ctx,
    item.props.blocks,
    { x: item.x + PADDING, y: item.y + PADDING, w: item.w - PADDING * 2 },
    { baseSize: 15, baseColor: colors.text, maxY: item.y + item.h - PADDING },
  );
}

function drawText(ctx: CanvasRenderingContext2D, item: Item<"text">, state: RenderState) {
  if (state.editingId === item.id) return;
  const f = font(item.props.size, 500);
  const lines = wrapText(ctx, item.props.text || "Text", item.w, f);
  ctx.fillStyle = item.props.text
    ? item.props.color === "grey"
      ? state.palette.text
      : strokeColor(state.palette, item.props.color)
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

  // An image is placed empty and gets its picture on double-click, so the
  // empty frame is a first-class state, not an error.
  if (!item.props.src) {
    ctx.save();
    ctx.fillStyle = state.palette.cardBackground;
    roundRect(ctx, bounds, 8);
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = state.palette.cardBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bounds, 8);
    ctx.stroke();
    ctx.setLineDash([]);

    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    ctx.strokeStyle = state.palette.textMuted;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.roundRect(cx - 17, cy - 26, 34, 28, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 7, cy - 17, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 6);
    ctx.lineTo(cx - 4, cy - 15);
    ctx.lineTo(cx + 2, cy - 10);
    ctx.lineTo(cx + 7, cy - 14);
    ctx.lineTo(cx + 15, cy - 6);
    ctx.stroke();

    ctx.fillStyle = state.palette.textMuted;
    ctx.font = font(12);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Doppelklick für Bild", cx, cy + 10);
    ctx.textAlign = "start";
    ctx.restore();
    return;
  }

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

// A nested board reads as a folder: a plain tile, then the name and how much
// is inside it underneath — the label sits outside the tile so long names
// aren't clipped by it.
function drawFolder(ctx: CanvasRenderingContext2D, item: Item<"board">, state: RenderState) {
  const tileH = containerTileHeight(item);
  const tile = containerTileRect(item);

  ctx.fillStyle = state.palette.folderTile;
  ctx.beginPath();
  ctx.roundRect(tile.x, tile.y, tile.w, tile.h, 8);
  ctx.fill();
  ctx.strokeStyle = state.palette.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  const cx = item.x + item.w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // The label is drawn by the DOM rename input while it's being edited, same
  // as note/text/todo text.
  const renaming = state.renaming === item.id;
  if (!renaming) {
    ctx.fillStyle = state.palette.text;
    ctx.font = font(13, 600);
    ctx.fillText(
      ellipsize(ctx, item.props.title || "Neuer Ordner", item.w, font(13, 600)),
      cx,
      item.y + tileH + 10,
    );
  }

  const count = state.boardCounts[item.props.nodeId] ?? 0;
  ctx.fillStyle = state.palette.textMuted;
  ctx.font = font(11);
  ctx.fillText(count === 1 ? "1 Element" : `${count} Elemente`, cx, item.y + tileH + 28);
  ctx.textAlign = "start";
}

// Same silhouette as the folder — sheet, then name, then length — so a board
// full of containers reads as one family of cards.
function drawDocument(ctx: CanvasRenderingContext2D, item: Item<"document">, state: RenderState) {
  const sheet = documentSheetRect(item);
  const sheetH = sheet.h;
  const sheetW = sheet.w;
  const x = sheet.x;
  const y = sheet.y;
  const fold = Math.min(16, sheetW * 0.28);

  ctx.beginPath();
  ctx.moveTo(x, y + 3);
  ctx.quadraticCurveTo(x, y, x + 3, y);
  ctx.lineTo(x + sheetW - fold, y);
  ctx.lineTo(x + sheetW, y + fold);
  ctx.lineTo(x + sheetW, y + sheetH - 3);
  ctx.quadraticCurveTo(x + sheetW, y + sheetH, x + sheetW - 3, y + sheetH);
  ctx.lineTo(x + 3, y + sheetH);
  ctx.quadraticCurveTo(x, y + sheetH, x, y + sheetH - 3);
  ctx.closePath();
  ctx.fillStyle = state.palette.sheet;
  ctx.fill();
  ctx.strokeStyle = state.palette.cardBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Folded corner.
  ctx.beginPath();
  ctx.moveTo(x + sheetW - fold, y);
  ctx.lineTo(x + sheetW - fold, y + fold);
  ctx.lineTo(x + sheetW, y + fold);
  ctx.stroke();

  ctx.fillStyle = state.palette.sheetInk;
  ctx.font = font(Math.min(20, sheetH * 0.34), 700);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("T", x + sheetW / 2, y + sheetH * 0.58);

  const cx = item.x + item.w / 2;
  ctx.textBaseline = "top";

  const renaming = state.renaming === item.id;
  if (!renaming) {
    ctx.fillStyle = state.palette.text;
    ctx.font = font(13, 600);
    ctx.fillText(
      ellipsize(ctx, item.props.title || "Dokument", item.w, font(13, 600)),
      cx,
      item.y + sheetH + 10,
    );
  }

  const words = countWords(item.props.content);
  ctx.fillStyle = state.palette.textMuted;
  ctx.font = font(11);
  ctx.fillText(words === 1 ? "1 Wort" : `${words} Wörter`, cx, item.y + sheetH + 28);
  ctx.textAlign = "start";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function drawTodo(ctx: CanvasRenderingContext2D, item: Item<"todo">, state: RenderState) {
  const colors = noteColors(state.palette, item.props.color);
  withShadow(ctx, state.palette, () => {
    ctx.fillStyle = colors.fill;
    roundRect(ctx, itemBounds(item), 8);
    ctx.fill();
  });
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  roundRect(ctx, itemBounds(item), 8);
  ctx.stroke();

  if (item.props.title) {
    ctx.fillStyle = colors.text;
    ctx.font = font(14, 700);
    ctx.textBaseline = "top";
    ctx.fillText(ellipsize(ctx, item.props.title, item.w - 28, font(14, 700)), item.x + 14, item.y + 16);
  }

  const editing = state.editingEntry?.itemId === item.id ? state.editingEntry.entryId : null;

  ctx.font = font(13);
  ctx.textBaseline = "top";
  for (const row of todoRows(item)) {
    const { entry, checkbox, text } = row;

    ctx.strokeStyle = withAlpha(colors.text, 0.35);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(checkbox.x, checkbox.y, checkbox.w, checkbox.h, 4);
    ctx.stroke();
    if (entry.done) {
      ctx.strokeStyle = colors.text;
      ctx.beginPath();
      ctx.moveTo(checkbox.x + 4, checkbox.y + 7.5);
      ctx.lineTo(checkbox.x + 7, checkbox.y + 11);
      ctx.lineTo(checkbox.x + 11.5, checkbox.y + 4);
      ctx.stroke();
    }

    // The row being edited gets its text from the DOM overlay instead.
    if (entry.id === editing) continue;

    const empty = !entry.text;
    ctx.fillStyle = empty || entry.done ? withAlpha(colors.text, 0.45) : colors.text;
    const label = ellipsize(ctx, entry.text || "Aufgabe hinzufügen…", text.w, font(13));
    ctx.fillText(label, text.x, text.y + 2);
    if (entry.done && entry.text) {
      const width = ctx.measureText(label).width;
      ctx.strokeStyle = withAlpha(colors.text, 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(text.x, text.y + 10);
      ctx.lineTo(text.x + width, text.y + 10);
      ctx.stroke();
    }
  }
}

function shapePath(ctx: CanvasRenderingContext2D, item: Item<"shape">) {
  const { x, y, w, h } = item;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.beginPath();
  switch (item.props.kind) {
    case "roundRect":
      ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.22);
      break;
    case "ellipse":
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case "diamond":
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;
    case "bubble": {
      const body = h * 0.78;
      const r = Math.min(w, body) * 0.18;
      ctx.roundRect(x, y, w, body, r);
      ctx.moveTo(x + w * 0.24, y + body);
      ctx.lineTo(x + w * 0.2, y + h);
      ctx.lineTo(x + w * 0.44, y + body);
      break;
    }
    case "parallelogram": {
      const skew = w * 0.22;
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - skew, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    }
    case "star": {
      const outer = Math.min(w, h) / 2;
      const inner = outer * 0.44;
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(angle) * radius * (w / Math.min(w, h));
        const py = cy + Math.sin(angle) * radius * (h / Math.min(w, h));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "blockArrow": {
      const shaft = h * 0.34;
      const headW = w * 0.36;
      ctx.moveTo(x, cy - shaft / 2);
      ctx.lineTo(x + w - headW, cy - shaft / 2);
      ctx.lineTo(x + w - headW, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(x + w - headW, y + h);
      ctx.lineTo(x + w - headW, cy + shaft / 2);
      ctx.lineTo(x, cy + shaft / 2);
      ctx.closePath();
      break;
    }
    case "line":
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y);
      break;
    case "doubleArrow": {
      const shaft = h * 0.3;
      const headW = w * 0.24;
      ctx.moveTo(x, cy);
      ctx.lineTo(x + headW, y);
      ctx.lineTo(x + headW, cy - shaft / 2);
      ctx.lineTo(x + w - headW, cy - shaft / 2);
      ctx.lineTo(x + w - headW, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(x + w - headW, y + h);
      ctx.lineTo(x + w - headW, cy + shaft / 2);
      ctx.lineTo(x + headW, cy + shaft / 2);
      ctx.lineTo(x + headW, y + h);
      ctx.closePath();
      break;
    }
    case "pentagon":
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = cx + (Math.cos(angle) * w) / 2;
        const py = cy + (Math.sin(angle) * h) / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    default:
      ctx.roundRect(x, y, w, h, 6);
  }
}

function drawShape(ctx: CanvasRenderingContext2D, item: Item<"shape">, state: RenderState) {
  const stroke = strokeColor(state.palette, item.props.color);
  shapePath(ctx, item);
  // A line has no interior, so filling it would just thicken the stroke.
  if (item.props.fill && item.props.kind !== "line") {
    ctx.fillStyle = stroke;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, item: Item<"draw">, state: RenderState) {
  const points = item.props.points;
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = strokeColor(state.palette, item.props.color);
  if (item.props.highlighter) {
    ctx.lineWidth = item.props.width * 4;
    ctx.globalAlpha = 0.35;
    ctx.lineCap = "butt";
  } else {
    ctx.lineWidth = item.props.width;
    ctx.lineCap = "round";
  }
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
  ctx.restore();
}

/** Bounding box used for culling and the selection outline — resolved
 *  against live bindings so a connected arrow is never culled from view (or
 *  outlined in the wrong place) just because its stored x/y/end drifted from
 *  where the target actually is now. */
function arrowAwareBounds(item: AnyItem, lookup: ItemLookup): Rect {
  if (item.type !== "arrow") return itemBounds(item);
  const { start, end } = resolveArrowEndpoints(lookup, item);
  return boundsOfPoints([start, end]);
}

function drawArrow(ctx: CanvasRenderingContext2D, item: Item<"arrow">, state: RenderState, lookup: ItemLookup) {
  const { start, end } = resolveArrowEndpoints(lookup, item);
  ctx.save();
  ctx.strokeStyle = strokeColor(state.palette, item.props.color);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = item.props.width;
  ctx.lineCap = "round";
  if (item.props.dashed) ctx.setLineDash([item.props.width * 4, item.props.width * 3]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 6 + item.props.width * 3;
  const tip = (at: Vec, direction: number) => {
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.lineTo(at.x - direction * head * Math.cos(angle - 0.4), at.y - direction * head * Math.sin(angle - 0.4));
    ctx.lineTo(at.x - direction * head * Math.cos(angle + 0.4), at.y - direction * head * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  };
  const heads = item.props.heads ?? "end";
  if (heads !== "none") tip(end, 1);
  if (heads === "both") tip(start, -1);
  ctx.restore();
}

/** Outline bounds for selection/hover — the item's own visible shape, not
 *  its raw x/y/w/h box. A board/document reserves 44px below the tile for
 *  its label (see containerLayout.ts), which the outline should skip. */
function selectionBounds(item: AnyItem, lookup: ItemLookup): Rect {
  if (item.type === "board") return containerTileRect(item);
  if (item.type === "document") return documentSheetRect(item);
  return arrowAwareBounds(item, lookup);
}

/** Three short diagonal strokes fanning out from the corner — a resize grip,
 *  not a draggable point on a grid. Only image/text get this; it's the sole
 *  resize affordance they have. */
function drawCornerGrip(ctx: CanvasRenderingContext2D, point: Vec, camera: Camera, palette: CanvasPalette) {
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.4 / camera.z;
  ctx.lineCap = "round";
  for (const offset of [3.5, 6.5, 9.5]) {
    const d = offset / camera.z;
    ctx.beginPath();
    ctx.moveTo(point.x - d, point.y);
    ctx.lineTo(point.x, point.y - d);
    ctx.stroke();
  }
}

/** Small filled dot, matching the arrow endpoint handles' own look — used
 *  for shape/draw's corner-only resize points instead of the old filled
 *  squares. */
function drawDotHandle(ctx: CanvasRenderingContext2D, point: Vec, camera: Camera, palette: CanvasPalette) {
  const r = HANDLE_SIZE / 2.4 / camera.z;
  ctx.fillStyle = palette.handleFill;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1.2 / camera.z;
  ctx.beginPath();
  ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawResizeAffordance(
  ctx: CanvasRenderingContext2D,
  item: AnyItem,
  bounds: Rect,
  palette: CanvasPalette,
  camera: Camera,
) {
  const handles = RESIZE_HANDLES[item.type];
  if (!handles) return;
  if (item.type === "image" || item.type === "text") {
    drawCornerGrip(ctx, handlePoint(bounds, "se"), camera, palette);
    return;
  }
  for (const handle of handles) drawDotHandle(ctx, handlePoint(bounds, handle), camera, palette);
}

function drawSelection(ctx: CanvasRenderingContext2D, state: RenderState, lookup: ItemLookup) {
  const { palette, camera } = state;
  // Outline widths are specified in screen pixels, so they're divided by the
  // zoom to survive the camera transform at any scale.
  const hairline = 1.5 / camera.z;

  // Hovering an unselected item redraws it slightly larger, on top of itself
  // — immediate-mode canvas has no other way to "scale" something already
  // painted. Minimal (3%), just enough to read as "this reacts."
  if (state.hovered && !state.selected.has(state.hovered)) {
    const item = state.items.find((i) => i.id === state.hovered);
    if (item) {
      const bounds = selectionBounds(item, lookup);
      const cx = bounds.x + bounds.w / 2;
      const cy = bounds.y + bounds.h / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1.03, 1.03);
      ctx.translate(-cx, -cy);
      drawItem(ctx, item, state, lookup);
      ctx.restore();
      drawResizeAffordance(ctx, item, bounds, palette, camera);
    }
  }

  const selected = state.items.filter((i) => state.selected.has(i.id));
  if (selected.length === 0) return;

  // A single selected arrow gets its own start/end/midpoint dots instead of
  // the generic box — dragging start or end rebinds that end (see
  // BoardEditor.arrowEndpointAt); the midpoint is a plain visual mid-marker.
  if (selected.length === 1 && selected[0].type === "arrow") {
    const { start, end } = resolveArrowEndpoints(lookup, selected[0]);
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = hairline;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const r = HANDLE_SIZE / 1.6 / camera.z;
    for (const point of [start, end]) {
      ctx.fillStyle = palette.handleFill;
      ctx.beginPath();
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Full outline around each selected item's own visible shape — no handles
  // here; a manual-resize affordance (if any) is drawn separately below,
  // only for a single-item selection.
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = hairline;
  for (const item of selected) {
    roundRect(ctx, inflate(selectionBounds(item, lookup), 2 / camera.z), 8 / camera.z);
    ctx.stroke();
  }

  if (selected.length > 1) {
    const bounds = unionBounds(selected.map((i) => arrowAwareBounds(i, lookup)));
    ctx.setLineDash([4 / camera.z, 4 / camera.z]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.setLineDash([]);
    return;
  }

  drawResizeAffordance(ctx, selected[0], selectionBounds(selected[0], lookup), palette, camera);
}

function inflate(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + by * 2, h: rect.h + by * 2 };
}

function drawMarquee(ctx: CanvasRenderingContext2D, state: RenderState) {
  const { marquee, palette } = state;
  if (!marquee) return;
  ctx.save();
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.fillStyle = palette.marqueeFill;
  ctx.strokeStyle = palette.marquee;
  ctx.lineWidth = 1;
  ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
  ctx.strokeRect(marquee.x + 0.5, marquee.y + 0.5, marquee.w, marquee.h);
  ctx.restore();
}

/** Applies an alpha to a hex colour, for placeholder and struck-through text
 *  that has to stay readable on whatever card colour it lands on. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
