import type { AnyItem, Camera, Doc, ItemType, NoteColor, Rect, ShapeKind, Vec } from "@/canvas/types";
import { DEFAULT_SIZES, defaultProps } from "@/canvas/types";
import { BoardStore } from "@/canvas/store";
import {
  cameraForBounds,
  clampZoom,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAround,
  zoomTo,
} from "@/canvas/camera";
import type { HandleId } from "@/canvas/geometry";
import { todoRowAt } from "@/canvas/todoLayout";
import { containerLabelRect } from "@/canvas/containerLayout";
import { anchorFor, anchorPoint, resolveArrowEndpoints } from "@/canvas/arrowBinding";
import {
  boundsOfPoints,
  distance,
  distanceToSegment,
  HANDLES,
  handlePoint,
  itemBounds,
  normalizeRect,
  rectContains,
  rectsIntersect,
  remapPoint,
  resizeBounds,
  unionBounds,
} from "@/canvas/geometry";

export type ToolId =
  | "select"
  | "hand"
  | "note"
  | "text"
  | "todo"
  | "board"
  | "image"
  | "document"
  | "file"
  | "link"
  | "shape"
  | "draw"
  | "eraser"
  | "arrow";

/** Tools that place an item where you click/drag instead of selecting. */
const PLACING_TOOLS: ToolId[] = ["note", "text", "todo", "shape", "document"];

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; last: Vec }
  | { kind: "maybeDrag"; origin: Vec; itemId: string; additive: boolean }
  | { kind: "drag"; origin: Vec; startPositions: Map<string, Vec> }
  | { kind: "resize"; handle: HandleId; startBounds: Rect; startItems: AnyItem[] }
  | { kind: "marquee"; originScreen: Vec; currentScreen: Vec; additive: boolean; base: Set<string> }
  | { kind: "draw"; id: string }
  | { kind: "arrow"; id: string }
  | { kind: "createShape"; id: string; origin: Vec }
  | { kind: "erase" }
  | { kind: "arrowEndpoint"; itemId: string; end: "start" | "end" };

const DRAG_THRESHOLD = 3;
const HANDLE_HIT = 10;
const STROKE_HIT = 8;

export type EditorEvent =
  | { type: "change" }
  | { type: "openBoard"; nodeId: string }
  | { type: "requestEdit"; itemId: string }
  | { type: "requestImage"; itemId: string }
  | { type: "requestDocument"; itemId: string };

/**
 * Owns everything about the board that isn't React: the document, the camera,
 * what's selected, which tool is armed, and the pointer state machine that
 * turns raw events into edits.
 *
 * React subscribes for repaints; the chrome (topbar, rail, panels) calls the
 * command methods. Nothing in here touches the DOM except the canvas element's
 * own size, so the whole thing is testable headlessly.
 */
export class BoardEditor {
  readonly store: BoardStore;

  private camera: Camera = { x: 0, y: 0, z: 1 };
  private size = { w: 0, h: 0 };
  private selection = new Set<string>();
  private tool: ToolId = "select";
  private interaction: Interaction = { kind: "none" };
  private hovered: string | null = null;
  private editingId: string | null = null;
  private editingEntry: { itemId: string; entryId: string } | null = null;
  private renaming: string | null = null;
  private spaceDown = false;
  private listeners = new Set<(event: EditorEvent) => void>();
  private color: NoteColor = "yellow";
  private shapeKind: ShapeKind = "rect";
  private strokeWidth = 4;
  private highlighter = false;
  private readonly = false;

  constructor(doc?: Doc) {
    this.store = new BoardStore(doc);
    this.store.subscribe(() => this.emit({ type: "change" }));
  }

  // ---------------------------------------------------------------- events

  subscribe(listener: (event: EditorEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: EditorEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private changed() {
    this.emit({ type: "change" });
  }

  // ----------------------------------------------------------------- state

  getCamera() { return this.camera; }
  getSize() { return this.size; }
  getSelection() { return this.selection; }
  getSelectedItems() { return [...this.selection].map((id) => this.store.getItem(id)).filter(Boolean) as AnyItem[]; }
  getTool() { return this.tool; }
  getHovered() { return this.hovered; }
  getEditingId() { return this.editingId; }
  getEditingEntry() { return this.editingEntry; }
  getRenaming() { return this.renaming; }
  getColor() { return this.color; }
  getShapeKind() { return this.shapeKind; }
  getStrokeWidth() { return this.strokeWidth; }
  isHighlighter() { return this.highlighter; }

  setShapeKind(kind: ShapeKind) {
    this.shapeKind = kind;
    // Applies to the selection too, so the picker doubles as an editor for a
    // shape that's already on the board.
    if (this.selection.size > 0) {
      this.store.transact(() => {
        for (const item of this.getSelectedItems()) {
          if (item.type === "shape") this.store.updateProps(item.id, { kind } as never);
        }
      });
    }
    this.changed();
  }

  setStrokeWidth(width: number) {
    this.strokeWidth = width;
    if (this.selection.size > 0) {
      this.store.transact(() => {
        for (const item of this.getSelectedItems()) {
          if (item.type === "draw" || item.type === "arrow") {
            this.store.updateProps(item.id, { width } as never);
          }
        }
      });
    }
    this.changed();
  }

  setHighlighter(on: boolean) {
    this.highlighter = on;
    this.changed();
  }
  getMarquee(): Rect | null {
    return this.interaction.kind === "marquee"
      ? normalizeRect(this.interaction.originScreen, this.interaction.currentScreen)
      : null;
  }
  isReadonly() { return this.readonly; }

  setReadonly(readonly: boolean) {
    this.readonly = readonly;
    if (readonly) {
      this.selection.clear();
      this.editingId = null;
      this.editingEntry = null;
      this.renaming = null;
      this.tool = "select";
    }
    this.changed();
  }

  setSize(size: { w: number; h: number }) {
    if (this.size.w === size.w && this.size.h === size.h) return;
    this.size = size;
    // Resizing the element reallocates (and blanks) the canvas bitmap, so this
    // has to announce itself — otherwise the board goes blank on every resize
    // until something else happens to trigger a repaint.
    this.changed();
  }

  setTool(tool: ToolId) {
    if (this.readonly && tool !== "select" && tool !== "hand") return;
    this.tool = tool;
    if (tool !== "select") this.setSelection([]);
    this.changed();
  }

  setColor(color: NoteColor) {
    this.color = color;
    if (this.selection.size > 0) {
      this.store.transact(() => {
        for (const item of this.getSelectedItems()) {
          if ("color" in item.props) this.store.updateProps(item.id, { color } as never);
        }
      });
    }
    this.changed();
  }

  setSelection(ids: string[]) {
    this.selection = new Set(ids);
    this.changed();
  }

  selectAll() {
    this.setSelection(this.store.getDoc().order);
  }

  setEditing(id: string | null) {
    this.editingId = id;
    this.editingEntry = null;
    this.changed();
  }

  // ---------------------------------------------------------------- camera

  setCamera(camera: Camera) {
    this.camera = camera;
    this.changed();
  }

  screenToWorld(point: Vec) { return screenToWorld(this.camera, point); }
  worldToScreen(point: Vec) { return worldToScreen(this.camera, point); }

  zoomIn() { this.setCamera(zoomTo(this.camera, this.size, clampZoom(this.camera.z * 1.25))); }
  zoomOut() { this.setCamera(zoomTo(this.camera, this.size, clampZoom(this.camera.z / 1.25))); }
  resetZoom() { this.setCamera(zoomTo(this.camera, this.size, 1)); }

  zoomToFit() {
    const items = this.store.getItems();
    if (items.length === 0) return this.resetZoom();
    this.setCamera(cameraForBounds(unionBounds(items.map(itemBounds)), this.size));
  }

  zoomToSelection() {
    const items = this.getSelectedItems();
    if (items.length === 0) return;
    this.setCamera(cameraForBounds(unionBounds(items.map(itemBounds)), this.size, 120));
  }

  // ----------------------------------------------------------- hit testing

  /** Topmost item under a world point, or null. */
  hitTest(point: Vec): AnyItem | null {
    const items = this.store.getItems();
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (this.hitsItem(item, point)) return item;
    }
    return null;
  }

  private hitsItem(item: AnyItem, point: Vec): boolean {
    const slop = STROKE_HIT / this.camera.z;
    if (item.type === "draw") {
      const points = item.props.points;
      for (let i = 1; i < points.length; i++) {
        if (distanceToSegment(point, points[i - 1], points[i]) <= slop + item.props.width / 2) {
          return true;
        }
      }
      return false;
    }
    if (item.type === "arrow") {
      const { start, end } = resolveArrowEndpoints(this.store, item);
      return distanceToSegment(point, start, end) <= slop;
    }
    if (item.type === "shape" && !item.props.fill) {
      // Unfilled shapes are grabbed by their outline, not their empty middle.
      const b = itemBounds(item);
      const inner = { x: b.x + slop, y: b.y + slop, w: b.w - slop * 2, h: b.h - slop * 2 };
      return rectContains(b, point) && !rectContains(inner, point);
    }
    return rectContains(itemBounds(item), point);
  }

  private handleAt(screenPoint: Vec): HandleId | null {
    if (this.selection.size === 0 || this.readonly) return null;
    if (this.getSelectedItems().some((item) => item.locked)) return null;
    const bounds = unionBounds(this.getSelectedItems().map(itemBounds));
    for (const handle of HANDLES) {
      const screen = worldToScreen(this.camera, handlePoint(bounds, handle));
      if (Math.abs(screen.x - screenPoint.x) <= HANDLE_HIT && Math.abs(screen.y - screenPoint.y) <= HANDLE_HIT) {
        return handle;
      }
    }
    return null;
  }

  /** A selected arrow gets its own start/end circles instead of the generic
   *  8-box — dragging one rebinds that end to whatever it's dropped on. */
  private arrowEndpointAt(screenPoint: Vec): "start" | "end" | null {
    if (this.selection.size !== 1 || this.readonly) return null;
    const item = this.getSelectedItems()[0];
    if (!item || item.type !== "arrow" || item.locked) return null;
    const { start, end } = resolveArrowEndpoints(this.store, item);
    const startScreen = worldToScreen(this.camera, start);
    const endScreen = worldToScreen(this.camera, end);
    if (distance(startScreen, screenPoint) <= HANDLE_HIT + 4) return "start";
    if (distance(endScreen, screenPoint) <= HANDLE_HIT + 4) return "end";
    return null;
  }

  // -------------------------------------------------------------- creating

  createItem<T extends ItemType>(type: T, world: Vec, props?: Partial<AnyItem["props"]>): AnyItem {
    const size = DEFAULT_SIZES[type];
    const base = defaultProps(type) as Record<string, unknown>;
    // The armed pen colour applies to things that draw with it (notes,
    // shapes, strokes, arrows). A to-do's card tint is a separate choice made
    // through the selection toolbar afterwards, so it keeps its own default —
    // white, matching the reference — regardless of what colour is armed.
    if ("color" in base && type !== "text" && type !== "todo") base.color = this.color;
    const item = {
      id: crypto.randomUUID(),
      type,
      x: world.x - size.w / 2,
      y: world.y - size.h / 2,
      w: size.w,
      h: size.h,
      rotation: 0,
      props: { ...base, ...props },
    } as AnyItem;
    this.store.transact(() => this.store.put(item));
    return item;
  }

  deleteSelection() {
    if (this.readonly || this.selection.size === 0) return;
    const ids = [...this.selection];
    this.store.transact(() => this.store.remove(ids));
    this.setSelection([]);
  }

  duplicateSelection() {
    if (this.readonly || this.selection.size === 0) return;
    const OFFSET = 24;
    const copies: AnyItem[] = this.getSelectedItems().map((item) => {
      const id = crypto.randomUUID();
      if (item.type === "draw") {
        return {
          ...item,
          id,
          x: item.x + OFFSET,
          y: item.y + OFFSET,
          props: { ...item.props, points: item.props.points.map((p) => ({ x: p.x + OFFSET, y: p.y + OFFSET })) },
        };
      }
      if (item.type === "arrow") {
        // Bindings aren't copied: the resolved (not stored) position is what
        // moves, and a bound end ignores its stored coordinates entirely, so
        // carrying the binding over would leave that end snapped back onto
        // the original's target — invisibly undoing the offset for exactly
        // the end a viewer would expect to have moved.
        const { start, end } = resolveArrowEndpoints(this.store, item);
        return {
          ...item,
          id,
          x: start.x + OFFSET,
          y: start.y + OFFSET,
          props: {
            ...item.props,
            end: { x: end.x + OFFSET, y: end.y + OFFSET },
            startBinding: undefined,
            endBinding: undefined,
          },
        };
      }
      return { ...item, id, x: item.x + OFFSET, y: item.y + OFFSET };
    });
    this.store.transact(() => {
      for (const copy of copies) this.store.put(copy);
    });
    this.setSelection(copies.map((c) => c.id));
  }

  // ------------------------------------------------------------- interaction

  onPointerDown(screen: Vec, opts: { shift: boolean; middle: boolean; alt: boolean }) {
    const world = this.screenToWorld(screen);

    if (opts.middle || this.spaceDown || this.tool === "hand") {
      this.interaction = { kind: "pan", last: screen };
      return;
    }

    // Every one of these already syncs continuously via onChange (see
    // TextOverlay/TodoEntryOverlay/RenameOverlay), so clearing them here never
    // loses anything — but it still has to call changed(), or the DOM overlay
    // can go stale until some unrelated later event happens to repaint.
    if (this.editingId) this.setEditing(null);
    if (this.editingEntry) {
      this.editingEntry = null;
      this.changed();
    }
    if (this.renaming) {
      this.renaming = null;
      this.changed();
    }

    if (!this.readonly) {
      if (this.tool === "eraser") {
        this.interaction = { kind: "erase" };
        return this.eraseAt(world);
      }
      if (this.tool === "draw") return this.beginDraw(world);
      if (this.tool === "arrow") return this.beginArrow(world);
      if (PLACING_TOOLS.includes(this.tool)) return this.placeWithTool(world);
    }

    const arrowEnd = this.arrowEndpointAt(screen);
    if (arrowEnd) {
      const item = this.getSelectedItems()[0];
      this.interaction = { kind: "arrowEndpoint", itemId: item.id, end: arrowEnd };
      return;
    }

    const handle = this.handleAt(screen);
    if (handle) {
      this.interaction = {
        kind: "resize",
        handle,
        startBounds: unionBounds(this.getSelectedItems().map(itemBounds)),
        startItems: this.getSelectedItems(),
      };
      return;
    }

    const hit = this.hitTest(world);
    if (!hit) {
      this.interaction = {
        kind: "marquee",
        originScreen: screen,
        currentScreen: screen,
        additive: opts.shift,
        base: opts.shift ? new Set(this.selection) : new Set(),
      };
      if (!opts.shift) this.setSelection([]);
      return;
    }

    // A checkbox reacts on the first click, whether or not the card was
    // already selected — that's how every to-do list behaves, and waiting
    // for a select-then-click would make ticking things off tedious.
    if (!this.readonly && !opts.shift && !hit.locked && hit.type === "todo") {
      const rowHit = todoRowAt(hit, world);
      if (rowHit?.zone === "checkbox" && !rowHit.row.isPlaceholder) {
        this.setSelection([hit.id]);
        this.toggleEntryDone(hit.id, rowHit.row.entry.id);
        return;
      }
    }

    // A folder/document's name is its rename target — clicking directly on it
    // opens rename immediately, the way a file manager's label click does.
    // Double-clicking the *tile* still opens the board/document as normal;
    // this only fires for the label underneath it.
    if (
      !this.readonly &&
      !opts.shift &&
      !hit.locked &&
      (hit.type === "board" || hit.type === "document") &&
      rectContains(containerLabelRect(hit), world)
    ) {
      this.beginRename(hit.id);
      return;
    }

    if (opts.shift) {
      const next = new Set(this.selection);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      this.setSelection([...next]);
      return;
    }

    if (!this.selection.has(hit.id)) this.setSelection([hit.id]);
    if (this.readonly || hit.locked) return;
    // A bound arrow's shape is derived from its target(s), not draggable as a
    // whole — only its free end(s) move, via the handle check above. Without
    // this, dragging the body would silently detach it from what it was
    // pointing at, which is never what the click meant.
    if (hit.type === "arrow" && (hit.props.startBinding || hit.props.endBinding)) return;
    this.interaction = { kind: "maybeDrag", origin: world, itemId: hit.id, additive: false };
  }

  onPointerMove(screen: Vec) {
    const world = this.screenToWorld(screen);

    switch (this.interaction.kind) {
      case "none": {
        const hit = this.hitTest(world);
        const id = hit?.id ?? null;
        if (id !== this.hovered) {
          this.hovered = id;
          this.changed();
        }
        return;
      }
      case "pan": {
        const delta = { x: screen.x - this.interaction.last.x, y: screen.y - this.interaction.last.y };
        this.interaction = { kind: "pan", last: screen };
        this.setCamera(panBy(this.camera, { x: -delta.x, y: -delta.y }));
        return;
      }
      case "maybeDrag": {
        const moved = Math.hypot(world.x - this.interaction.origin.x, world.y - this.interaction.origin.y);
        if (moved * this.camera.z < DRAG_THRESHOLD) return;
        const startPositions = new Map<string, Vec>();
        for (const item of this.getSelectedItems()) startPositions.set(item.id, { x: item.x, y: item.y });
        this.interaction = { kind: "drag", origin: this.interaction.origin, startPositions };
        return;
      }
      case "drag": {
        const { origin, startPositions } = this.interaction;
        const dx = world.x - origin.x;
        const dy = world.y - origin.y;
        this.store.transact(() => {
          for (const [id, start] of startPositions) {
            const item = this.store.getItem(id);
            if (!item) continue;
            this.moveItem(item, start.x + dx, start.y + dy);
          }
        });
        return;
      }
      case "resize": {
        const next = resizeBounds(this.interaction.startBounds, this.interaction.handle, world);
        const from = this.interaction.startBounds;
        const startItems = this.interaction.startItems;
        this.store.transact(() => {
          for (const start of startItems) {
            const mapped = {
              x: remapPoint({ x: start.x, y: start.y }, from, next).x,
              y: remapPoint({ x: start.x, y: start.y }, from, next).y,
            };
            const scaleX = from.w === 0 ? 1 : next.w / from.w;
            const scaleY = from.h === 0 ? 1 : next.h / from.h;
            this.store.update(start.id, {
              x: mapped.x,
              y: mapped.y,
              w: Math.max(8, start.w * scaleX),
              h: Math.max(8, start.h * scaleY),
            });
            this.rescaleInnerPoints(start, from, next);
          }
        });
        return;
      }
      case "marquee": {
        this.interaction = { ...this.interaction, currentScreen: screen };
        const rectScreen = normalizeRect(this.interaction.originScreen, screen);
        const topLeft = this.screenToWorld({ x: rectScreen.x, y: rectScreen.y });
        const worldRect = {
          x: topLeft.x,
          y: topLeft.y,
          w: rectScreen.w / this.camera.z,
          h: rectScreen.h / this.camera.z,
        };
        const inside = this.store
          .getItems()
          .filter((item) => rectsIntersect(itemBounds(item), worldRect))
          .map((item) => item.id);
        this.selection = new Set([...this.interaction.base, ...inside]);
        this.changed();
        return;
      }
      case "draw": {
        const item = this.store.getItem(this.interaction.id);
        if (!item || item.type !== "draw") return;
        const points = [...item.props.points, world];
        const bounds = boundsOfPoints(points);
        this.store.transact(() => {
          this.store.updateProps(item.id, { points } as never);
          this.store.update(item.id, bounds);
        });
        return;
      }
      case "arrow": {
        const item = this.store.getItem(this.interaction.id);
        if (!item || item.type !== "arrow") return;
        const target = this.bindableTargetAt(world, item.id);
        const end = target ? anchorPoint(target, anchorFor(target, world)) : world;
        this.store.transact(() => {
          this.store.updateProps(item.id, {
            end,
            endBinding: target ? { itemId: target.id, anchor: anchorFor(target, world) } : undefined,
          } as never);
          // item.x/y is the start point itself, not a bounding-box corner —
          // it must stay exactly what beginArrow set it to. w/h are only an
          // approximate box for legacy/culling purposes, never re-derived
          // into x/y (an arrow drawn up-and-left previously got its start
          // silently overwritten with the box's top-left corner here).
          this.store.update(item.id, { w: Math.abs(end.x - item.x), h: Math.abs(end.y - item.y) });
        });
        return;
      }
      case "arrowEndpoint": {
        const { itemId, end } = this.interaction;
        const item = this.store.getItem(itemId);
        if (!item || item.type !== "arrow") return;
        const target = this.bindableTargetAt(world, itemId);
        const anchor = target ? anchorFor(target, world) : null;
        const point = target && anchor ? anchorPoint(target, anchor) : world;
        const binding = target && anchor ? { itemId: target.id, anchor } : undefined;
        const other = resolveArrowEndpoints(this.store, item)[end === "start" ? "end" : "start"];
        const [newStart, newEnd] = end === "start" ? [point, other] : [other, point];
        this.store.transact(() => {
          if (end === "start") {
            this.store.update(itemId, { x: point.x, y: point.y });
            this.store.updateProps(itemId, { startBinding: binding } as never);
          } else {
            this.store.updateProps(itemId, { end: point, endBinding: binding } as never);
          }
          this.store.update(itemId, { w: Math.abs(newEnd.x - newStart.x), h: Math.abs(newEnd.y - newStart.y) });
        });
        return;
      }
      case "erase":
        return this.eraseAt(world);
      case "createShape": {
        const { origin, id } = this.interaction;
        const rect = normalizeRect(origin, world);
        this.store.transact(() => {
          this.store.update(id, {
            x: rect.x,
            y: rect.y,
            w: Math.max(8, rect.w),
            h: Math.max(8, rect.h),
          });
        });
        return;
      }
    }
  }

  onPointerUp() {
    const interaction = this.interaction;
    this.interaction = { kind: "none" };

    if (interaction.kind === "draw" || interaction.kind === "arrow") {
      const item = this.store.getItem(interaction.id);
      // A tap with no movement leaves a degenerate stroke/arrow behind.
      if (item && item.w < 2 && item.h < 2) this.store.transact(() => this.store.remove([item.id]));
      this.setTool("select");
    }
    if (interaction.kind === "createShape") {
      this.setSelection([interaction.id]);
      this.setTool("select");
    }
    this.changed();
  }

  private moveItem(item: AnyItem, x: number, y: number) {
    const dx = x - item.x;
    const dy = y - item.y;
    if (item.type === "draw") {
      this.store.updateProps(item.id, {
        points: item.props.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      } as never);
    } else if (item.type === "arrow") {
      this.store.updateProps(item.id, {
        end: { x: item.props.end.x + dx, y: item.props.end.y + dy },
      } as never);
    }
    this.store.update(item.id, { x, y });
  }

  /** Draw strokes and arrows carry geometry inside their props, which has to
   *  follow the box when the box is resized. */
  private rescaleInnerPoints(start: AnyItem, from: Rect, to: Rect) {
    if (start.type === "draw") {
      this.store.updateProps(start.id, {
        points: start.props.points.map((p) => remapPoint(p, from, to)),
      } as never);
    } else if (start.type === "arrow") {
      this.store.updateProps(start.id, { end: remapPoint(start.props.end, from, to) } as never);
    }
  }

  /** The eraser only takes freehand strokes and arrows — the ink, not the
   *  content. Deleting a note by brushing past it would be far too easy. */
  private eraseAt(world: Vec) {
    const doomed = this.store
      .getItems()
      .filter((item) => (item.type === "draw" || item.type === "arrow") && this.hitsItem(item, world))
      .map((item) => item.id);
    if (doomed.length > 0) this.store.transact(() => this.store.remove(doomed));
  }

  private beginDraw(world: Vec) {
    const item = this.createItem("draw", world, {
      points: [world],
      color: this.color,
      width: this.strokeWidth,
      highlighter: this.highlighter,
    });
    this.store.transact(() => this.store.update(item.id, boundsOfPoints([world])));
    this.interaction = { kind: "draw", id: item.id };
  }

  toggleEntryDone(itemId: string, entryId: string) {
    const item = this.store.getItem(itemId);
    if (!item || item.type !== "todo") return;
    const entries = item.props.entries.map((e) => (e.id === entryId ? { ...e, done: !e.done } : e));
    this.store.transact(() => this.store.updateProps(itemId, { entries } as never));
  }

  updateEntryText(itemId: string, entryId: string, text: string) {
    const item = this.store.getItem(itemId);
    if (!item || item.type !== "todo") return;
    const entries = item.props.entries.map((e) => (e.id === entryId ? { ...e, text } : e));
    this.store.transact(() => this.store.updateProps(itemId, { entries } as never));
  }

  /** Enter in a row: commit it and open a fresh empty row right after it. */
  addEntryAfter(itemId: string, entryId: string) {
    const item = this.store.getItem(itemId);
    if (!item || item.type !== "todo") return;
    const index = item.props.entries.findIndex((e) => e.id === entryId);
    const entry = { id: crypto.randomUUID(), text: "", done: false };
    const entries = [...item.props.entries];
    entries.splice(index + 1, 0, entry);
    this.store.transact(() => this.store.updateProps(itemId, { entries } as never));
    this.editingEntry = { itemId, entryId: entry.id };
    this.changed();
  }

  /** Backspace on an empty row: remove it and drop back into the row above,
   *  at the end of its text — the usual "merge into previous line" feel. */
  removeEntryAndFocusPrevious(itemId: string, entryId: string) {
    const item = this.store.getItem(itemId);
    if (!item || item.type !== "todo") return;
    const index = item.props.entries.findIndex((e) => e.id === entryId);
    if (index === -1) return;
    const entries = item.props.entries.filter((e) => e.id !== entryId);
    this.store.transact(() => this.store.updateProps(itemId, { entries } as never));
    this.editingEntry = index > 0 ? { itemId, entryId: entries[index - 1].id } : null;
    this.changed();
  }

  /**
   * Opens a row for editing. `entryId` names a real entry, or is omitted /
   * "placeholder" to mean "the empty row" — which doesn't exist in the
   * document yet, so this is also how a to-do gets its first real entry.
   */
  beginTodoEntry(itemId: string, entryId?: string) {
    const item = this.store.getItem(itemId);
    if (!item || item.type !== "todo" || this.readonly) return;
    let target = entryId;
    if (!target || target === "placeholder" || item.props.entries.length === 0) {
      const entry = { id: crypto.randomUUID(), text: "", done: false };
      this.store.transact(() =>
        this.store.updateProps(itemId, { entries: [...item.props.entries, entry] } as never),
      );
      target = entry.id;
    }
    this.setSelection([itemId]);
    this.editingEntry = { itemId, entryId: target };
    this.changed();
  }

  beginRename(itemId: string) {
    const item = this.store.getItem(itemId);
    if (!item || this.readonly || (item.type !== "board" && item.type !== "document")) return;
    this.setSelection([itemId]);
    this.renaming = itemId;
    this.changed();
  }

  endRename() {
    this.renaming = null;
    this.changed();
  }

  renameItem(itemId: string, title: string) {
    const item = this.store.getItem(itemId);
    if (!item || (item.type !== "board" && item.type !== "document")) return;
    this.store.transact(() => this.store.updateProps(itemId, { title } as never));
  }

  private beginArrow(world: Vec) {
    // Starting a drag from on top of an item binds the tail end to it
    // immediately — matches every diagramming tool's "drag from the box"
    // gesture, rather than requiring a separate step to connect afterwards.
    const target = this.bindableTargetAt(world, "");
    const start = target ? anchorPoint(target, anchorFor(target, world)) : world;
    const item = this.createItem("arrow", world, {
      end: start,
      color: this.color,
      width: Math.max(2, this.strokeWidth / 2),
      startBinding: target ? { itemId: target.id, anchor: anchorFor(target, world) } : undefined,
    });
    this.store.transact(() =>
      this.store.update(item.id, { x: start.x, y: start.y, w: 0, h: 0 }),
    );
    this.interaction = { kind: "arrow", id: item.id };
  }

  /** Topmost non-arrow/draw item whose bounds contain `point`, ignoring
   *  `excludeId` — the pool of things an arrow end can bind to. */
  private bindableTargetAt(point: Vec, excludeId: string): AnyItem | null {
    const items = this.store.getItems();
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (item.id === excludeId || item.type === "arrow" || item.type === "draw") continue;
      if (rectContains(itemBounds(item), point)) return item;
    }
    return null;
  }

  private placeWithTool(world: Vec) {
    if (this.tool === "shape") {
      const item = this.createItem("shape", world, { kind: this.shapeKind });
      this.store.transact(() =>
        this.store.update(item.id, { x: world.x, y: world.y, w: 8, h: 8 }),
      );
      this.interaction = { kind: "createShape", id: item.id, origin: world };
      return;
    }
    const item = this.createItem(this.tool as "note" | "text" | "todo" | "document", world);
    this.setTool("select");
    if (item.type === "todo") {
      this.beginTodoEntry(item.id);
      return;
    }
    this.setSelection([item.id]);
    if (item.type === "note" || item.type === "text") {
      this.emit({ type: "requestEdit", itemId: item.id });
    }
  }

  onDoubleClick(screen: Vec) {
    const world = this.screenToWorld(screen);
    const hit = this.hitTest(world);
    if (!hit) {
      if (!this.readonly) {
        const item = this.createItem("note", world);
        this.setSelection([item.id]);
        this.emit({ type: "requestEdit", itemId: item.id });
      }
      return;
    }
    if (hit.type === "board") return this.emit({ type: "openBoard", nodeId: hit.props.nodeId });
    if (hit.type === "link" && hit.props.url) return void window.open(hit.props.url, "_blank", "noreferrer");
    if (hit.type === "file" && hit.props.src) return void window.open(hit.props.src, "_blank", "noreferrer");
    if (this.readonly) return;
    // An image is created empty and gets its picture on double-click, so the
    // card exists on the board before the file dialog ever opens.
    if (hit.type === "image") return this.emit({ type: "requestImage", itemId: hit.id });
    // A document is too long-form for the canvas; it opens in its own window.
    if (hit.type === "document") return this.emit({ type: "requestDocument", itemId: hit.id });
    if (hit.type === "todo") {
      const rowHit = todoRowAt(hit, world);
      return this.beginTodoEntry(hit.id, rowHit && !rowHit.row.isPlaceholder ? rowHit.row.entry.id : undefined);
    }
    if (hit.type === "note" || hit.type === "text") {
      this.emit({ type: "requestEdit", itemId: hit.id });
    }
  }

  /**
   * Trackpads send pinch as ctrl+wheel and two-finger scroll as plain wheel;
   * mouse wheels send plain wheel with large deltas. Treating ctrl as zoom and
   * everything else as pan matches what both devices expect.
   */
  onWheel(screen: Vec, delta: Vec, ctrl: boolean) {
    if (ctrl) {
      this.setCamera(zoomAround(this.camera, screen, Math.exp(-delta.y * 0.01)));
    } else {
      this.setCamera(panBy(this.camera, { x: -delta.x, y: -delta.y }));
    }
  }

  setSpaceDown(down: boolean) {
    this.spaceDown = down;
  }

  /**
   * Two-finger gesture: zoom about the pinch midpoint and pan by how far that
   * midpoint moved, applied together so the board tracks the fingers instead
   * of drifting.
   */
  pinch(anchor: Vec, factor: number, pan: Vec) {
    this.setCamera(panBy(zoomAround(this.camera, anchor, factor), { x: -pan.x, y: -pan.y }));
  }

  /** Aborts whatever the pointer was doing — used when a second finger lands
   *  and the gesture turns out to be a pinch, not a drag. */
  cancelInteraction() {
    if (this.interaction.kind === "none") return;
    if (this.interaction.kind === "erase") {
      this.interaction = { kind: "none" };
      return this.changed();
    }
    if (this.interaction.kind === "draw" || this.interaction.kind === "arrow" || this.interaction.kind === "createShape") {
      const id = this.interaction.id;
      this.store.transact(() => this.store.remove([id]));
    }
    this.interaction = { kind: "none" };
    this.changed();
  }

  // -------------------------------------------------------------- commands

  undo() { this.store.undo(); }
  redo() { this.store.redo(); }
  canUndo() { return this.store.canUndo(); }
  canRedo() { return this.store.canRedo(); }

  /** True when every selected item is locked — the toolbar shows the state of
   *  the selection as a whole, so a mixed selection reads as unlocked. */
  isSelectionLocked() {
    const items = this.getSelectedItems();
    return items.length > 0 && items.every((item) => item.locked);
  }

  toggleSelectionLock() {
    if (this.readonly || this.selection.size === 0) return;
    const locked = !this.isSelectionLocked();
    this.store.transact(() => {
      for (const id of this.selection) this.store.update(id, { locked });
    });
  }

  /** Screen-space bounds of the current selection, for positioning DOM chrome
   *  over the canvas. Null when nothing is selected. */
  getSelectionScreenRect(): Rect | null {
    const items = this.getSelectedItems();
    if (items.length === 0) return null;
    const bounds = unionBounds(items.map(itemBounds));
    const topLeft = this.worldToScreen({ x: bounds.x, y: bounds.y });
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bounds.w * this.camera.z,
      h: bounds.h * this.camera.z,
    };
  }

  bringToFront() {
    if (this.selection.size === 0) return;
    this.store.transact(() => this.store.bringToFront([...this.selection]));
  }

  sendToBack() {
    if (this.selection.size === 0) return;
    this.store.transact(() => this.store.sendToBack([...this.selection]));
  }
}
