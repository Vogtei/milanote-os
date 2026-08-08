import * as Y from "yjs";
import type { AnyItem, Doc, TrashEntry } from "@/canvas/types";
import { emptyDoc } from "@/canvas/types";
import { createYDoc, itemToYMap, materializeDoc, yMapToItem } from "@/canvas/yjsDoc";

/** How many recently-deleted items the per-board trash keeps before the
 *  oldest is silently dropped. */
const TRASH_LIMIT = 15;

export type Listener = () => void;

/** Origin tag for this store instance's own local edits. Y.UndoManager only
 *  tracks this origin, so a remote peer's transactions — which arrive over
 *  the wire with a different origin — never land on *this* client's undo
 *  stack (undoing wouldn't revert someone else's edit out from under them).
 *  restoreItem() deliberately transacts under a different, untracked origin
 *  for the same reason it always has: restoring from the trash isn't itself
 *  an undoable step (see restoreItem below). */
const LOCAL_ORIGIN = Symbol("local");
const UNTRACKED_ORIGIN = Symbol("untracked");

// Document state with undo/redo, backed by a Y.Doc so it can be shared over
// a websocket without a translation layer (see yjsDoc.ts). The public API
// below is unchanged from the pre-Yjs version — every consumer (editor.ts,
// every canvas component) keeps working exactly as before; only the
// internal representation and the undo mechanism changed.
export class BoardStore {
  readonly ydoc: Y.Doc;
  private items: Y.Map<Y.Map<unknown>>;
  private order: Y.Array<string>;
  private trashedItems: Y.Array<TrashEntry>;
  private undoManager: Y.UndoManager;
  private listeners = new Set<Listener>();

  /** Lazily rebuilt plain-JSON view of the doc, invalidated on every
   *  transaction. VosCanvas reads getItems() on every animation frame, so
   *  this avoids re-walking the whole Y.Doc on every read — only on the
   *  first read after something actually changed. */
  private materialized: Doc | null = null;

  constructor(doc: Doc = emptyDoc()) {
    this.ydoc = createYDoc(doc);
    this.items = this.ydoc.getMap("items");
    this.order = this.ydoc.getArray("order");
    this.trashedItems = this.ydoc.getArray("trashedItems");
    this.undoManager = new Y.UndoManager([this.items, this.order], {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      // Disabled so every transact() call is its own undo step, matching
      // the pre-Yjs store's one-Change-per-transaction granularity exactly
      // (Yjs's default merges same-origin transactions within 500ms into
      // one step, which would silently change how many Ctrl+Z presses a
      // gesture takes).
      captureTimeout: 0,
    });
    this.ydoc.on("afterTransaction", () => {
      this.materialized = null;
      this.emit();
    });
  }

  private getMaterialized(): Doc {
    if (!this.materialized) this.materialized = materializeDoc(this.ydoc);
    return this.materialized;
  }

  getDoc(): Doc {
    return this.getMaterialized();
  }

  getItem(id: string): AnyItem | undefined {
    return this.getMaterialized().items[id];
  }

  /** Bottom-to-top. */
  getItems(): AnyItem[] {
    const doc = this.getMaterialized();
    return doc.order.map((id) => doc.items[id]).filter(Boolean);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  /**
   * Groups every mutation inside `fn` into one Yjs transaction — Yjs itself
   * collapses nested transact() calls on the same doc into the outermost
   * one, so a high-level command can call lower-level store methods (which
   * each open their own transact()) without producing several history
   * entries or several emit()s.
   */
  transact<T>(fn: () => T): T {
    let result!: T;
    this.ydoc.transact(() => {
      result = fn();
    }, LOCAL_ORIGIN);
    return result;
  }

  private setOrder(next: string[]) {
    this.order.delete(0, this.order.length);
    if (next.length > 0) this.order.insert(0, next);
  }

  put(item: AnyItem) {
    this.transact(() => {
      const isNew = !this.items.has(item.id);
      this.items.set(item.id, itemToYMap(item));
      if (isNew) this.order.push([item.id]);
    });
  }

  update(id: string, patch: Partial<AnyItem>) {
    const map = this.items.get(id);
    if (!map) return;
    this.transact(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) map.set(key, value);
      }
    });
  }

  updateProps(id: string, props: Partial<AnyItem["props"]>) {
    const map = this.items.get(id);
    if (!map) return;
    this.transact(() => {
      const current = (map.get("props") as object | undefined) ?? {};
      map.set("props", { ...current, ...props });
    });
  }

  remove(ids: string[]) {
    const present = ids.filter((id) => this.items.has(id));
    if (present.length === 0) return;
    const removed = new Set(present);
    this.transact(() => {
      for (const id of present) this.items.delete(id);
      this.setOrder(this.order.toArray().filter((id) => !removed.has(id)));
    });
  }

  getTrashedItems(): TrashEntry[] {
    return this.getMaterialized().trashedItems;
  }

  /** Captures each item as it is now, then removes it the normal (undo-
   *  tracked) way. The trash-list mutation itself is not undo-tracked (the
   *  Y.UndoManager above only watches `items`/`order`, never `trashedItems`)
   *  — undoing the deletion brings the item back on the canvas but leaves
   *  its trash entry in place, same as Milanote's own recycle bin. */
  trashItems(ids: string[]) {
    const present = ids.filter((id) => this.items.has(id));
    if (present.length === 0) return;
    this.transact(() => {
      const entries: TrashEntry[] = present.map((id) => ({
        item: yMapToItem(this.items.get(id)!),
        deletedAt: new Date().toISOString(),
      }));
      const next = [...entries, ...this.trashedItems.toArray()].slice(0, TRASH_LIMIT);
      this.trashedItems.delete(0, this.trashedItems.length);
      this.trashedItems.insert(0, next);
      this.remove(present);
    });
  }

  /** Puts a trashed item back on the canvas at its original position, on top
   *  of the paint order. Transacts under an origin the Y.UndoManager doesn't
   *  track, so — like before — restoring isn't itself an undoable step. */
  restoreItem(id: string) {
    const entries = this.trashedItems.toArray();
    const index = entries.findIndex((e) => e.item.id === id);
    if (index === -1) return;
    const entry = entries[index];
    this.ydoc.transact(() => {
      this.items.set(id, itemToYMap(entry.item));
      this.order.push([id]);
      this.trashedItems.delete(index, 1);
    }, UNTRACKED_ORIGIN);
  }

  /** Moves `ids` to the top of the paint order, preserving their relative order. */
  bringToFront(ids: string[]) {
    const moving = new Set(ids);
    const current = this.order.toArray();
    const rest = current.filter((id) => !moving.has(id));
    const lifted = current.filter((id) => moving.has(id));
    if (lifted.length === 0) return;
    this.transact(() => this.setOrder([...rest, ...lifted]));
  }

  sendToBack(ids: string[]) {
    const moving = new Set(ids);
    const current = this.order.toArray();
    const rest = current.filter((id) => !moving.has(id));
    const lowered = current.filter((id) => moving.has(id));
    if (lowered.length === 0) return;
    this.transact(() => this.setOrder([...lowered, ...rest]));
  }

  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  undo(): void {
    this.undoManager.undo();
  }

  redo(): void {
    this.undoManager.redo();
  }

  /** Wholesale replace — seeding from a server load or an offline-cache
   *  snapshot. Deliberately clears history: undoing past a load makes no
   *  sense. */
  load(doc: Doc) {
    this.ydoc.transact(() => {
      this.items.clear();
      this.setOrder([]);
      this.trashedItems.delete(0, this.trashedItems.length);
      for (const id of doc.order) {
        const item = doc.items[id];
        if (item) this.items.set(id, itemToYMap(item));
      }
      if (doc.order.length > 0) this.order.insert(0, doc.order.slice());
      if (doc.trashedItems.length > 0) this.trashedItems.insert(0, doc.trashedItems.slice());
    }, UNTRACKED_ORIGIN);
    this.undoManager.clear();
  }
}
