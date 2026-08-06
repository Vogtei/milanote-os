"use client";

import { useState } from "react";
import { Tldraw, createShapeId, defaultShapeUtils, AssetRecordType } from "tldraw";
import type { Editor } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import { createNode } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";
import { BoardLinkShapeUtil } from "@/components/BoardLinkShape";
import { minioAssetStore } from "@/lib/asset-store";

const shapeUtils = [...defaultShapeUtils, BoardLinkShapeUtil];
const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:5858";

export function BoardCanvas({ id }: { id: string }) {
  const store = useSync({
    uri: `${SYNC_URL}?boardId=${id}`,
    shapeUtils,
    assets: minioAssetStore,
  });

  const [editor, setEditor] = useState<Editor | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  function handleMount(editor: Editor) {
    setEditor(editor);

    // Pasting or dropping a URL onto the canvas normally creates a bookmark
    // via tldraw's own (external) unfurl service. Override it with our
    // self-hosted /api/unfurl so link previews work fully offline/self-hosted.
    editor.registerExternalAssetHandler("url", async ({ url }) => {
      const assetId = AssetRecordType.createId();
      const base = {
        id: assetId,
        typeName: "asset" as const,
        type: "bookmark" as const,
        meta: {},
      };
      try {
        const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        return {
          ...base,
          props: {
            src: url,
            title: data.title ?? url,
            description: data.description ?? "",
            image: data.image ?? "",
            favicon: data.favicon ?? "",
          },
        };
      } catch {
        return {
          ...base,
          props: { src: url, title: url, description: "", image: "", favicon: "" },
        };
      }
    });
  }

  async function submitNewBoardLink(e: React.FormEvent) {
    e.preventDefault();
    if (!editor || !title.trim()) return;
    setPending(true);
    try {
      const node = await createNode(NodeType.BOARD, title, id);
      const center = editor.getViewportPageBounds().center;

      editor.createShape({
        id: createShapeId(),
        type: "board-link",
        x: center.x - 110,
        y: center.y - 60,
        props: { nodeId: node.id, title: node.title, w: 220, h: 120 },
      });
      setTitle("");
      setCreating(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative h-full w-full">
      <Tldraw store={store} shapeUtils={shapeUtils} onMount={handleMount} />

      <div className="absolute right-3 top-3 z-[300]">
        {creating ? (
          <form
            onSubmit={submitNewBoardLink}
            className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
              placeholder="Board-Name"
              disabled={pending}
              className="w-36 rounded px-1.5 py-1 text-xs outline-none dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Erstellen
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            + Board einfügen
          </button>
        )}
      </div>
    </div>
  );
}
