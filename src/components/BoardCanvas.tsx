"use client";

import { useEffect, useState } from "react";
import { Tldraw, defaultShapeUtils, AssetRecordType, exportAs, getTipTapDefaultExtensions } from "tldraw";
import type { Editor } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import { createNode } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";
import { BoardLinkShapeUtil } from "@/components/BoardLinkShape";
import { TodoShapeUtil } from "@/components/TodoShape";
import { FileShapeUtil } from "@/components/FileShape";
import { minioAssetStore } from "@/lib/asset-store";
import { OfflineBoardCanvas } from "@/components/OfflineBoardCanvas";
import { saveSnapshot, loadSnapshot, clearSnapshot } from "@/lib/offline-cache";
import { MilanoteToolbar, MilanoteRailContext } from "@/components/MilanoteToolbar";
import { MilanoteRichTextToolbar } from "@/components/MilanoteRichTextToolbar";
import { CommentsPanel } from "@/components/CommentsPanel";

const shapeUtils = [...defaultShapeUtils, BoardLinkShapeUtil, TodoShapeUtil, FileShapeUtil];
const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:5858";
const AUTOSAVE_MS = 3000;
const STUCK_LOADING_MS = 10000;
const textOptions = { tipTapConfig: { extensions: getTipTapDefaultExtensions({ codeBlock: {} }) } };
const components = { Toolbar: MilanoteToolbar, RichTextToolbar: MilanoteRichTextToolbar };

export function BoardCanvas({
  id,
  readonly = false,
  canComment = false,
  userName,
}: {
  id: string;
  readonly?: boolean;
  canComment?: boolean;
  userName?: string;
}) {
  const [mode, setMode] = useState<"sync" | "offline">("sync");
  const [remountKey, setRemountKey] = useState(0);

  function goOffline() {
    setMode("offline");
  }

  function tryReconnect() {
    setMode("sync");
    setRemountKey((k) => k + 1);
  }

  if (mode === "offline" && !readonly) {
    return <OfflineBoardCanvas id={id} onTryReconnect={tryReconnect} />;
  }

  return (
    <SyncedBoardCanvas
      key={remountKey}
      id={id}
      readonly={readonly}
      canComment={canComment}
      userName={userName}
      onGoOffline={readonly ? undefined : goOffline}
    />
  );
}

function SyncedBoardCanvas({
  id,
  readonly,
  canComment,
  userName,
  onGoOffline,
}: {
  id: string;
  readonly: boolean;
  canComment: boolean;
  userName?: string;
  onGoOffline?: () => void;
}) {
  const store = useSync({
    uri: `${SYNC_URL}?boardId=${id}`,
    shapeUtils,
    assets: minioAssetStore,
  });

  // If we never manage to connect at all (cold start while offline), fall
  // back to a fully local editor instead of leaving the user staring at a
  // spinner forever.
  useEffect(() => {
    if (store.status !== "loading" || !onGoOffline) return;
    const t = setTimeout(onGoOffline, STUCK_LOADING_MS);
    return () => clearTimeout(t);
  }, [store.status, onGoOffline]);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [pendingLocalEdits, setPendingLocalEdits] = useState<{ savedAt: number } | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);

  function handleMount(editor: Editor) {
    setEditor(editor);
    if (readonly) editor.updateInstanceState({ isReadonly: true });
    if (userName) editor.user.updateUserPreferences({ name: userName });

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

    if (!readonly) {
      // Safety-net autosave: also doubles as the source for the "apply
      // local edits" resync flow below, independent of tldraw's own
      // in-memory push buffering (which doesn't survive a page reload).
      const interval = setInterval(() => {
        saveSnapshot(id, editor.getSnapshot());
      }, AUTOSAVE_MS);
      editor.disposables.add(() => clearInterval(interval));

      loadSnapshot(id).then((cached) => {
        if (cached) setPendingLocalEdits({ savedAt: cached.savedAt });
      });
    }
  }

  function applyLocalEdits() {
    if (!editor) return;
    loadSnapshot(id).then((cached) => {
      if (cached) {
        editor.loadSnapshot(cached.snapshot as never);
        clearSnapshot(id);
      }
      setPendingLocalEdits(null);
    });
  }

  function dismissLocalEdits() {
    clearSnapshot(id);
    setPendingLocalEdits(null);
  }

  async function exportBoard() {
    if (!editor) return;
    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length === 0) return;
    await exportAs(editor, ids, { format: "png", name: "board" });
  }

  // Bridges MilanoteToolbar (rendered prop-less by tldraw itself via the
  // `components` registry) back to state/data that lives here: the current
  // board id (for creating nested boards) and the comments panel's open
  // state (which renders outside the <Tldraw> tree).
  async function createBoard(boardTitle: string) {
    if (!editor) return;
    const node = await createNode(NodeType.BOARD, boardTitle, id);
    const center = editor.getViewportPageBounds().center;
    editor.createShape({
      type: "board-link",
      x: center.x - 110,
      y: center.y - 60,
      props: { nodeId: node.id, title: node.title, w: 220, h: 120 },
    });
  }

  function toggleComments() {
    setCommentsOpen((v) => !v);
  }

  const isDisconnected = store.status === "synced-remote" && store.connectionStatus === "offline";

  return (
    <MilanoteRailContext.Provider value={{ createBoard, toggleComments }}>
      <div className="relative h-full w-full">
        <Tldraw
          store={store}
          shapeUtils={shapeUtils}
          onMount={handleMount}
          components={components}
          textOptions={textOptions}
        />

        <CommentsPanel boardId={id} canPost={canComment} open={commentsOpen} onOpenChange={setCommentsOpen} hideTrigger />

        {pendingLocalEdits && (
          <div className="absolute left-3 top-3 z-[300] flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950">
            <span className="text-amber-800 dark:text-amber-200">
              Lokale Offline-Änderungen von{" "}
              {new Date(pendingLocalEdits.savedAt).toLocaleTimeString("de-DE")} gefunden.
            </span>
            <button onClick={applyLocalEdits} className="font-medium text-amber-900 underline dark:text-amber-100">
              Übernehmen
            </button>
            <button onClick={dismissLocalEdits} className="text-zinc-500 underline">
              Verwerfen
            </button>
          </div>
        )}

        {isDisconnected && !pendingLocalEdits && (
          <div className="absolute left-3 top-3 z-[300]">
            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              Verbindung getrennt — läuft lokal weiter
            </span>
          </div>
        )}

        {!readonly && (
          <div className="absolute right-3 top-3 z-[300] flex items-start gap-2">
            {onGoOffline && (
              <button
                onClick={onGoOffline}
                className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Offline arbeiten
              </button>
            )}
            <button
              onClick={exportBoard}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Exportieren
            </button>
          </div>
        )}
      </div>
    </MilanoteRailContext.Provider>
  );
}
