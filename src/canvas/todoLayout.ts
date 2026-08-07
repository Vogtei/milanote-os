import type { Item, Rect, TodoEntry, Vec } from "@/canvas/types";
import { rectContains } from "@/canvas/geometry";

// Single source of truth for where a to-do card's rows sit, in world space.
// The renderer and the editor's hit-testing both call this — if they computed
// the layout independently, a checkbox click and its drawn checkbox could
// drift apart the moment one of the two files changed.

export const TODO_ROW_H = 26;
export const TODO_CHECKBOX = 15;
const TOP_PADDING = 16;
const TITLE_H = 26;
const BOTTOM_PADDING = 18;

export type TodoRow = {
  entry: TodoEntry;
  /** True for the single placeholder row shown when the list is empty — it
   *  doesn't exist in the document until someone actually types into it. */
  isPlaceholder: boolean;
  checkbox: Rect;
  text: Rect;
};

export function todoRows(item: Item<"todo">): TodoRow[] {
  const headerH = item.props.title ? TITLE_H : 0;
  const entries: TodoEntry[] =
    item.props.entries.length > 0
      ? item.props.entries
      : [{ id: "placeholder", text: "", done: false }];

  const rows: TodoRow[] = [];
  let y = item.y + TOP_PADDING + headerH;
  for (const entry of entries) {
    if (y > item.y + item.h - BOTTOM_PADDING) break;
    rows.push({
      entry,
      isPlaceholder: entry.id === "placeholder",
      checkbox: { x: item.x + 14, y, w: TODO_CHECKBOX, h: TODO_CHECKBOX },
      text: { x: item.x + 38, y: y - 1, w: item.w - 52, h: TODO_ROW_H },
    });
    y += TODO_ROW_H;
  }
  return rows;
}

/** The card height needed to show every row without clipping — a to-do has
 *  no manual resize handle (see geometry.ts's RESIZE_HANDLES), this is its
 *  only sizing mechanism, mirroring `todoRows`' own layout math so the two
 *  never drift apart.
 *
 *  `todoRows` stops once a row's *top* passes the bottom threshold — fine
 *  when there's slack, but using that same top-edge check as the required
 *  height left no room for the last row's own height (it clipped by
 *  TODO_ROW_H - BOTTOM_PADDING, ~8px). The required height has to clear the
 *  last row's *bottom* instead, i.e. count full rows, not count - 1. */
export function requiredTodoHeight(title: string, entryCount: number): number {
  const headerH = title ? TITLE_H : 0;
  const count = Math.max(1, entryCount);
  return TOP_PADDING + headerH + count * TODO_ROW_H + BOTTOM_PADDING;
}

export type TodoHit = { row: TodoRow; zone: "checkbox" | "text" };

export function todoRowAt(item: Item<"todo">, point: Vec): TodoHit | null {
  for (const row of todoRows(item)) {
    if (rectContains(row.checkbox, point)) return { row, zone: "checkbox" };
    if (rectContains({ x: row.text.x, y: row.checkbox.y, w: row.text.w, h: row.checkbox.h }, point)) {
      return { row, zone: "text" };
    }
  }
  return null;
}
