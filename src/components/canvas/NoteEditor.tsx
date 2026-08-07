"use client";

import { useEffect, useRef } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { blocksToHtml, parseHtmlToBlocks } from "@/canvas/richText";
import { RichTextToolbar } from "@/components/canvas/RichTextToolbar";

/**
 * Editing surface for notes: a contentEditable div instead of a <textarea>,
 * because bold/italic/underline/lists/per-run colour need a real selection
 * and `document.execCommand` to apply to — a plain string field has no way
 * to represent "these three words are bold".
 *
 * contentEditable's own HTML never becomes the stored value directly. Every
 * edit is parsed back into the structured TextBlock[] model (see
 * richText.ts) before it's written to the store — that parse is also the
 * sanitizer, since only a fixed whitelist of tags/styles has any
 * representation in the model at all.
 */
export function NoteEditor({ editor }: { editor: BoardEditor }) {
  const ref = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  useEditorTick(editor);

  const editingId = editor.getEditingId();
  const item = editingId ? editor.store.getItem(editingId) : undefined;
  const isNote = item?.type === "note";

  // Seeds the DOM from the stored blocks once per edit session. Not on every
  // render — that would fight the browser's own cursor position while typing.
  useEffect(() => {
    if (!isNote) return;
    const el = ref.current;
    if (!el) return;
    el.innerHTML = blocksToHtml(item.props.blocks);
    el.focus();
    placeCaretAtEnd(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item || item.type !== "note") return null;

  const palette = PALETTES[theme];
  const colors = palette.note[item.props.color] ?? palette.note.yellow;
  const camera = editor.getCamera();
  const topLeft = editor.worldToScreen({ x: item.x, y: item.y });
  const padding = 14;

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const blocks = parseHtmlToBlocks(el.innerHTML);
    editor.store.transact(() => editor.store.updateProps(item.id, { blocks } as never));
  };

  return (
    <>
      <RichTextToolbar editor={editor} target={ref} noteId={item.id} onChanged={commit} />
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={commit}
        onBlur={() => editor.setEditing(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            e.preventDefault();
            editor.setEditing(null);
          }
        }}
        className="richtext-note absolute overflow-hidden outline-none"
        style={{
          left: topLeft.x + padding * camera.z,
          top: topLeft.y + padding * camera.z,
          width: (item.w - padding * 2) * camera.z,
          height: (item.h - padding * 2) * camera.z,
          fontSize: 15 * camera.z,
          lineHeight: `${15 * 1.35 * camera.z}px`,
          color: colors.text,
          caretColor: colors.text,
        }}
      />
    </>
  );
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
