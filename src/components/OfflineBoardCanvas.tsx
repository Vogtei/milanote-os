"use client";

import { useEffect, useRef, useState } from "react";
import { Tldraw, defaultShapeUtils } from "tldraw";
import type { Editor } from "tldraw";
import "tldraw/tldraw.css";
import { BoardLinkShapeUtil } from "@/components/BoardLinkShape";
import { TodoShapeUtil } from "@/components/TodoShape";
import { minioAssetStore } from "@/lib/asset-store";
import { saveSnapshot, loadSnapshot } from "@/lib/offline-cache";

const shapeUtils = [...defaultShapeUtils, BoardLinkShapeUtil, TodoShapeUtil];
const AUTOSAVE_MS = 3000;

// Fully local editor with no server connection — used when useSync can't
// reach the sync server at all (cold start while offline) or when the user
// deliberately chooses to work offline. Autosaves to IndexedDB so edits
// survive a reload; a real resync happens later via the parent's "Jetzt
// synchronisieren" flow, which reads this same cache.
export function OfflineBoardCanvas({
  id,
  onTryReconnect,
}: {
  id: string;
  onTryReconnect: () => void;
}) {
  const [ready, setReady] = useState(false);
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
    const interval = setInterval(() => {
      saveSnapshot(id, editor.getSnapshot());
    }, AUTOSAVE_MS);
    editor.disposables.add(() => clearInterval(interval));
  }

  return (
    <div className="relative h-full w-full">
      {ready && <Tldraw shapeUtils={shapeUtils} assets={minioAssetStore} onMount={handleMount} />}
      <div className="absolute left-3 top-3 z-[300] flex items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          Offline-Modus — läuft lokal weiter
        </span>
        <button
          onClick={onTryReconnect}
          className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Jetzt synchronisieren
        </button>
      </div>
    </div>
  );
}
