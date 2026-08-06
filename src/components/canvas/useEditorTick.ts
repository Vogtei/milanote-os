"use client";

import { useEffect, useState } from "react";
import type { BoardEditor } from "@/canvas/editor";

/**
 * Re-renders the calling component whenever the editor changes. The canvas
 * repaints itself off the same subscription; this is only for the surrounding
 * React chrome (rail active state, undo availability, selection panel).
 */
export function useEditorTick(editor: BoardEditor) {
  const [, bump] = useState(0);
  useEffect(() => editor.subscribe(() => bump((n) => n + 1)), [editor]);
}
