"use client";

import { useEffect, useRef } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { todoRows } from "@/canvas/todoLayout";

/**
 * DOM textarea over whichever to-do row is being edited — same reasoning as
 * TextOverlay: caret, IME and mobile keyboards are the platform's job, not a
 * canvas drawing routine's.
 *
 * Enter commits the row and opens a new empty one after it; Backspace on an
 * empty row merges back into the row above. Both are editor commands, not
 * local component state, so the canvas and the DOM never disagree about which
 * row is being edited.
 */
export function TodoEntryOverlay({ editor }: { editor: BoardEditor }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { theme } = useTheme();

  const editing = editor.getEditingEntry();
  const item = editing ? editor.store.getItem(editing.itemId) : undefined;
  const row =
    item?.type === "todo" && editing
      ? todoRows(item).find((r) => r.entry.id === editing.entryId)
      : undefined;

  useEffect(() => {
    if (!row) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing?.entryId]);

  if (!editing || item?.type !== "todo" || !row) return null;

  const palette = PALETTES[theme];
  const colors = palette.note[item.props.color] ?? palette.note.white;
  const camera = editor.getCamera();
  const topLeft = editor.worldToScreen({ x: row.text.x, y: row.text.y });

  return (
    <textarea
      ref={ref}
      value={row.entry.text}
      onChange={(e) => editor.updateEntryText(editing.itemId, editing.entryId, e.target.value)}
      onBlur={() => {
        // Only clear if focus didn't move to another row's overlay (e.g. via
        // the Enter handler re-focusing a freshly created one next frame).
        requestAnimationFrame(() => {
          if (document.activeElement?.tagName !== "TEXTAREA") editor.setEditing(null);
        });
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          editor.addEntryAfter(editing.itemId, editing.entryId);
        } else if (e.key === "Backspace" && row.entry.text === "") {
          e.preventDefault();
          editor.removeEntryAndFocusPrevious(editing.itemId, editing.entryId);
        } else if (e.key === "Escape") {
          e.preventDefault();
          editor.setEditing(null);
        }
      }}
      spellCheck={false}
      rows={1}
      className="absolute resize-none overflow-hidden border-0 bg-transparent outline-none"
      style={{
        left: topLeft.x,
        top: topLeft.y + 2 * camera.z,
        width: row.text.w * camera.z,
        height: row.text.h * camera.z,
        fontSize: 13 * camera.z,
        lineHeight: `${16 * camera.z}px`,
        color: colors.text,
        caretColor: colors.text,
      }}
    />
  );
}
