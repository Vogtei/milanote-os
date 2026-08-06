"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardEditor } from "@/canvas/editor";
import type { ToolId } from "@/canvas/editor";
import type { Doc } from "@/canvas/types";
import { exportBoardPng } from "@/canvas/export";
import { PALETTES } from "@/canvas/theme";
import { saveBoardDoc } from "@/lib/board-doc";
import { VosCanvas } from "@/components/canvas/VosCanvas";
import { CanvasRail, runTool } from "@/components/canvas/CanvasRail";
import { SelectionToolbar } from "@/components/canvas/SelectionToolbar";
import { MobileBar } from "@/components/canvas/MobileBar";
import { CanvasActionsProvider, useCanvasActions } from "@/components/canvas/CanvasActions";
import { BoardTopBar, type BoardChrome } from "@/components/canvas/BoardTopBar";
import { DRAG_MIME } from "@/components/canvas/tools";
import { ZoomControls } from "@/components/vos/ZoomControls";
import { DocumentWindow } from "@/components/canvas/DocumentWindow";
import { CommentsPanel } from "@/components/CommentsPanel";
import { useTheme } from "@/components/ThemeProvider";

const SAVE_DEBOUNCE_MS = 800;

export function BoardShell({
  boardId,
  initialDoc,
  chrome,
  readonly,
  canComment,
  boardCounts,
}: {
  boardId: string;
  initialDoc: Doc;
  chrome: BoardChrome;
  readonly: boolean;
  canComment: boolean;
  boardCounts: Record<string, number>;
}) {
  const editor = useMemo(() => new BoardEditor(initialDoc), [initialDoc]);

  useEffect(() => {
    editor.setReadonly(readonly);
  }, [editor, readonly]);

  return (
    <CanvasActionsProvider editor={editor} boardId={boardId}>
      <BoardSurface
        editor={editor}
        boardId={boardId}
        chrome={chrome}
        readonly={readonly}
        canComment={canComment}
        boardCounts={boardCounts}
      />
    </CanvasActionsProvider>
  );
}

function BoardSurface({
  editor,
  boardId,
  chrome,
  readonly,
  canComment,
  boardCounts,
}: {
  editor: BoardEditor;
  boardId: string;
  chrome: BoardChrome;
  readonly: boolean;
  canComment: boolean;
  boardCounts: Record<string, number>;
}) {
  const router = useRouter();
  const actions = useCanvasActions();
  const { theme } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Autosave. Debounced so a drag doesn't fire a request per frame, and
  // flushed on unload so closing the tab mid-edit doesn't lose the last change.
  useEffect(() => {
    if (readonly) return;

    const flush = async () => {
      if (!dirty.current) return;
      dirty.current = false;
      setSaveState("saving");
      try {
        await saveBoardDoc(boardId, editor.store.getDoc());
        setSaveState("idle");
      } catch (error) {
        console.error("[board] save failed", error);
        dirty.current = true;
        setSaveState("error");
      }
    };

    const unsubscribe = editor.store.subscribe(() => {
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    });

    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void flush();
    };
  }, [editor, boardId, readonly]);

  // Opening a nested board is navigation, which the editor has no business
  // knowing about — it just announces the intent.
  useEffect(
    () =>
      editor.subscribe((event) => {
        if (event.type === "openBoard") router.push(`/board/${event.nodeId}`);
        if (event.type === "requestEdit") editor.setEditing(event.itemId);
        if (event.type === "requestImage") actions.fillImage(event.itemId);
        if (event.type === "requestDocument") setDocumentId(event.itemId);
      }),
    [editor, router, actions],
  );

  const onExport = useCallback(async () => {
    const ok = await exportBoardPng(editor.store.getItems(), PALETTES[theme], {
      filename: `${chrome.title || "board"}.png`,
      boardCounts,
    });
    if (!ok) console.warn("[board] nothing to export");
  }, [editor, theme, chrome.title, boardCounts]);

  // Dropping a rail button on the canvas creates that item at the drop point.
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const tool = e.dataTransfer.getData(DRAG_MIME) as ToolId;
      if (!tool || readonly) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const at = editor.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      runTool(editor, actions, tool, at);
    },
    [editor, actions, readonly],
  );

  return (
    <div
      className="absolute inset-0"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(DRAG_MIME)) e.preventDefault();
      }}
      onDrop={onDrop}
    >
      <VosCanvas editor={editor} boardCounts={boardCounts} />

      <BoardTopBar
        editor={editor}
        chrome={chrome}
        onExport={onExport}
        onToggleComments={() => setCommentsOpen((v) => !v)}
        saveState={saveState}
      />

      <CanvasRail editor={editor} />
      <SelectionToolbar editor={editor} />
      <span className="hidden md:contents">
        <ZoomControls editor={editor} />
      </span>
      <MobileBar editor={editor} />

      {documentId && (
        <DocumentWindow editor={editor} itemId={documentId} onClose={() => setDocumentId(null)} />
      )}

      <CommentsPanel
        boardId={boardId}
        canPost={canComment}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        hideTrigger
      />
    </div>
  );
}
