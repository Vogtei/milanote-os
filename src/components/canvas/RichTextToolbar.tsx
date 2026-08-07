"use client";

import { useEffect, useState, type RefObject } from "react";
import type { BoardEditor } from "@/canvas/editor";
import { PALETTES, NOTE_COLORS } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorTick } from "@/components/canvas/useEditorTick";

const SIZES = [12, 15, 20, 28];
const BAR_HEIGHT = 44;
const OFFSET = 12;
const MARGIN = 10;

/**
 * Floating formatting bar for the note editor, positioned above the card
 * (below it if there's no room). Every button acts on the DOM Selection
 * inside the contentEditable `target`, via `execCommand` for the operations
 * it covers natively (bold/italic/underline/lists/align/colour) and a manual
 * span-wrap for font size, which `execCommand('fontSize')` can't do in real
 * pixels.
 *
 * `onMouseDown` calls `preventDefault()` on every button — without it, the
 * mousedown would blur the contentEditable and collapse the selection before
 * the click's command ever runs.
 */
export function RichTextToolbar({
  editor,
  target,
  noteId,
  onChanged,
}: {
  editor: BoardEditor;
  target: RefObject<HTMLDivElement | null>;
  noteId: string;
  onChanged: () => void;
}) {
  useEditorTick(editor);
  const { theme } = useTheme();
  const palette = PALETTES[theme];
  const [colorOpen, setColorOpen] = useState(false);
  // Selection state (queryCommandState) doesn't trigger React re-renders on
  // its own — a selectionchange listener bumps this to keep the active
  // button highlighting in sync with where the caret actually is.
  const [, bump] = useState(0);

  useEffect(() => {
    const onSelectionChange = () => {
      if (target.current?.contains(document.getSelection()?.anchorNode ?? null)) bump((n) => n + 1);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [target]);

  const item = editor.store.getItem(noteId);
  const rect = editor.getSelectionScreenRect();
  if (!item || item.type !== "note" || !rect) return null;

  const viewport = editor.getSize();
  const above = rect.y - OFFSET - BAR_HEIGHT >= MARGIN;
  const top = above ? rect.y - OFFSET - BAR_HEIGHT : rect.y + rect.h + OFFSET;
  const centre = rect.x + rect.w / 2;

  const focusBack = () => target.current?.focus();

  const exec = (command: string, value?: string) => {
    focusBack();
    document.execCommand(command, false, value);
    onChanged();
    bump((n) => n + 1);
  };

  const applySize = (size: number) => {
    const el = target.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    const span = document.createElement("span");
    span.style.fontSize = `${size}px`;
    try {
      range.surroundContents(span);
    } catch {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    selection.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(span);
    selection.addRange(next);
    onChanged();
  };

  const active = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };

  return (
    <div
      className="vos-panel vos-panel-shadow pointer-events-auto absolute z-[296] flex h-[44px] -translate-x-1/2 items-center gap-0.5 rounded-[14px] px-1.5"
      style={{
        left: Math.min(Math.max(centre, 140), Math.max(140, viewport.w - 140)),
        top: Math.min(Math.max(top, MARGIN), Math.max(MARGIN, viewport.h - BAR_HEIGHT - MARGIN)),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <SizeMenu onPick={applySize} />

      <Divider />

      <div className="relative">
        <button
          title="Farbe"
          aria-label="Farbe"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setColorOpen((v) => !v)}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--vos-hover-soft)]"
        >
          <span className="h-4 w-4 rounded-full border border-[var(--vos-border)]" style={{ background: palette.text }} />
        </button>
        {colorOpen && (
          <div className="vos-panel vos-panel-shadow absolute left-0 top-[42px] grid grid-cols-4 gap-2 rounded-2xl p-2.5">
            {NOTE_COLORS.map((color) => (
              <button
                key={color}
                aria-label={color}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  exec("foreColor", palette.stroke[color]);
                  setColorOpen(false);
                }}
                className="h-6 w-6 rounded-full border transition-transform hover:scale-110"
                style={{ background: palette.stroke[color], borderColor: palette.note[color].border }}
              />
            ))}
          </div>
        )}
      </div>

      <Divider />

      <Btn label="Fett" active={active("bold")} onClick={() => exec("bold")}>
        <strong className="text-[13px]">B</strong>
      </Btn>
      <Btn label="Kursiv" active={active("italic")} onClick={() => exec("italic")}>
        <em className="text-[13px]">I</em>
      </Btn>
      <Btn label="Unterstrichen" active={active("underline")} onClick={() => exec("underline")}>
        <span className="text-[13px] underline">U</span>
      </Btn>

      <Divider />

      <Btn label="Liste" active={active("insertUnorderedList")} onClick={() => exec("insertUnorderedList")}>
        <ListIcon />
      </Btn>
      <Btn label="Nummerierte Liste" active={active("insertOrderedList")} onClick={() => exec("insertOrderedList")}>
        <NumberedIcon />
      </Btn>

      <Divider />

      <Btn label="Linksbündig" active={active("justifyLeft")} onClick={() => exec("justifyLeft")}>
        <AlignIcon variant="left" />
      </Btn>
      <Btn label="Zentriert" active={active("justifyCenter")} onClick={() => exec("justifyCenter")}>
        <AlignIcon variant="center" />
      </Btn>
      <Btn label="Rechtsbündig" active={active("justifyRight")} onClick={() => exec("justifyRight")}>
        <AlignIcon variant="right" />
      </Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  onClick,
  onMouseDown,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onMouseDown?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown?.();
      }}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
        active
          ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
          : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      }`}
    >
      {children}
    </button>
  );
}

function SizeMenu({ onPick }: { onPick: (size: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        title="Größe"
        aria-label="Größe"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-9 place-items-center rounded-lg text-[13px] font-medium text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      >
        Aa
      </button>
      {open && (
        <div className="vos-panel vos-panel-shadow absolute left-0 top-[42px] flex flex-col gap-0.5 rounded-xl p-1.5">
          {SIZES.map((size) => (
            <button
              key={size}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(size);
                setOpen(false);
              }}
              className="rounded-lg px-3 py-1.5 text-left text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
              style={{ fontSize: Math.min(size, 18) }}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-[var(--vos-border)]" />;
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
      <path d="M9 7h11M9 12h11M9 17h11" />
    </svg>
  );
}

function NumberedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7h11M9 12h11M9 17h11" />
      <text x="2" y="9" fontSize="7" fill="currentColor" stroke="none">1</text>
      <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
      <text x="2" y="19" fontSize="7" fill="currentColor" stroke="none">3</text>
    </svg>
  );
}

function AlignIcon({ variant }: { variant: "left" | "center" | "right" }) {
  const lines =
    variant === "left"
      ? [[4, 6, 20, 6], [4, 12, 14, 12], [4, 18, 17, 18]]
      : variant === "center"
        ? [[4, 6, 20, 6], [7, 12, 17, 12], [5.5, 18, 18.5, 18]]
        : [[4, 6, 20, 6], [10, 12, 20, 12], [7, 18, 20, 18]];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  );
}
