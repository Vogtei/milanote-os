"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import type { Vec } from "@/canvas/types";
import { createNode } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";
import { uploadRawFile } from "@/lib/asset-store";
import { createComment } from "@/lib/comments";

// Item kinds that need something from outside the canvas before they exist:
// a URL, a new board record, a file, or comment text. Both the desktop rail
// and the mobile sheet trigger them, so the dialog and the hidden file
// inputs live here once.
//
// Link and Kommentar still ask first — there's nothing sensible to put on
// the board without a URL or a comment's text. Board and Bild create their
// item immediately (an untitled board, an empty picture frame) and let the
// user fill it in afterwards, which keeps a dialog out of the way of a
// drag-and-drop gesture.

type Prompt = "link" | "comment" | null;

type Actions = {
  promptLink: (at?: Vec) => void;
  promptComment: (at?: Vec) => void;
  createBoard: (at?: Vec) => void;
  pickImage: (at?: Vec) => void;
  /** Attaches a picture to an existing (empty) image item — the double-click
   *  path, as opposed to creating a new one. */
  fillImage: (itemId: string) => void;
  pickFile: (at?: Vec) => void;
  busy: boolean;
};

const ActionsContext = createContext<Actions | null>(null);

export function useCanvasActions(): Actions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("useCanvasActions must be used inside CanvasActionsProvider");
  return value;
}

export function CanvasActionsProvider({
  editor,
  boardId,
  onCommentCreated,
  children,
}: {
  editor: BoardEditor;
  boardId: string;
  /** Comments live in Postgres, not the doc store, so nothing already
   *  watching the editor picks up a new pin — this is how the caller finds
   *  out it needs to refetch. */
  onCommentCreated?: () => void;
  children: React.ReactNode;
}) {
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const targetRef = useRef<Vec | null>(null);
  const fillTargetRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Where a new item lands: the drop point if there was one, else the middle
   *  of what the user is currently looking at. */
  const target = useCallback((): Vec => {
    if (targetRef.current) return targetRef.current;
    const { w, h } = editor.getSize();
    return editor.screenToWorld({ x: w / 2, y: h / 2 });
  }, [editor]);

  const open = (kind: Prompt, at?: Vec) => {
    targetRef.current = at ?? null;
    setValue("");
    setPrompt(kind);
  };

  const promptLink = useCallback((at?: Vec) => open("link", at), []);
  const promptComment = useCallback((at?: Vec) => open("comment", at), []);

  const createBoard = useCallback(
    (at?: Vec) => {
      targetRef.current = at ?? null;
      const point = target();
      // Place the card first with a provisional title so the drop lands
      // somewhere visible, then swap in the real record once the server has
      // created it. Renaming happens on the board itself.
      const item = editor.createItem("board", point, { nodeId: "", title: "Neues Board" });
      editor.setSelection([item.id]);
      setBusy(true);
      createNode(NodeType.BOARD, "Neues Board", boardId)
        .then((node) => {
          editor.store.transact(() =>
            editor.store.updateProps(item.id, { nodeId: node.id, title: node.title } as never),
          );
        })
        .catch((error) => {
          console.error("[board] could not create nested board", error);
          editor.store.transact(() => editor.store.remove([item.id]));
        })
        .finally(() => setBusy(false));
    },
    [editor, boardId, target],
  );

  // A new picture starts as an empty frame on the board; double-clicking it
  // opens the file dialog (see fillImage).
  const pickImage = useCallback(
    (at?: Vec) => {
      targetRef.current = at ?? null;
      const item = editor.createItem("image", target(), { src: "", alt: "" });
      editor.setSelection([item.id]);
    },
    [editor, target],
  );

  const fillImage = useCallback((itemId: string) => {
    fillTargetRef.current = itemId;
    imageInputRef.current?.click();
  }, []);

  const pickFile = useCallback((at?: Vec) => {
    targetRef.current = at ?? null;
    fileInputRef.current?.click();
  }, []);

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    const url = value.trim();
    if (!url) return;
    const at = target();
    setPrompt(null);
    setBusy(true);
    // Place the card immediately with the bare URL, then fill in the preview
    // when the unfurl comes back — a slow remote page shouldn't leave the user
    // staring at nothing after they hit enter.
    const item = editor.createItem("link", at, { url, title: url });
    try {
      const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        editor.store.transact(() =>
          editor.store.updateProps(item.id, {
            url,
            title: data.title ?? url,
            description: data.description ?? "",
            image: data.image ?? "",
            favicon: data.favicon ?? "",
          } as never),
        );
      }
    } catch {
      // Card keeps the plain URL — still a working link.
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    const at = target();
    setPrompt(null);
    setBusy(true);
    try {
      await createComment(boardId, text, at.x, at.y);
      onCommentCreated?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = fillTargetRef.current;
    fillTargetRef.current = null;
    e.target.value = "";
    if (!file || !itemId) return;
    const existing = editor.store.getItem(itemId);
    if (!existing) return;

    setBusy(true);
    try {
      const { src } = await uploadRawFile(file);
      const size = await naturalSize(src);
      editor.store.transact(() => {
        editor.store.updateProps(itemId, { src, alt: file.name } as never);
        // Keep the frame centred while adopting the picture's aspect ratio,
        // so the card doesn't jump away from where it was placed.
        if (size) {
          const w = existing.w;
          const h = Math.round((size.h / size.w) * w);
          editor.store.update(itemId, { y: existing.y + (existing.h - h) / 2, h });
        }
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const at = target();
    setBusy(true);
    try {
      const { src } = await uploadRawFile(file);
      editor.createItem("file", at, { name: file.name, size: file.size, src });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionsContext.Provider
      value={{ promptLink, promptComment, createBoard, pickImage, fillImage, pickFile, busy }}
    >
      {children}

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImage} />
      <input ref={fileInputRef} type="file" hidden onChange={handleFile} />

      {prompt && (
        <div
          className="fixed inset-0 z-[400] flex items-start justify-center bg-black/40 pt-[18vh] backdrop-blur-sm"
          onPointerDown={(e) => e.target === e.currentTarget && setPrompt(null)}
        >
          {prompt === "link" ? (
            <form
              onSubmit={submitLink}
              className="vos-panel vos-panel-shadow flex w-[min(420px,calc(100vw-32px))] flex-col gap-3 rounded-2xl p-4"
            >
              <label className="text-[13px] font-medium text-[var(--vos-text)]">Link einfügen</label>
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setPrompt(null)}
                placeholder="https://…"
                className="h-10 rounded-lg border border-[var(--vos-border)] bg-[var(--vos-input)] px-3 text-[14px] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-muted)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt(null)}
                  className="h-9 rounded-lg px-3 text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={busy || !value.trim()}
                  className="h-9 rounded-lg bg-[var(--vos-text-strong)] px-3.5 text-[13px] font-semibold text-[var(--vos-bg)] disabled:opacity-40"
                >
                  Einfügen
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={submitComment}
              className="vos-panel vos-panel-shadow flex w-[min(420px,calc(100vw-32px))] flex-col gap-3 rounded-2xl p-4"
            >
              <label className="text-[13px] font-medium text-[var(--vos-text)]">Kommentar</label>
              <textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setPrompt(null)}
                placeholder="Kommentar schreiben…"
                className="resize-none rounded-lg border border-[var(--vos-border)] bg-[var(--vos-input)] px-3 py-2 text-[14px] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)] focus:border-[var(--vos-muted)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt(null)}
                  className="h-9 rounded-lg px-3 text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={busy || !value.trim()}
                  className="h-9 rounded-lg bg-[var(--vos-text-strong)] px-3.5 text-[13px] font-semibold text-[var(--vos-bg)] disabled:opacity-40"
                >
                  Kommentieren
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </ActionsContext.Provider>
  );
}

/** Reads an uploaded image's intrinsic size so the card can keep its ratio. */
function naturalSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
