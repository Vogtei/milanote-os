"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardEditor, ToolId } from "@/canvas/editor";
import type { ShapeKind } from "@/canvas/types";
import { SHAPE_KINDS } from "@/canvas/types";
import { NOTE_COLORS, PALETTES } from "@/canvas/theme";
import { DRAG_MIME, SHAPE_KIND_MIME, TOOLS } from "@/components/canvas/tools";
import { useCanvasActions } from "@/components/canvas/CanvasActions";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";
import { EraserIcon, HighlighterIcon } from "@/components/icons/VosIcons";
import { ShapeGlyph } from "@/components/canvas/ShapeGlyph";

/**
 * Desktop tool rail. Permanent — selection options live in a floating bar
 * above the element instead, so the tools never move.
 *
 * Hidden below `md`, where the FAB and bottom sheet take over: a 64px column
 * is a fifth of a phone screen, and popovers anchored to its right edge run
 * straight off the viewport.
 */
export function CanvasRail({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const actions = useCanvasActions();
  const [popover, setPopover] = useState<"shape" | "draw" | null>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setPopover(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [popover]);

  if (editor.isReadonly()) return null;
  const active = editor.getTool();

  return (
    <aside
      ref={railRef}
      className="vos-panel pointer-events-auto absolute left-2.5 top-1/2 z-[280] hidden w-16 -translate-y-1/2 flex-col items-center gap-0.5 overflow-y-auto rounded-[15px] py-2.5 md:flex"
      style={{ maxHeight: "calc(100% - 130px)" }}
      aria-label="Werkzeuge"
    >
      {TOOLS.map((tool) => (
        <div key={tool.id} className="relative">
          <RailButton
            label={tool.label}
            active={active === tool.id}
            icon={<tool.icon size={22} />}
            dragToolId={tool.id}
            onClick={() => {
              if (tool.popover) {
                editor.setTool(tool.id);
                setPopover((open) => (open === tool.popover ? null : tool.popover!));
                return;
              }
              setPopover(null);
              runTool(editor, actions, tool.id);
            }}
          />
          {popover === "shape" && tool.popover === "shape" && <ShapePicker editor={editor} />}
          {popover === "draw" && tool.popover === "draw" && <DrawOptions editor={editor} />}
        </div>
      ))}
    </aside>
  );
}

/** Shared by the rail, the mobile sheet and the canvas drop handler. */
export function runTool(
  editor: BoardEditor,
  actions: ReturnType<typeof useCanvasActions>,
  id: ToolId,
  at?: { x: number; y: number },
  shapeKind?: ShapeKind,
) {
  switch (id) {
    case "link": return actions.promptLink(at);
    case "board": return actions.createBoard(at);
    case "image": return actions.pickImage(at);
    case "file": return actions.pickFile(at);
    case "shape":
      // A specific glyph was dragged straight out of the popover — place it
      // at the drop point instead of just arming the tool for a manual draw.
      if (at && shapeKind) {
        const item = editor.createItem("shape", at, { kind: shapeKind });
        editor.setSelection([item.id]);
        return;
      }
      editor.setTool(id);
      return;
    default:
      // Placement tools arm themselves; if a drop point is known, place the
      // item there immediately instead of making the user click twice.
      if (at && (id === "note" || id === "text" || id === "todo" || id === "document")) {
        const item = editor.createItem(id, at);
        if (id === "todo") {
          editor.beginTodoEntry(item.id);
          return;
        }
        editor.setSelection([item.id]);
        if (id === "note" || id === "text") editor.setEditing(item.id);
        return;
      }
      editor.setTool(id);
  }
}

const POPOVER = "vos-panel vos-panel-shadow absolute left-[60px] top-0 z-[400] rounded-2xl p-2.5";

function ShapePicker({ editor }: { editor: BoardEditor }) {
  const current = editor.getShapeKind();
  return (
    <div className={`${POPOVER} grid w-[168px] grid-cols-3 gap-1`} role="group" aria-label="Formen">
      {SHAPE_KINDS.map((kind) => (
        <button
          key={kind}
          aria-label={kind}
          aria-pressed={current === kind}
          onClick={() => editor.setShapeKind(kind)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, "shape");
            e.dataTransfer.setData(SHAPE_KIND_MIME, kind);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className={`grid h-[46px] cursor-grab place-items-center rounded-xl transition-colors active:cursor-grabbing ${
            current === kind
              ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
              : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
          }`}
        >
          <ShapeGlyph kind={kind as ShapeKind} size={22} />
        </button>
      ))}
    </div>
  );
}

const STROKE_WIDTHS = [2, 4, 8, 14];

function DrawOptions({ editor }: { editor: BoardEditor }) {
  const { theme } = useTheme();
  const palette = PALETTES[theme];
  const color = editor.getColor();
  const width = editor.getStrokeWidth();
  const highlighter = editor.isHighlighter();

  return (
    <div className={`${POPOVER} w-[168px]`} role="group" aria-label="Zeichnen">
      <div className="grid grid-cols-5 gap-1.5">
        {NOTE_COLORS.map((option) => (
          <button
            key={option}
            aria-label={`Farbe ${option}`}
            aria-pressed={color === option}
            onClick={() => editor.setColor(option)}
            className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
              color === option ? "ring-2 ring-[var(--vos-text-strong)] ring-offset-2 ring-offset-transparent" : ""
            }`}
            style={{ background: palette.stroke[option], borderColor: palette.note[option].border }}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-1">
        {STROKE_WIDTHS.map((option) => (
          <button
            key={option}
            aria-label={`Stärke ${option}`}
            aria-pressed={width === option}
            onClick={() => editor.setStrokeWidth(option)}
            className={`grid h-8 w-8 place-items-center rounded-lg ${
              width === option ? "bg-[var(--vos-hover)]" : "hover:bg-[var(--vos-hover-soft)]"
            }`}
          >
            <span
              className="rounded-full bg-[var(--vos-text-strong)]"
              style={{ width: 4 + option * 0.7, height: 4 + option * 0.7 }}
            />
          </button>
        ))}
      </div>

      <button
        onClick={() => editor.setHighlighter(!highlighter)}
        aria-pressed={highlighter}
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium ${
          highlighter
            ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
            : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
        }`}
      >
        <HighlighterIcon size={15} /> Textmarker
      </button>
      <button
        onClick={() => editor.setTool("eraser")}
        aria-pressed={editor.getTool() === "eraser"}
        className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-medium ${
          editor.getTool() === "eraser"
            ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
            : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
        }`}
      >
        <EraserIcon size={15} /> Radierer
      </button>
    </div>
  );
}

export function RailButton({
  icon,
  label,
  active,
  dragToolId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  dragToolId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      draggable={!!dragToolId}
      onDragStart={
        dragToolId
          ? (e) => {
              e.dataTransfer.setData(DRAG_MIME, dragToolId);
              e.dataTransfer.effectAllowed = "copy";
            }
          : undefined
      }
      className={`flex h-[50px] w-[52px] shrink-0 flex-col items-center gap-[3px] rounded-[10px] border-0 pb-1.5 pt-2 text-[10px] font-medium transition-colors ${
        dragToolId ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${
        active
          ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
          : "bg-transparent text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      }`}
    >
      <span className="flex h-[22px] w-[22px] items-center justify-center text-inherit">{icon}</span>
      <span className="leading-none text-inherit">{label}</span>
    </button>
  );
}
