"use client";

import type { BoardEditor } from "@/canvas/editor";
import type { Comment } from "@/lib/comments";
import { CloseIcon } from "@/components/icons/VosIcons";

// Adobe-Acrobat-style: a list, not a composer — writing a comment happens on
// the canvas now (the Kommentar rail tool drops a pin), this panel is purely
// for browsing what's already there and jumping to it.
export function CommentsPanel({
  editor,
  comments,
  open,
  onClose,
}: {
  editor: BoardEditor;
  comments: Comment[] | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="vos-panel vos-panel-shadow fixed right-2.5 top-[62px] z-[300] flex max-h-[calc(100%-80px)] w-80 flex-col rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--vos-border)] px-3.5 py-3">
        <span className="text-[13px] font-semibold text-[var(--vos-text-strong)]">Kommentare</span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-lg text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {comments === null && (
          <li className="px-2.5 py-2 text-xs text-[var(--vos-faint)]">Lädt…</li>
        )}
        {comments?.length === 0 && (
          <li className="px-2.5 py-2 text-xs text-[var(--vos-faint)]">
            Noch keine Kommentare. Mit dem Kommentar-Werkzeug in der Werkzeugleiste einen Pin
            aufs Board setzen.
          </li>
        )}
        {comments?.map((c) => {
          const pinned = c.x != null && c.y != null;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={!pinned}
                onClick={() => pinned && editor.panToPoint({ x: c.x!, y: c.y! })}
                className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--vos-hover-soft)] disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-[var(--vos-text-strong)]">
                    {c.author.name || c.author.email}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--vos-faint)]">
                    {relativeTime(new Date(c.createdAt))}
                  </span>
                </span>
                <span className="text-[13px] leading-snug text-[var(--vos-muted)]">{c.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeTime(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return `vor ${days} Tg.`;
}
