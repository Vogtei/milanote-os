"use client";

import { useState } from "react";
import type { BoardEditor } from "@/canvas/editor";
import type { NoteColor } from "@/canvas/types";
import { NOTE_COLORS, PALETTES } from "@/canvas/theme";
import { TOOLS } from "@/components/canvas/tools";
import { runTool } from "@/components/canvas/CanvasRail";
import { useCanvasActions } from "@/components/canvas/CanvasActions";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";
import { PlusIcon, UndoIcon, RedoIcon, FitIcon } from "@/components/icons/VosIcons";
import { TrashIcon } from "@/components/icons/MilanoteIcons";

/**
 * Everything the desktop puts in a permanent left rail, rearranged for a phone:
 * a history pill and fit button bottom-left, an add button bottom-right that
 * opens a sheet of tools, and a selection bar that replaces both while
 * something is selected.
 *
 * All of it is hidden from `md` up, where the rail and zoom pill take over.
 */
export function MobileBar({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const actions = useCanvasActions();
  const { theme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const readonly = editor.isReadonly();
  const selected = editor.getSelectedItems();
  const hasSelection = selected.length > 0;

  return (
    <div className="md:hidden">
      {/* Bottom-left: history + fit. Sits above the safe-area inset so it
          clears the iOS home indicator. */}
      <div
        className="vos-panel vos-panel-shadow absolute left-3.5 z-[290] flex h-[50px] items-center gap-1 rounded-[14px] px-1.5"
        style={{ bottom: "calc(14px + env(safe-area-inset-bottom))" }}
      >
        {!readonly && (
          <>
            <RoundBtn label="Rückgängig" disabled={!editor.canUndo()} onClick={() => editor.undo()}>
              <UndoIcon size={20} />
            </RoundBtn>
            <span className="h-5 w-px bg-[var(--vos-border)]" />
            <RoundBtn label="Wiederholen" disabled={!editor.canRedo()} onClick={() => editor.redo()}>
              <RedoIcon size={20} />
            </RoundBtn>
            <span className="h-5 w-px bg-[var(--vos-border)]" />
          </>
        )}
        <RoundBtn label="Einpassen" onClick={() => editor.zoomToFit()}>
          <FitIcon size={20} />
        </RoundBtn>
      </div>

      {!readonly && !hasSelection && (
        <button
          onClick={() => setSheetOpen(true)}
          aria-label="Element hinzufügen"
          className="vos-panel-shadow absolute right-3.5 z-[290] grid h-14 w-14 place-items-center rounded-[18px] border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] text-[var(--vos-text-strong)] active:scale-95"
          style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <PlusIcon size={26} />
        </button>
      )}

      {!readonly && hasSelection && (
        <div
          className="vos-panel vos-panel-shadow absolute right-3.5 z-[290] flex h-[50px] items-center gap-1 rounded-[14px] px-1.5"
          style={{ bottom: "calc(14px + env(safe-area-inset-bottom))" }}
        >
          <ColorPicker editor={editor} selectedColor={colorOf(selected)} theme={theme} />
          <RoundBtn label="Duplizieren" onClick={() => editor.duplicateSelection()}>
            <PlusIcon size={20} />
          </RoundBtn>
          <RoundBtn label="Löschen" danger onClick={() => editor.deleteSelection()}>
            <TrashIcon size={20} />
          </RoundBtn>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-[320]" role="dialog" aria-label="Element hinzufügen">
          <button
            aria-label="Schließen"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
          />
          <div
            className="vos-panel vos-panel-shadow absolute inset-x-0 bottom-0 rounded-t-3xl px-4 pt-2"
            style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--vos-border)]" />
            <div className="grid grid-cols-4 gap-2">
              {TOOLS.filter((tool) => tool.id !== "select").map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setSheetOpen(false);
                    runTool(editor, actions, tool.id, centerOf(editor));
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-[11px] font-medium text-[var(--vos-muted)] active:bg-[var(--vos-hover-soft)]"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--vos-hover-soft)] text-[var(--vos-text-strong)]">
                    <tool.icon size={22} />
                  </span>
                  {tool.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** New items from the sheet land in the middle of the current view — the user
 *  never pointed anywhere, so the visible centre is the only sensible spot. */
function centerOf(editor: BoardEditor) {
  const { w, h } = editor.getSize();
  return editor.screenToWorld({ x: w / 2, y: h / 2 });
}

function colorOf(selected: ReturnType<BoardEditor["getSelectedItems"]>): NoteColor | null {
  const first = selected.find((item) => "color" in item.props);
  return first ? (first.props as { color: NoteColor }).color : null;
}

function ColorPicker({
  editor,
  selectedColor,
  theme,
}: {
  editor: BoardEditor;
  selectedColor: NoteColor | null;
  theme: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  if (!selectedColor) return null;
  const palette = PALETTES[theme];

  return (
    <div className="relative">
      <button
        aria-label="Farbe"
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center rounded-xl active:bg-[var(--vos-hover-soft)]"
      >
        <span
          className="h-5 w-5 rounded-full border"
          style={{
            background: palette.note[selectedColor].fill,
            borderColor: palette.note[selectedColor].border,
          }}
        />
      </button>
      {open && (
        <div className="vos-panel vos-panel-shadow absolute bottom-[52px] right-0 grid grid-cols-4 gap-2 rounded-2xl p-2.5">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              aria-label={`Farbe ${color}`}
              onClick={() => {
                editor.setColor(color);
                setOpen(false);
              }}
              className="h-7 w-7 rounded-full border"
              style={{
                background: palette.note[color].fill,
                borderColor: palette.note[color].border,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundBtn({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-10 w-10 place-items-center rounded-xl transition-colors disabled:opacity-35 ${
        danger
          ? "text-[var(--vos-muted)] active:text-[var(--vos-danger)]"
          : "text-[var(--vos-muted)] active:bg-[var(--vos-hover-soft)] active:text-[var(--vos-text-strong)]"
      }`}
    >
      {children}
    </button>
  );
}
