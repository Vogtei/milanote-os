"use client";

import { useEffect, useRef } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { countWords } from "@/canvas/renderer";

/**
 * A document opens in its own window rather than being edited on the canvas —
 * long-form text wants a column of readable width, not a card scaled by the
 * viewport transform.
 *
 * Edits go straight into the store, so the board's autosave covers this with
 * no separate save button.
 */
export function DocumentWindow({
  editor,
  itemId,
  onClose,
}: {
  editor: BoardEditor;
  itemId: string;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const item = editor.store.getItem(itemId);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  if (!item || item.type !== "document") return null;
  const readonly = editor.isReadonly();
  const words = countWords(item.props.content);

  const update = (patch: { title?: string; content?: string }) =>
    editor.store.transact(() => editor.store.updateProps(itemId, patch as never));

  return (
    <div className="fixed inset-0 z-[400] flex items-stretch justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="vos-panel vos-panel-shadow flex h-full w-full flex-col overflow-hidden rounded-none sm:h-[min(760px,100%)] sm:max-w-3xl sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-[var(--vos-border)] px-3 py-2.5">
          <button
            onClick={onClose}
            aria-label="Zurück"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="14,6 8,12 14,18" />
            </svg>
          </button>
          <input
            value={item.props.title}
            readOnly={readonly}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Dokument"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--vos-text-strong)] outline-none placeholder:text-[var(--vos-faint)]"
          />
          <span className="shrink-0 text-[12px] tabular-nums text-[var(--vos-faint)]">
            {words === 1 ? "1 Wort" : `${words} Wörter`}
          </span>
        </header>

        <textarea
          ref={bodyRef}
          value={item.props.content}
          readOnly={readonly}
          onChange={(e) => update({ content: e.target.value })}
          placeholder="Schreib los…"
          spellCheck={false}
          className="mx-auto w-full max-w-[68ch] flex-1 resize-none bg-transparent px-5 py-6 text-[15px] leading-[1.7] text-[var(--vos-text)] outline-none placeholder:text-[var(--vos-faint)]"
        />
      </div>
    </div>
  );
}
