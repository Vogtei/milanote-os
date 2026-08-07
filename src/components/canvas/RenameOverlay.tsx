"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import type { AnyItem } from "@/canvas/types";
import { PALETTES, type CanvasPalette } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { containerLabelRect } from "@/canvas/containerLayout";
import { renameNode } from "@/lib/nodes";

type Renameable = Extract<AnyItem, { type: "board" | "document" }>;

/**
 * Inline rename for folder (nested board) and document cards — a plain input
 * over the name label, centred to match how the canvas draws it.
 *
 * Unlike TextOverlay/TodoEntryOverlay this doesn't rely on a blur handler to
 * commit: `onPointerDown` in editor.ts unconditionally clears `renaming` on
 * the very next click (same as it clears the other editing states), so a
 * commit-on-blur design would silently discard whatever was typed the moment
 * the user clicked away. Instead every keystroke writes straight to the store
 * (same as the other overlays' onChange), and this component's own unmount —
 * `key={itemId}` below forces a fresh instance per renamed item — is what
 * commits the *server-side* Node title exactly once, however editing ends:
 * Enter, Escape (which reverts first), clicking away, or a real unmount.
 */
export function RenameOverlay({ editor }: { editor: BoardEditor }) {
  const itemId = editor.getRenaming();
  const item = itemId ? editor.store.getItem(itemId) : undefined;
  if (!itemId || !item || (item.type !== "board" && item.type !== "document")) return null;
  return <RenameInput key={itemId} editor={editor} itemId={itemId} item={item} />;
}

function RenameInput({
  editor,
  itemId,
  item,
}: {
  editor: BoardEditor;
  itemId: string;
  item: Renameable;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
  const [value, setValue] = useState(item.props.title);
  const discardRef = useRef(false);
  const valueRef = useRef(value);
  // The item's own title mutates on every keystroke (onChange writes it
  // straight to the store, below), so `item.props.title` itself can't be used
  // to revert on Escape by then — this plain useRef ignores every render
  // after the first and keeps only what the title actually was on mount.
  const originalTitleRef = useRef(item.props.title);

  // Keeps the ref in step with state on every commit, so the unmount cleanup
  // below can read the final value without a stale closure — assigning a ref
  // during render itself isn't safe, only after.
  useEffect(() => {
    valueRef.current = value;
  });

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  // A folder's title lives in two places: the item's own props (updated on
  // every keystroke below, so the card is never stale while typing) and the
  // Node record in Postgres (what the board's own page title and breadcrumbs
  // read once you navigate into it). A document has no Node, so only the
  // store needs touching. This fires once, whichever way editing ends.
  useEffect(() => {
    return () => {
      if (discardRef.current) return;
      const title = valueRef.current.trim() || (item.type === "board" ? "Neuer Ordner" : "Dokument");
      // No router.refresh() here on purpose: the canvas item already shows
      // the new title (via editor.renameItem, above), and the only place a
      // stale Node.title would actually surface — the breadcrumb/title when
      // someone opens *this particular* folder — refetches fresh data on
      // that navigation anyway.
      if (item.type === "board" && item.props.nodeId) {
        renameNode(item.props.nodeId, title).catch((error) =>
          console.error("[rename] could not update board", error),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const palette = PALETTES[theme];
  const camera = editor.getCamera();
  const rect = containerLabelRect(item);
  const topLeft = editor.worldToScreen({ x: rect.x, y: rect.y });

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        editor.renameItem(
          itemId,
          e.target.value.trim() || (item.type === "board" ? "Neuer Ordner" : "Dokument"),
        );
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          editor.endRename();
        } else if (e.key === "Escape") {
          e.preventDefault();
          discardRef.current = true;
          editor.renameItem(itemId, originalTitleRef.current);
          editor.endRename();
        }
      }}
      onBlur={() => editor.endRename()}
      spellCheck={false}
      className="absolute border-0 bg-transparent text-center outline-none"
      style={inputStyle(palette, rect, topLeft, camera.z)}
    />
  );
}

function inputStyle(
  palette: CanvasPalette,
  rect: { w: number; h: number },
  topLeft: { x: number; y: number },
  z: number,
): React.CSSProperties {
  return {
    left: topLeft.x,
    top: topLeft.y,
    width: rect.w * z,
    height: rect.h * z,
    fontSize: 13 * z,
    fontWeight: 600,
    lineHeight: `${rect.h * z}px`,
    color: palette.text,
    caretColor: palette.text,
  };
}
