import type { AnyItem, Camera, Doc, ItemType, NoteColor, Rect, Vec } from "@/canvas/types";
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
import {
  boundsOfPoints,
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
  | "file"
  | "link"
  | "shape"
  | "draw"
  | "arrow";

/** Tools that place an item where you click/drag instead of selecting. */
const PLACING_TOOLS: ToolId[] = ["note", "text", "todo", "shape"];

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; last: Vec }
  | { kind: "maybeDrag"; origin: Vec; itemId: string; additive: boolean }
  | { kind: "drag"; origin: Vec; startPositions: Map<string, Vec> }
  | { kind: "resize"; handle: HandleId; startBounds: Rect; startItems: AnyItem[] }
  | { kind: "marquee"; originScreen: Vec; currentScreen: Vec; additive: boolean; base: Set<string> }
  | { kind: "draw"; id: string }
  | { kind: "arrow"; id: string }
  | { kind: "createShape"; id: string; origin: Vec };

const DRAG_THRESHOLD = 3;
const HANDLE_HIT = 10;
const STROKE_HIT = 8;

export type EditorEvent =
  | { type: "change" }
  | { type: "openBoard"; nodeId: string }
  | { type: "requestEdit"; itemId: string };

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
  private spaceDown = false;
  private listeners = new Set<(event: EditorEvent) => void>();
  private color: NoteColor = "yellow";
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
  getColor() { return this.color; }
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
      this.tool = "select";
    }
    this.changed();
  }

  setSize(size: { w: number; h: number }) {
    this.size = size;
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
      return distanceToSegment(point, { x: item.x, y: item.y }, item.props.end) <= slop;
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
    const bounds = unionBounds(this.getSelectedItems().map(itemBounds));
    for (const handle of HANDLES) {
      const screen = worldToScreen(this.camera, handlePoint(bounds, handle));
      if (Math.abs(screen.x - screenPoint.x) <= HANDLE_HIT && Math.abs(screen.y - screenPoint.y) <= HANDLE_HIT) {
        return handle;
      }
    }
    return null;
  }

  // -------------------------------------------------------------- creating

  createItem<T extends ItemType>(type: T, world: Vec, props?: Partial<AnyItem["props"]>): AnyItem {
    const size = DEFAULT_SIZES[type];
    const base = defaultProps(type) as Record<string, unknown>;
    if ("color" in base && type !== "text") base.color = this.color;
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
    const copies: AnyItem[] = this.getSelectedItems().map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      x: item.x + 24,
      y: item.y + 24,
    }));
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

    if (this.editingId) this.setEditing(null);

    if (!this.readonly) {
      if (this.tool === "draw") return this.beginDraw(world);
      if (this.tool === "arrow") return this.beginArrow(world);
      if (PLACING_TOOLS.includes(this.tool)) return this.placeWithTool(world);
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

    if (opts.shift) {
      const next = new Set(this.selection);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      this.setSelection([...next]);
      return;
    }

    if (!this.selection.has(hit.id)) this.setSelection([hit.id]);
    if (this.readonly) return;
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
        this.store.transact(() => {
          this.store.updateProps(item.id, { end: world } as never);
          this.store.update(item.id, boundsOfPoints([{ x: item.x, y: item.y }, world]));
        });
        return;
      }
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

  private beginDraw(world: Vec) {
    const item = this.createItem("draw", world, { points: [world], color: this.color, width: 4 });
    this.store.transact(() => this.store.update(item.id, boundsOfPoints([world])));
    this.interaction = { kind: "draw", id: item.id };
  }

  private beginArrow(world: Vec) {
    const item = this.createItem("arrow", world, { end: world, color: this.color, width: 2 });
    this.store.transact(() => this.store.update(item.id, { x: world.x, y: world.y, w: 0, h: 0 }));
    this.interaction = { kind: "arrow", id: item.id };
  }

  private placeWithTool(world: Vec) {
    if (this.tool === "shape") {
      const item = this.createItem("shape", world);
      this.store.transact(() =>
        this.store.update(item.id, { x: world.x, y: world.y, w: 8, h: 8 }),
      );
      this.interaction = { kind: "createShape", id: item.id, origin: world };
      return;
    }
    const item = this.createItem(this.tool as "note" | "text" | "todo", world);
    this.setTool("select");
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
    if (hit.type === "note" || hit.type === "text" || hit.type === "todo") {
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

  // -------------------------------------------------------------- commands

  undo() { this.store.undo(); }
  redo() { this.store.redo(); }
  canUndo() { return this.store.canUndo(); }
  canRedo() { return this.store.canRedo(); }

  bringToFront() {
    if (this.selection.size === 0) return;
    this.store.transact(() => this.store.bringToFront([...this.selection]));
  }

  sendToBack() {
    if (this.selection.size === 0) return;
    this.store.transact(() => this.store.sendToBack([...this.selection]));
  }
}
