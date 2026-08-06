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
}: {
  boardId: string;
  canPost: boolean;
}) {
  const [open, setOpen] = useState(false);
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
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Kommentare
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-[400] flex max-h-96 w-80 flex-col rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <ul className="flex-1 overflow-y-auto p-3">
            {comments === null && <li className="text-xs text-zinc-400">Lädt…</li>}
            {comments?.length === 0 && (
              <li className="text-xs text-zinc-400">Noch keine Kommentare.</li>
            )}
            {comments?.map((c) => (
              <li key={c.id} className="mb-3 text-xs">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {c.author.name || c.author.email}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">{c.text}</div>
              </li>
            ))}
          </ul>
          {canPost ? (
            <form
              onSubmit={submit}
              className="flex gap-1.5 border-t border-zinc-200 p-2 dark:border-zinc-800"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Kommentar schreiben…"
                disabled={isPending}
                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={isPending || !text.trim()}
                className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Senden
              </button>
            </form>
          ) : (
            <div className="border-t border-zinc-200 p-2 text-center text-xs text-zinc-400 dark:border-zinc-800">
              Nur Ansicht — kein Kommentieren erlaubt
            </div>
          )}
        </div>
      )}
    </div>
  );
}
