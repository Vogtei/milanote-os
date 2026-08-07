import type { AnyItem, ArrowBinding, Item, Vec } from "@/canvas/types";
import { itemBounds } from "@/canvas/geometry";

/** Minimal read access this module needs — satisfied by both BoardStore and
 *  the plain item-array export uses, without importing the store class. */
export type ItemLookup = { getItem(id: string): AnyItem | undefined };

/**
 * An arrow's actual endpoints, resolving any bindings against the target
 * items' *current* bounds. This is the only place that should read an
 * arrow's position — rendering and hit-testing both go through it, so a
 * bound end always tracks its target, and an unbound one falls back to the
 * item's own stored coordinates.
 */
export function resolveArrowEndpoints(
  items: ItemLookup,
  item: Item<"arrow">,
): { start: Vec; end: Vec } {
  return {
    start: resolveEnd(items, item.props.startBinding, { x: item.x, y: item.y }),
    end: resolveEnd(items, item.props.endBinding, item.props.end),
  };
}

function resolveEnd(items: ItemLookup, binding: ArrowBinding | undefined, fallback: Vec): Vec {
  if (!binding) return fallback;
  const target = items.getItem(binding.itemId);
  if (!target) return fallback;
  return anchorPoint(target, binding.anchor);
}

/** World point for a fractional anchor within `target`'s current bounds —
 *  the inverse of `anchorFor`. */
export function anchorPoint(target: AnyItem, anchor: Vec): Vec {
  const bounds = itemBounds(target);
  return { x: bounds.x + anchor.x * bounds.w, y: bounds.y + anchor.y * bounds.h };
}

/** Anchor for `point` within `target`'s bounds, clamped to the box — a point
 *  dropped just outside an item's edge still binds instead of narrowly
 *  missing. */
export function anchorFor(target: AnyItem, point: Vec): Vec {
  const bounds = itemBounds(target);
  const x = bounds.w === 0 ? 0.5 : (point.x - bounds.x) / bounds.w;
  const y = bounds.h === 0 ? 0.5 : (point.y - bounds.y) / bounds.h;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

/** Items an arrow end can bind to — deliberately excludes other arrows/draw
 *  strokes (binding a line to a line has no clear meaning) and the arrow
 *  being edited itself. */
export function bindTargetAt(
  items: AnyItem[],
  point: Vec,
  excludeId: string,
  hitTest: (candidates: AnyItem[], point: Vec) => AnyItem | null,
): AnyItem | null {
  const candidates = items.filter(
    (i) => i.id !== excludeId && i.type !== "arrow" && i.type !== "draw",
  );
  return hitTest(candidates, point);
}
