"use client";

import { useEffect, useRef, useState } from "react";
import { Tldraw, defaultShapeUtils, AssetRecordType, exportAs, getTipTapDefaultExtensions, createShapeId } from "tldraw";
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
import { MilanoteToolbar, MilanoteRailContext, DRAG_MIME } from "@/components/MilanoteToolbar";
import { MilanoteRichTextToolbar } from "@/components/MilanoteRichTextToolbar";
import { CommentsPanel } from "@/components/CommentsPanel";

// Exported so OfflineBoardCanvas (a separate <Tldraw> instance for the
// stuck-loading/offline fallback) renders with the exact same shapes, rail,
// and dark theme instead of tldraw's untouched defaults.
export const shapeUtils = [...defaultShapeUtils, BoardLinkShapeUtil, TodoShapeUtil, FileShapeUtil];
export const textOptions = { tipTapConfig: { extensions: getTipTapDefaultExtensions({ codeBlock: {} }) } };
export const milanoteComponents = { Toolbar: MilanoteToolbar, RichTextToolbar: MilanoteRichTextToolbar, StylePanel: null };
const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:5858";
const AUTOSAVE_MS = 3000;
const STUCK_LOADING_MS = 10000;

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
  // Only true once we've actually gone through the offline detour — a plain
  // cold load has no reconciliation to offer, even though the autosave
  // safety-net (see handleMount below) means IndexedDB almost always has
  // *some* cached snapshot lying around from a previous session.
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  function goOffline() {
    setHasBeenOffline(true);
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
      checkForLocalEdits={hasBeenOffline}
    />
  );
}

function SyncedBoardCanvas({
  id,
  readonly,
  canComment,
  userName,
  onGoOffline,
  checkForLocalEdits,
}: {
  id: string;
  readonly: boolean;
  canComment: boolean;
  userName?: string;
  onGoOffline?: () => void;
  checkForLocalEdits: boolean;
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
    // Dark theme throughout the app (VisualOS-inspired look) — tldraw's own
    // colorScheme covers canvas background/grid/default-shape chrome for
    // free, no need to hand-roll canvas styling that would fight it.
    editor.user.updateUserPreferences({ colorScheme: "dark" });

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

      // Only worth checking right after an actual offline detour — see the
      // comment on `hasBeenOffline` in BoardCanvas for why a plain cold load
      // skips this even though a cache almost always technically exists.
      if (checkForLocalEdits) {
        loadSnapshot(id).then((cached) => {
          if (cached) setPendingLocalEdits({ savedAt: cached.savedAt });
        });
      }
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

  // Dropping a rail icon onto the canvas creates the element at the exact
  // drop point (matches real Milanote — verified by dragging Note/To-do onto
  // a live board there). Tools that need a follow-up text input (Link,
  // Board) don't have a clean point-based creation path, so dropping them
  // just opens the same popover a click would; tools that arm a continuous
  // gesture (Line, Draw) or open a file picker (Add image, Upload) likewise
  // fall back to their click behavior rather than guessing a synthetic drag.
  //
  // tldraw's own canvas has its own native drop handling (for OS file
  // drag-and-drop) that calls stopPropagation — a React onDrop/onDropCapture
  // prop on an ancestor never saw our drops at all, because React's
  // synthetic capture dispatch didn't intercept it before tldraw's handler
  // ran (confirmed empirically: a debug log in the React capture handler
  // never fired). A real native `addEventListener(..., {capture:true})`
  // does — verified capture-before-bubble ordering directly against this
  // exact DOM structure — so we bypass React's synthetic event system here
  // and attach to the DOM ourselves.
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !editor) return;

    function onDragOver(e: DragEvent) {
      if (e.dataTransfer?.types.includes(DRAG_MIME)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onDrop(e: DragEvent) {
      const tool = e.dataTransfer?.getData(DRAG_MIME);
      if (!tool || !editor) return;
      e.preventDefault();
      e.stopPropagation();
      editor.markEventAsHandled(e);

      const clickByTitle = (title: string) =>
        document.querySelector<HTMLButtonElement>(`button[title="${title}"]`)?.click();

      switch (tool) {
        case "note": {
          const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
          const id = createShapeId();
          editor.createShape({ id, type: "note", x: point.x - 100, y: point.y - 50 });
          editor.setEditingShape(id);
          break;
        }
        case "todo": {
          const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
          editor.createShape({ type: "todo", x: point.x - 110, y: point.y - 90 });
          break;
        }
        case "frame": {
          const point = editor.screenToPage({ x: e.clientX, y: e.clientY });
          editor.createShape({ type: "frame", x: point.x - 150, y: point.y - 100, props: { w: 300, h: 200 } });
          break;
        }
        case "arrow":
        case "draw":
          editor.setCurrentTool(tool);
          break;
        case "link":
          clickByTitle("Link");
          break;
        case "board":
          clickByTitle("Board");
          break;
        case "asset":
          clickByTitle("Add image");
          break;
        case "upload":
          clickByTitle("Upload");
          break;
      }
    }

    wrapper.addEventListener("dragover", onDragOver, true);
    wrapper.addEventListener("drop", onDrop, true);
    return () => {
      wrapper.removeEventListener("dragover", onDragOver, true);
      wrapper.removeEventListener("drop", onDrop, true);
    };
  }, [editor]);

  const isDisconnected = store.status === "synced-remote" && store.connectionStatus === "offline";

  return (
    <MilanoteRailContext.Provider value={{ createBoard, toggleComments }}>
      <div ref={wrapperRef} className="relative h-full w-full">
        <Tldraw
          store={store}
          shapeUtils={shapeUtils}
          onMount={handleMount}
          components={milanoteComponents}
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
                className="rounded-md border border-[rgb(58,59,65)] bg-[#202127] px-2.5 py-1.5 text-xs font-medium text-[rgb(156,153,143)] shadow-sm hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
              >
                Offline arbeiten
              </button>
            )}
            <button
              onClick={exportBoard}
              className="rounded-md border border-[rgb(58,59,65)] bg-[#202127] px-2.5 py-1.5 text-xs font-medium text-[rgb(156,153,143)] shadow-sm hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
            >
              Exportieren
            </button>
          </div>
        )}
      </div>
    </MilanoteRailContext.Provider>
  );
}
