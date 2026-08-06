// The board document model. Deliberately plain data — no classes, no
// framework types — so it can be JSON-serialised straight into Postgres,
// diffed, and later handed to a CRDT layer without a translation step.

export type Vec = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

/** Viewport transform. `z` is the zoom factor, 1 = 100%. */
export type Camera = { x: number; y: number; z: number };

export type ItemType =
  | "note"
  | "text"
  | "image"
  | "link"
  | "file"
  | "board"
  | "document"
  | "todo"
  | "shape"
  | "draw"
  | "arrow";

/** Shape vocabulary offered by the Formen picker. */
export type ShapeKind =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "bubble"
  | "parallelogram"
  | "star"
  | "blockArrow"
  | "line"
  | "doubleArrow"
  | "pentagon";

export const SHAPE_KINDS: ShapeKind[] = [
  "rect",
  "roundRect",
  "ellipse",
  "triangle",
  "diamond",
  "bubble",
  "parallelogram",
  "star",
  "blockArrow",
  "line",
  "doubleArrow",
  "pentagon",
];

export type TodoEntry = { id: string; text: string; done: boolean };

export type ItemProps = {
  note: { text: string; color: NoteColor };
  text: { text: string; size: number; color: NoteColor };
  image: { src: string; alt: string };
  link: { url: string; title: string; description: string; image: string; favicon: string };
  file: { name: string; size: number; src: string };
  /** A nested board. Presented as a folder, which is what it behaves like. */
  board: { nodeId: string; title: string };
  /** A long-form text document, edited in its own window rather than on the
   *  canvas — the card only shows its title and length. */
  document: { title: string; content: string };
  todo: { title: string; entries: TodoEntry[]; color: NoteColor };
  shape: { kind: ShapeKind; color: NoteColor; fill: boolean };
  /** `highlighter` strokes draw wide and translucent, under everything else. */
  draw: { points: Vec[]; color: NoteColor; width: number; highlighter: boolean };
  arrow: { end: Vec; color: NoteColor; width: number; dashed: boolean; heads: "end" | "both" | "none" };
};

export type NoteColor =
  | "yellow"
  | "white"
  | "blue"
  | "green"
  | "red"
  | "purple"
  | "orange"
  | "grey";

/**
 * One thing on the board. `x/y/w/h` are in world (board) space; the renderer
 * is the only place that knows about screen pixels.
 *
 * `draw` and `arrow` still carry a w/h box — it's their bounding box, kept in
 * sync when their points change, so selection/hit-testing/marquee can treat
 * every item type uniformly.
 */
export type Item<T extends ItemType = ItemType> = {
  id: string;
  type: T;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /** Locked items can still be selected (so they can be unlocked again) but
   *  can't be dragged or resized. */
  locked?: boolean;
  props: ItemProps[T];
};

export type AnyItem = { [K in ItemType]: Item<K> }[ItemType];

export type Doc = {
  /** Items by id. */
  items: Record<string, AnyItem>;
  /** Bottom-to-top paint order. Also the z-order for hit-testing (reversed). */
  order: string[];
};

export function emptyDoc(): Doc {
  return { items: {}, order: [] };
}

export const DEFAULT_SIZES: Record<ItemType, { w: number; h: number }> = {
  note: { w: 220, h: 180 },
  text: { w: 220, h: 40 },
  image: { w: 320, h: 240 },
  link: { w: 280, h: 260 },
  file: { w: 240, h: 72 },
  board: { w: 150, h: 130 },
  document: { w: 150, h: 130 },
  todo: { w: 260, h: 120 },
  shape: { w: 180, h: 140 },
  draw: { w: 0, h: 0 },
  arrow: { w: 0, h: 0 },
};

export function defaultProps<T extends ItemType>(type: T): ItemProps[T] {
  const byType: { [K in ItemType]: ItemProps[K] } = {
    note: { text: "", color: "yellow" },
    text: { text: "", size: 20, color: "grey" },
    image: { src: "", alt: "" },
    link: { url: "", title: "", description: "", image: "", favicon: "" },
    file: { name: "", size: 0, src: "" },
    board: { nodeId: "", title: "Neuer Ordner" },
    document: { title: "Dokument", content: "" },
    todo: { title: "", entries: [], color: "white" },
    shape: { kind: "rect", color: "grey", fill: false },
    draw: { points: [], color: "grey", width: 4, highlighter: false },
    arrow: { end: { x: 0, y: 0 }, color: "grey", width: 2, dashed: false, heads: "end" },
  };
  return byType[type];
}
