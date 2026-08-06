"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Text editing happens in a real <textarea> positioned over the item, not in
 * the canvas: caret placement, IME, selection, autocorrect, accessibility and
 * mobile keyboards are all things the platform already does correctly and
 * nobody should reimplement on a bitmap.
 *
 * The renderer skips the item being edited (see RenderState.editingId) so the
 * overlay is the only copy of the text on screen.
 */
export function TextOverlay({ editor }: { editor: BoardEditor }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { theme } = useTheme();
  const [, bump] = useState(0);

  useEffect(() => editor.subscribe(() => bump((n) => n + 1)), [editor]);

  const editingId = editor.getEditingId();
  const item = editingId ? editor.store.getItem(editingId) : undefined;

  useEffect(() => {
    if (!item) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [item?.id]);

  if (!item || (item.type !== "note" && item.type !== "text")) return null;

  const palette = PALETTES[theme];
  const camera = editor.getCamera();
  const topLeft = editor.worldToScreen({ x: item.x, y: item.y });
  const padding = item.type === "note" ? 14 : 0;
  const fontSize = item.type === "note" ? 15 : item.props.size;
  const lineHeight = item.type === "note" ? 22 : fontSize * 1.35;
  const color =
    item.type === "note"
      ? palette.note[item.props.color].text
      : item.props.color === "grey"
        ? palette.text
        : palette.stroke[item.props.color];

  return (
    <textarea
      ref={ref}
      value={item.props.text}
      onChange={(e) => editor.store.transact(() => editor.store.updateProps(item.id, { text: e.target.value } as never))}
      onBlur={() => editor.setEditing(null)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          editor.setEditing(null);
        }
      }}
      spellCheck={false}
      className="absolute resize-none border-0 bg-transparent outline-none"
      style={{
        left: topLeft.x + padding * camera.z,
        top: topLeft.y + padding * camera.z,
        width: (item.w - padding * 2) * camera.z,
        height: (item.h - padding * 2) * camera.z,
        fontSize: fontSize * camera.z,
        lineHeight: `${lineHeight * camera.z}px`,
        fontWeight: item.type === "text" ? 500 : 400,
        color,
        caretColor: color,
      }}
    />
  );
}
