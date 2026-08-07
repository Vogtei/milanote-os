import type { AnyItem, Doc, TrashEntry } from "@/canvas/types";
import { emptyDoc } from "@/canvas/types";

/** How many recently-deleted items the per-board trash keeps before the
 *  oldest is silently dropped. */
const TRASH_LIMIT = 15;

// Document state with undo/redo. History is stored as inverse patches (only
// the items a change actually touched) rather than whole-document snapshots,
// so a long editing session on a big board doesn't grow memory linearly with
// board size × edit count.

type ItemPatch = Record<string, AnyItem | null>;

type Change = {
  before: ItemPatch;
  after: ItemPatch;
  orderBefore: string[];
  orderAfter: string[];
};

export type Listener = () => void;

const HISTORY_LIMIT = 200;

export class BoardStore {
  private doc: Doc;
  private listeners = new Set<Listener>();
  private undoStack: Change[] = [];
  private redoStack: Change[] = [];

  /** Non-null while a transaction is open; collects the touched items. */
  private pending: { before: ItemPatch; orderBefore: string[] } | null = null;
  private depth = 0;

  constructor(doc: Doc = emptyDoc()) {
    this.doc = doc;
  }

  getDoc(): Doc {
    return this.doc;
  }

  getItem(id: string): AnyItem | undefined {
    return this.doc.items[id];
  }

  /** Bottom-to-top. */
  getItems(): AnyItem[] {
    return this.doc.order.map((id) => this.doc.items[id]).filter(Boolean);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  /**
   * Groups every mutation inside `fn` into one undo step. Nesting is allowed
   * and collapses into the outermost transaction, so a high-level command can
   * call lower-level ones without producing several history entries.
   */
  transact<T>(fn: () => T): T {
    if (this.depth > 0) {
      this.depth++;
      try {
        return fn();
      } finally {
        this.depth--;
      }
    }

    this.pending = { before: {}, orderBefore: this.doc.order };
    this.depth = 1;
    let result: T;
    try {
      result = fn();
    } finally {
      this.depth = 0;
    }

    const pending = this.pending;
    this.pending = null;

    const ids = Object.keys(pending.before);
    const orderChanged = pending.orderBefore !== this.doc.order;
    if (ids.length === 0 && !orderChanged) return result;

    const after: ItemPatch = {};
    for (const id of ids) after[id] = this.doc.items[id] ?? null;

    this.undoStack.push({
      before: pending.before,
      after,
      orderBefore: pending.orderBefore,
      orderAfter: this.doc.order,
    });
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
    return result;
  }

  /** Records an item's pre-change state exactly once per transaction. */
  private record(id: string) {
    if (!this.pending) return;
    if (!(id in this.pending.before)) {
      this.pending.before[id] = this.doc.items[id] ?? null;
    }
  }

  put(item: AnyItem) {
    this.record(item.id);
    const isNew = !(item.id in this.doc.items);
    this.doc = {
      ...this.doc,
      items: { ...this.doc.items, [item.id]: item },
      order: isNew ? [...this.doc.order, item.id] : this.doc.order,
    };
    if (this.depth === 0) this.emit();
  }

  update(id: string, patch: Partial<AnyItem>) {
    const current = this.doc.items[id];
    if (!current) return;
    this.record(id);
    this.doc = {
      ...this.doc,
      items: { ...this.doc.items, [id]: { ...current, ...patch } as AnyItem },
    };
    if (this.depth === 0) this.emit();
  }

  updateProps(id: string, props: Partial<AnyItem["props"]>) {
    const current = this.doc.items[id];
    if (!current) return;
    this.record(id);
    this.doc = {
      ...this.doc,
      items: {
        ...this.doc.items,
        [id]: { ...current, props: { ...current.props, ...props } } as AnyItem,
      },
    };
    if (this.depth === 0) this.emit();
  }

  remove(ids: string[]) {
    const present = ids.filter((id) => id in this.doc.items);
    if (present.length === 0) return;
    const items = { ...this.doc.items };
    for (const id of present) {
      this.record(id);
      delete items[id];
    }
    const removed = new Set(present);
    this.doc = { ...this.doc, items, order: this.doc.order.filter((id) => !removed.has(id)) };
    if (this.depth === 0) this.emit();
  }

  getTrashedItems(): TrashEntry[] {
    return this.doc.trashedItems;
  }

  /** Captures each item as it is now, then removes it the normal (undo-
   *  tracked) way. Deliberately outside any transaction: the trash list is a
   *  separate, persistent record, not an undo step — undoing the deletion
   *  brings the item back on the canvas but leaves its trash entry in place,
   *  same as Milanote's own recycle bin. */
  trashItems(ids: string[]) {
    const present = ids.filter((id) => id in this.doc.items);
    if (present.length === 0) return;
    const entries: TrashEntry[] = present.map((id) => ({
      item: this.doc.items[id],
      deletedAt: new Date().toISOString(),
    }));
    this.doc = {
      ...this.doc,
      trashedItems: [...entries, ...this.doc.trashedItems].slice(0, TRASH_LIMIT),
    };
    this.transact(() => this.remove(present));
  }

  /** Puts a trashed item back on the canvas at its original position, on top
   *  of the paint order. Not undo-tracked, mirroring trashItems(). */
  restoreItem(id: string) {
    const entry = this.doc.trashedItems.find((e) => e.item.id === id);
    if (!entry) return;
    this.doc = {
      items: { ...this.doc.items, [id]: entry.item },
      order: [...this.doc.order, id],
      trashedItems: this.doc.trashedItems.filter((e) => e.item.id !== id),
    };
    this.emit();
  }

  /** Moves `ids` to the top of the paint order, preserving their relative order. */
  bringToFront(ids: string[]) {
    const moving = new Set(ids);
    const rest = this.doc.order.filter((id) => !moving.has(id));
    const lifted = this.doc.order.filter((id) => moving.has(id));
    if (lifted.length === 0) return;
    this.doc = { ...this.doc, order: [...rest, ...lifted] };
    if (this.depth === 0) this.emit();
  }

  sendToBack(ids: string[]) {
    const moving = new Set(ids);
    const rest = this.doc.order.filter((id) => !moving.has(id));
    const lowered = this.doc.order.filter((id) => moving.has(id));
    if (lowered.length === 0) return;
    this.doc = { ...this.doc, order: [...lowered, ...rest] };
    if (this.depth === 0) this.emit();
  }

  private applyPatch(patch: ItemPatch, order: string[]) {
    const items = { ...this.doc.items };
    for (const [id, item] of Object.entries(patch)) {
      if (item === null) delete items[id];
      else items[id] = item;
    }
    this.doc = { ...this.doc, items, order };
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const change = this.undoStack.pop();
    if (!change) return;
    this.applyPatch(change.before, change.orderBefore);
    this.redoStack.push(change);
    this.emit();
  }

  redo() {
    const change = this.redoStack.pop();
    if (!change) return;
    this.applyPatch(change.after, change.orderAfter);
    this.undoStack.push(change);
    this.emit();
  }

  /** Wholesale replace — loading from the server, or a remote sync update.
   *  Deliberately clears history: undoing past a load makes no sense. */
  load(doc: Doc) {
    this.doc = doc;
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }
}
