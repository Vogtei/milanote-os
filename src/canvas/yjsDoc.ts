import * as Y from "yjs";
import type { AnyItem, Doc, TrashEntry } from "@/canvas/types";
import { emptyDoc } from "@/canvas/types";

// Bridges the plain-JSON Doc model (types.ts) to a Y.Doc CRDT representation
// and back. Shared by the client store (store.ts) and the collab server's
// per-board room, so this conversion exists in exactly one place instead of
// two hand-rolled copies drifting apart.
//
// Item-level granularity, deliberately: `props` is stored as one opaque
// value per item, not decomposed into nested Y types. Concurrent edits to
// *different* items merge conflict-free (each item is its own Y.Map);
// concurrent edits to the same item's props are last-write-wins on that
// write, not a character-level text merge inside a note — a decomposed
// nested representation would only buy field-level merging the app doesn't
// want here.

const ITEM_FIELDS = ["id", "type", "x", "y", "w", "h", "rotation", "locked", "props"] as const;

export function itemToYMap(item: AnyItem): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  const record = item as unknown as Record<string, unknown>;
  for (const key of ITEM_FIELDS) {
    if (record[key] !== undefined) map.set(key, record[key]);
  }
  return map;
}

export function yMapToItem(map: Y.Map<unknown>): AnyItem {
  const record: Record<string, unknown> = {};
  for (const key of ITEM_FIELDS) {
    if (map.has(key)) record[key] = map.get(key);
  }
  return record as unknown as AnyItem;
}

export function createYDoc(doc: Doc = emptyDoc()): Y.Doc {
  const ydoc = new Y.Doc();
  const items = ydoc.getMap<Y.Map<unknown>>("items");
  const order = ydoc.getArray<string>("order");
  const trashedItems = ydoc.getArray<TrashEntry>("trashedItems");

  ydoc.transact(() => {
    for (const id of doc.order) {
      const item = doc.items[id];
      if (item) items.set(id, itemToYMap(item));
    }
    if (doc.order.length > 0) order.push(doc.order.slice());
    if (doc.trashedItems.length > 0) trashedItems.push(doc.trashedItems.slice());
  });

  return ydoc;
}

export function materializeDoc(ydoc: Y.Doc): Doc {
  const items = ydoc.getMap<Y.Map<unknown>>("items");
  const order = ydoc.getArray<string>("order");
  const trashedItems = ydoc.getArray<TrashEntry>("trashedItems");

  const itemsById: Record<string, AnyItem> = {};
  items.forEach((map, id) => {
    itemsById[id] = yMapToItem(map);
  });

  return {
    items: itemsById,
    order: order.toArray(),
    trashedItems: trashedItems.toArray(),
  };
}
