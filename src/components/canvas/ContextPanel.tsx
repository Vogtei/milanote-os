"use client";

import type { BoardEditor } from "@/canvas/editor";
import type { NoteColor } from "@/canvas/types";
import { NOTE_COLORS, PALETTES } from "@/canvas/theme";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { TrashIcon } from "@/components/icons/MilanoteIcons";
import { PlusIcon } from "@/components/icons/VosIcons";

/**
 * Replaces the tool rail while something is selected — the reference app does
 * the same, and it's the right call: once you've made a thing, the useful
 * controls are the ones that change *that thing*, not the ones that make
 * another one.
 *
 * Sits in the same slot and shares the rail's geometry so the swap doesn't
 * shift the layout.
 */
export function ContextPanel({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const { theme } = useTheme();

  const selected = editor.getSelectedItems();
  if (editor.isReadonly() || selected.length === 0) return null;

  const colorable = selected.filter((item) => "color" in item.props);
  const palette = PALETTES[theme];
  const current = colorable.length > 0 ? (colorable[0].props as { color: NoteColor }).color : null;

  return (
    <aside
      className="vos-panel vos-panel-shadow pointer-events-auto absolute left-2.5 top-1/2 z-[285] hidden w-16 -translate-y-1/2 flex-col items-center gap-1 rounded-[15px] py-2.5 md:flex"
      aria-label="Auswahl"
    >
      <span className="px-1 text-center text-[10px] leading-tight text-[var(--vos-faint)]">
        {selected.length === 1 ? "1 Element" : `${selected.length} Elemente`}
      </span>

      {colorable.length > 0 && (
        <div className="grid grid-cols-2 gap-1 px-2 pb-1 pt-1">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              title={color}
              aria-label={`Farbe ${color}`}
              aria-pressed={current === color}
              onClick={() => editor.setColor(color)}
              className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                current === color ? "ring-2 ring-[var(--vos-text-strong)] ring-offset-1 ring-offset-transparent" : ""
              }`}
              style={{
                background: palette.note[color].fill,
                borderColor: palette.note[color].border,
              }}
            />
          ))}
        </div>
      )}

      <span className="my-1 h-px w-9 bg-[var(--vos-border)]" />

      <PanelButton label="Duplizieren" onClick={() => editor.duplicateSelection()}>
        <PlusIcon size={18} />
      </PanelButton>
      <PanelButton label="Nach vorn" onClick={() => editor.bringToFront()}>
        <LayerIcon up />
      </PanelButton>
      <PanelButton label="Nach hinten" onClick={() => editor.sendToBack()}>
        <LayerIcon />
      </PanelButton>
      <PanelButton label="Löschen" danger onClick={() => editor.deleteSelection()}>
        <TrashIcon size={18} />
      </PanelButton>
    </aside>
  );
}

function PanelButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-[44px] w-[52px] shrink-0 flex-col items-center justify-center gap-[3px] rounded-[10px] text-[9px] font-medium transition-colors ${
        danger
          ? "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-danger)]"
          : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      }`}
    >
      {children}
      <span className="leading-none">{label}</span>
    </button>
  );
}

function LayerIcon({ up }: { up?: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: up ? undefined : "rotate(180deg)" }}
    >
      <path d="M12 4 5 8l7 4 7-4-7-4Z" />
      <path d="M5 14l7 4 7-4" />
    </svg>
  );
}
