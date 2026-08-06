"use client";

import { useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import type { NoteColor } from "@/canvas/types";
import { NOTE_COLORS, PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { TrashIcon } from "@/components/icons/MilanoteIcons";
import { CopyIcon, LockIcon, UnlockIcon } from "@/components/icons/VosIcons";

const BAR_HEIGHT = 44;
/** Gap between the bar and the top edge of the selection. */
const OFFSET = 14;
const MARGIN = 10;

/**
 * Floating options bar for the current selection, anchored just above the
 * selected element. Deliberately *not* a replacement for the left rail — the
 * rail stays put, so the tools you reach for constantly never move.
 *
 * Positioned in screen space and clamped to the viewport, so it stays reachable
 * for an element scrolled to the edge; flips below the selection when there's
 * no room above.
 */
export function SelectionToolbar({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const { theme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const selected = editor.getSelectedItems();
  const rect = editor.getSelectionScreenRect();

  // Hidden while editing text: the bar would sit on top of the caret area and
  // steal focus from the textarea on every click.
  if (editor.isReadonly() || selected.length === 0 || !rect || editor.getEditingId()) return null;

  const viewport = editor.getSize();
  const colorable = selected.filter((item) => "color" in item.props);
  const currentColor = colorable.length > 0 ? (colorable[0].props as { color: NoteColor }).color : null;
  const locked = editor.isSelectionLocked();
  const palette = PALETTES[theme];

  const above = rect.y - OFFSET - BAR_HEIGHT >= MARGIN;
  const top = above ? rect.y - OFFSET - BAR_HEIGHT : rect.y + rect.h + OFFSET;
  const centre = rect.x + rect.w / 2;

  return (
    <div
      className="vos-panel vos-panel-shadow pointer-events-auto absolute z-[295] flex h-[44px] -translate-x-1/2 items-center gap-1 rounded-[14px] px-1.5"
      style={{
        left: Math.min(Math.max(centre, 90), Math.max(90, viewport.w - 90)),
        top: Math.min(Math.max(top, MARGIN), Math.max(MARGIN, viewport.h - BAR_HEIGHT - MARGIN)),
      }}
      // The canvas clears the selection on pointerdown; keep clicks in here
      // from reaching it.
      onPointerDown={(e) => e.stopPropagation()}
    >
      {currentColor && (
        <div className="relative">
          <button
            aria-label="Farbe"
            title="Farbe"
            onClick={() => setPaletteOpen((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg hover:bg-[var(--vos-hover-soft)]"
          >
            <span
              className="h-[18px] w-[18px] rounded-full border"
              style={{
                background: palette.note[currentColor].fill,
                borderColor: palette.note[currentColor].border,
              }}
            />
          </button>
          {paletteOpen && (
            <div className="vos-panel vos-panel-shadow absolute left-0 top-[42px] grid grid-cols-4 gap-2 rounded-2xl p-2.5">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={`Farbe ${color}`}
                  onClick={() => {
                    editor.setColor(color);
                    setPaletteOpen(false);
                  }}
                  className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                    currentColor === color ? "ring-2 ring-[var(--vos-text-strong)] ring-offset-2 ring-offset-transparent" : ""
                  }`}
                  style={{
                    background: palette.note[color].fill,
                    borderColor: palette.note[color].border,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {currentColor && <Divider />}

      <BarButton
        label={locked ? "Entsperren" : "Sperren"}
        active={locked}
        onClick={() => editor.toggleSelectionLock()}
      >
        {locked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
      </BarButton>

      <Divider />

      <BarButton label="Duplizieren" onClick={() => editor.duplicateSelection()}>
        <CopyIcon size={18} />
      </BarButton>
      <BarButton label="Löschen" danger onClick={() => editor.deleteSelection()}>
        <TrashIcon size={18} />
      </BarButton>
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-[var(--vos-border)]" />;
}

function BarButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${
        active
          ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
          : danger
            ? "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-danger)]"
            : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      }`}
    >
      {children}
    </button>
  );
}
