"use client";

import { useEffect, useState, useTransition } from "react";
import { createComment, listComments } from "@/lib/comments";

type Comment = {
  id: string;
  text: string;
  createdAt: string | Date;
  author: { name: string | null; email: string };
};

export function CommentsPanel({
  boardId,
  canPost,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  boardId: string;
  canPost: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  async function reload() {
    const data = await listComments(boardId);
    setComments(data as Comment[]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    startTransition(async () => {
      await createComment(boardId, text);
      setText("");
      await reload();
    });
  }

  return (
    <div className={hideTrigger ? "" : "relative"}>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md border border-[var(--vos-border)] px-2.5 py-1 text-xs font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
        >
          Kommentare
        </button>
      )}

      {open && (
        <div
          className={
            hideTrigger
              ? "fixed right-3 top-16 z-[400] flex max-h-96 w-80 flex-col rounded-md border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] shadow-lg"
              : "absolute right-0 top-8 z-[400] flex max-h-96 w-80 flex-col rounded-md border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] shadow-lg"
          }
        >
          <ul className="flex-1 overflow-y-auto p-3">
            {comments === null && <li className="text-xs text-[var(--vos-faint)]">Lädt…</li>}
            {comments?.length === 0 && (
              <li className="text-xs text-[var(--vos-faint)]">Noch keine Kommentare.</li>
            )}
            {comments?.map((c) => (
              <li key={c.id} className="mb-3 text-xs">
                <div className="font-medium text-[var(--vos-text-strong)]">
                  {c.author.name || c.author.email}
                </div>
                <div className="text-[var(--vos-muted)]">{c.text}</div>
              </li>
            ))}
          </ul>
          {canPost ? (
            <form
              onSubmit={submit}
              className="flex gap-1.5 border-t border-[var(--vos-border)] p-2"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Kommentar schreiben…"
                disabled={isPending}
                className="flex-1 rounded border border-[var(--vos-border)] bg-[var(--vos-bg)] px-2 py-1 text-xs text-[var(--vos-text)] outline-none"
              />
              <button
                type="submit"
                disabled={isPending || !text.trim()}
                className="rounded bg-[var(--vos-text-strong)] px-2 py-1 text-xs font-medium text-[var(--vos-bg)] disabled:opacity-40"
              >
                Senden
              </button>
            </form>
          ) : (
            <div className="border-t border-[var(--vos-border)] p-2 text-center text-xs text-[var(--vos-faint)]">
              Nur Ansicht — kein Kommentieren erlaubt
            </div>
          )}
        </div>
      )}
    </div>
  );
}
