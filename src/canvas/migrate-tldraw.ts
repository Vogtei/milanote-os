import type { AnyItem, Doc, ItemType, NoteColor, Vec } from "@/canvas/types";
import { DEFAULT_SIZES, defaultProps, emptyDoc } from "@/canvas/types";
import { plainTextBlocks } from "@/canvas/richText";

// One-way conversion of the tldraw room snapshots this project stored until
// the renderer swap. Boards created before the swap would otherwise open
// empty, so this runs on load whenever the stored blob still looks like
// tldraw's format, and the result is written back in the new format on the
// next save.
//
// Only the shape kinds this app actually created are handled; anything else is
// skipped rather than guessed at, so a stray record can't produce a garbage
// item on someone's board.

type TldrawRecord = {
  id: string;
  typeName: string;
  type?: string;
  x?: number;
  y?: number;
  rotation?: number;
  index?: string;
  props?: Record<string, unknown>;
};

type RoomSnapshot = {
  documents?: { state: TldrawRecord }[];
};

export function looksLikeTldrawSnapshot(value: unknown): value is RoomSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as RoomSnapshot).documents)
  );
}

const COLOR_MAP: Record<string, NoteColor> = {
  black: "grey",
  grey: "grey",
  "light-violet": "purple",
  violet: "purple",
  blue: "blue",
  "light-blue": "blue",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  "light-green": "green",
  "light-red": "red",
  red: "red",
  white: "white",
};

function color(value: unknown): NoteColor {
  return COLOR_MAP[String(value)] ?? "yellow";
}

/** Flattens TipTap's rich-text JSON into the plain string our notes store. */
function plainText(rich: unknown): string {
  if (typeof rich === "string") return rich;
  if (!rich || typeof rich !== "object") return "";
  const node = rich as { type?: string; text?: string; content?: unknown[] };
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  const parts = node.content.map(plainText);
  // Block-level nodes become their own line; inline runs stay on one.
  return node.type === "doc" || node.type === "paragraph" || node.type === "heading"
    ? parts.join(node.type === "doc" ? "\n" : "")
    : parts.join("");
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function migrateTldrawSnapshot(snapshot: RoomSnapshot): Doc {
  const records = (snapshot.documents ?? []).map((d) => d.state).filter(Boolean);

  // tldraw keeps image/bookmark bitmaps in separate asset records that shapes
  // point at by id, so resolve those first.
  const assets = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (record.typeName === "asset" && record.props) assets.set(record.id, record.props);
  }

  const shapes = records
    .filter((r) => r.typeName === "shape")
    .sort((a, b) => String(a.index ?? "").localeCompare(String(b.index ?? "")));

  const doc: Doc = emptyDoc();

  for (const shape of shapes) {
    const item = convert(shape, assets);
    if (!item) continue;
    doc.items[item.id] = item;
    doc.order.push(item.id);
  }

  return doc;
}

function base<T extends ItemType>(shape: TldrawRecord, type: T, w: number, h: number) {
  return {
    id: shape.id.replace(/^shape:/, "") || crypto.randomUUID(),
    type,
    x: num(shape.x, 0),
    y: num(shape.y, 0),
    w,
    h,
    rotation: num(shape.rotation, 0),
    props: defaultProps(type),
  };
}

function convert(
  shape: TldrawRecord,
  assets: Map<string, Record<string, unknown>>,
): AnyItem | null {
  const p = shape.props ?? {};

  switch (shape.type) {
    case "note": {
      const size = DEFAULT_SIZES.note;
      const item = base(shape, "note", size.w, num(p.growY, 0) + size.h);
      item.props = { blocks: plainTextBlocks(plainText(p.richText)), color: color(p.color) };
      return item as AnyItem;
    }
    case "text": {
      const item = base(shape, "text", num(p.w, DEFAULT_SIZES.text.w), DEFAULT_SIZES.text.h);
      item.props = { text: plainText(p.richText), size: 20, color: color(p.color) };
      return item as AnyItem;
    }
    case "geo": {
      const item = base(shape, "shape", num(p.w, 160), num(p.h, 120));
      item.props = {
        kind: p.geo === "ellipse" ? "ellipse" : p.geo === "diamond" ? "diamond" : "rect",
        color: color(p.color),
        fill: p.fill !== "none",
      };
      return item as AnyItem;
    }
    case "image": {
      const asset = typeof p.assetId === "string" ? assets.get(p.assetId) : undefined;
      const item = base(shape, "image", num(p.w, 320), num(p.h, 240));
      item.props = { src: String(asset?.src ?? ""), alt: String(p.altText ?? "") };
      return item.props.src ? (item as AnyItem) : null;
    }
    case "bookmark": {
      const asset = typeof p.assetId === "string" ? assets.get(p.assetId) : undefined;
      const item = base(shape, "link", num(p.w, 300), num(p.h, 320));
      item.props = {
        url: String(p.url ?? asset?.src ?? ""),
        title: String(asset?.title ?? ""),
        description: String(asset?.description ?? ""),
        image: String(asset?.image ?? ""),
        favicon: String(asset?.favicon ?? ""),
      };
      return item.props.url ? (item as AnyItem) : null;
    }
    case "draw": {
      const segments = Array.isArray(p.segments) ? p.segments : [];
      const points: Vec[] = [];
      for (const segment of segments) {
        const segPoints = (segment as { points?: Vec[] }).points ?? [];
        for (const point of segPoints) {
          points.push({ x: num(shape.x, 0) + point.x, y: num(shape.y, 0) + point.y });
        }
      }
      if (points.length < 2) return null;
      const xs = points.map((pt) => pt.x);
      const ys = points.map((pt) => pt.y);
      const item = base(shape, "draw", Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      item.x = Math.min(...xs);
      item.y = Math.min(...ys);
      item.props = { points, color: color(p.color), width: 4, highlighter: false };
      return item as AnyItem;
    }
    case "arrow": {
      const start = (p.start ?? { x: 0, y: 0 }) as Vec;
      const end = (p.end ?? { x: 0, y: 0 }) as Vec;
      const ax = num(shape.x, 0) + num(start.x, 0);
      const ay = num(shape.y, 0) + num(start.y, 0);
      const bx = num(shape.x, 0) + num(end.x, 0);
      const by = num(shape.y, 0) + num(end.y, 0);
      const item = base(shape, "arrow", Math.abs(bx - ax), Math.abs(by - ay));
      item.x = ax;
      item.y = ay;
      item.props = { end: { x: bx, y: by }, color: color(p.color), width: 2, dashed: false, heads: "end" };
      return item as AnyItem;
    }
    case "todo": {
      const entries = Array.isArray(p.items) ? p.items : [];
      const item = base(shape, "todo", num(p.w, 240), num(p.h, 200));
      item.props = {
        color: "white",
        title: String(p.title ?? ""),
        entries: entries.map((entry) => {
          const e = entry as { id?: string; text?: string; done?: boolean };
          return {
            id: String(e.id ?? crypto.randomUUID()),
            text: String(e.text ?? ""),
            done: Boolean(e.done),
          };
        }),
      };
      return item as AnyItem;
    }
    case "board-link": {
      const item = base(shape, "board", num(p.w, 220), num(p.h, 140));
      item.props = { nodeId: String(p.nodeId ?? ""), title: String(p.title ?? "Board") };
      return item.props.nodeId ? (item as AnyItem) : null;
    }
    case "file": {
      const item = base(shape, "file", num(p.w, 240), num(p.h, 72));
      item.props = {
        name: String(p.name ?? "Datei"),
        size: num(p.size, 0),
        src: String(p.src ?? ""),
      };
      return item as AnyItem;
    }
    default:
      return null;
  }
}
