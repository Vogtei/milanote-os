"use client";

import { useEffect, useRef, useState } from "react";
import { Tldraw, exportAs } from "tldraw";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";
import {
  shapeUtils,
  textOptions,
  milanoteComponents,
  StatusBanner,
  type BoardChrome,
} from "@/components/BoardCanvas";
import { BoardTopBar } from "@/components/BoardTopBar";
import { ZoomControls } from "@/components/vos/ZoomControls";
import { minioAssetStore } from "@/lib/asset-store";
import { saveSnapshot, loadSnapshot } from "@/lib/offline-cache";

const AUTOSAVE_MS = 3000;

// Fully local editor with no server connection — used when useSync can't
// reach the sync server at all (cold start while offline) or when the user
// deliberately chooses to work offline. Autosaves to IndexedDB so edits
// survive a reload; a real resync happens later via the parent's "Jetzt
// synchronisieren" flow, which reads this same cache.
export function OfflineBoardCanvas({
  id,
  chrome,
  onTryReconnect,
}: {
  id: string;
  chrome: BoardChrome;
  onTryReconnect: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSnapshot(id).then((cached) => {
      if (cancelled) return;
      if (cached && editorRef.current) {
        editorRef.current.loadSnapshot(cached.snapshot as never);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleMount(editor: Editor) {
    editorRef.current = editor;
    setEditor(editor);
    editor.user.updateUserPreferences({ colorScheme: "dark" });
    editor.updateInstanceState({ isGridMode: true });
    const interval = setInterval(() => {
      saveSnapshot(id, editor.getSnapshot());
    }, AUTOSAVE_MS);
    editor.disposables.add(() => clearInterval(interval));
  }

  async function exportBoard() {
    if (!editor) return;
    const ids = [...editor.getCurrentPageShapeIds()];
    if (ids.length === 0) return;
    await exportAs(editor, ids, { format: "png", name: "board" });
  }

  return (
    <div className="relative h-full w-full">
      {ready && (
        <Tldraw
          shapeUtils={shapeUtils}
          assets={minioAssetStore}
          onMount={handleMount}
          components={milanoteComponents}
          textOptions={textOptions}
        />
      )}

      <BoardTopBar
        {...chrome}
        editor={editor}
        readonly={false}
        onExport={exportBoard}
      />

      {editor && <ZoomControls editor={editor} />}

      <StatusBanner>
        <span>Offline-Modus — läuft lokal weiter</span>
        <button onClick={onTryReconnect} className="font-medium text-[rgb(244,243,239)] underline">
          Jetzt synchronisieren
        </button>
      </StatusBanner>
    </div>
  );
}
