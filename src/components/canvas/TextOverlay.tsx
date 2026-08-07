"use client";

import { useEffect, useRef } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorTick } from "@/components/canvas/useEditorTick";

/**
 * Editing surface for the plain "Text" canvas label — a single run, one size,
 * one colour, no toolbar. A real <textarea> positioned over the item: caret
 * placement, IME, selection, autocorrect, accessibility and mobile keyboards
 * are all things the platform already does correctly.
 *
 * Notes are richer (bold/italic/lists/per-run colour) and have their own
 * contentEditable-based editor — see NoteEditor.tsx.
 *
 * The renderer skips the item being edited (see RenderState.editingId) so
 * this overlay is the only copy of the text on screen while it's open.
 */
export function TextOverlay({ editor }: { editor: BoardEditor }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { theme } = useTheme();
  useEditorTick(editor);

  const editingId = editor.getEditingId();
  const item = editingId ? editor.store.getItem(editingId) : undefined;

  useEffect(() => {
    if (!item) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item || item.type !== "text") return null;

  const palette = PALETTES[theme];
  const camera = editor.getCamera();
  const topLeft = editor.worldToScreen({ x: item.x, y: item.y });
  const color = item.props.color === "grey" ? palette.text : palette.stroke[item.props.color];

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
        left: topLeft.x,
        top: topLeft.y,
        width: item.w * camera.z,
        height: item.h * camera.z,
        fontSize: item.props.size * camera.z,
        lineHeight: `${item.props.size * 1.35 * camera.z}px`,
        fontWeight: 500,
        color,
        caretColor: color,
      }}
    />
  );
}
