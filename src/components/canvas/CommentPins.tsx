"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import type { Comment } from "@/lib/comments";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { CommentIcon } from "@/components/icons/ContentIcons";

/** Comment pins are screen-space overlays, same pattern as every other
 *  DOM-over-canvas piece in this app (RenameOverlay, TodoEntryOverlay) —
 *  positioned via editor.worldToScreen and recomputed on every editor tick
 *  so they track pan/zoom, but never painted onto the canvas bitmap itself. */
export function CommentPins({ editor, comments }: { editor: BoardEditor; comments: Comment[] }) {
  useEditorTick(editor);
  const pinned = comments.filter(
    (c): c is Comment & { x: number; y: number } => c.x != null && c.y != null,
  );
  if (pinned.length === 0) return null;
  return (
    <>
      {pinned.map((c) => (
        <CommentPin key={c.id} editor={editor} comment={c} />
      ))}
    </>
  );
}

function CommentPin({
  editor,
  comment,
}: {
  editor: BoardEditor;
  comment: Comment & { x: number; y: number };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  const point = editor.worldToScreen({ x: comment.x, y: comment.y });

  return (
    <div
      ref={ref}
      className="absolute z-[275]"
      style={{ left: point.x, top: point.y, transform: "translate(-4px, -100%)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={comment.author.name || comment.author.email}
        className={`grid h-7 w-7 place-items-center rounded-full rounded-bl-sm border shadow-md transition-colors ${
          open
            ? "border-[var(--vos-text-strong)] bg-[var(--vos-text-strong)] text-[var(--vos-bg)]"
            : "border-[var(--vos-border)] bg-[var(--vos-panel-solid)] text-[var(--vos-muted)] hover:text-[var(--vos-text-strong)]"
        }`}
      >
        <CommentIcon size={14} />
      </button>
      {open && (
        <div className="vos-panel vos-panel-shadow absolute left-0 top-8 z-[400] flex w-56 flex-col gap-1 rounded-xl p-2.5">
          <span className="text-[12px] font-medium text-[var(--vos-text-strong)]">
            {comment.author.name || comment.author.email}
          </span>
          <span className="text-[12px] leading-snug text-[var(--vos-muted)]">{comment.text}</span>
        </div>
      )}
    </div>
  );
}
