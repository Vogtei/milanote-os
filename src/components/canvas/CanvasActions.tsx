"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BoardEditor } from "@/canvas/editor";
import type { Vec } from "@/canvas/types";
import { createNode } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";
import { uploadRawFile } from "@/lib/asset-store";

// The four item kinds that can't be created by a plain click — they need a URL,
// a board name or a file first. Both the desktop rail and the mobile sheet
// trigger them, so the dialogs and hidden file inputs live here once.

type Prompt = "link" | "board" | null;

type Actions = {
  promptLink: (at?: Vec) => void;
  promptBoard: (at?: Vec) => void;
  pickImage: (at?: Vec) => void;
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
  children,
}: {
  editor: BoardEditor;
  boardId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const targetRef = useRef<Vec | null>(null);
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
  const promptBoard = useCallback((at?: Vec) => open("board", at), []);

  const pickImage = useCallback((at?: Vec) => {
    targetRef.current = at ?? null;
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

  async function submitBoard(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    const at = target();
    setBusy(true);
    try {
      const node = await createNode(NodeType.BOARD, title, boardId);
      editor.createItem("board", at, { nodeId: node.id, title: node.title });
      setPrompt(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const at = target();
    setBusy(true);
    try {
      const { src } = await uploadRawFile(file);
      const size = await naturalSize(src);
      const item = editor.createItem("image", at, { src, alt: file.name });
      // Match the image's own aspect ratio instead of the generic default box.
      if (size) {
        const w = 320;
        const h = Math.round((size.h / size.w) * w);
        editor.store.transact(() =>
          editor.store.update(item.id, { x: at.x - w / 2, y: at.y - h / 2, w, h }),
        );
      }
      editor.setSelection([item.id]);
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
    <ActionsContext.Provider value={{ promptLink, promptBoard, pickImage, pickFile, busy }}>
      {children}

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImage} />
      <input ref={fileInputRef} type="file" hidden onChange={handleFile} />

      {prompt && (
        <div
          className="fixed inset-0 z-[400] flex items-start justify-center bg-black/40 pt-[18vh]"
          onPointerDown={(e) => e.target === e.currentTarget && setPrompt(null)}
        >
          <form
            onSubmit={prompt === "link" ? submitLink : submitBoard}
            className="vos-panel vos-panel-shadow flex w-[min(420px,calc(100vw-32px))] flex-col gap-3 rounded-2xl p-4"
          >
            <label className="text-[13px] font-medium text-[var(--vos-text)]">
              {prompt === "link" ? "Link einfügen" : "Neues Board"}
            </label>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setPrompt(null)}
              placeholder={prompt === "link" ? "https://…" : "Board-Name"}
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
                {prompt === "link" ? "Einfügen" : "Erstellen"}
              </button>
            </div>
          </form>
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
