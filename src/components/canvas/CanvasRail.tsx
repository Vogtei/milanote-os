"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardEditor, ToolId } from "@/canvas/editor";
import type { ShapeKind } from "@/canvas/types";
import { SHAPE_KINDS } from "@/canvas/types";
import { NOTE_COLORS, PALETTES } from "@/canvas/theme";
import { DRAG_MIME, SHAPE_KIND_MIME, TOOLS, type ToolSpec } from "@/components/canvas/tools";
import { useCanvasActions } from "@/components/canvas/CanvasActions";
import { useEditorTick } from "@/components/canvas/useEditorTick";
import { useTheme } from "@/components/ThemeProvider";
import { EraserIcon, HighlighterIcon, KebabIcon } from "@/components/icons/VosIcons";
import { TrashIcon } from "@/components/icons/MilanoteIcons";
import { ShapeGlyph } from "@/components/canvas/ShapeGlyph";

/** Fixed pixel dimensions of a RailButton (h-[50px]) plus the rail's own
 *  gap-0.5 (2px) and py-2.5 (10px top + 10px bottom) — used to work out how
 *  many tools fit before the rest have to collapse into the "…" menu. */
const BUTTON_H = 50;
const GAP = 2;
const PADDING = 20;
/** Matches the vertical clearance the rail always kept from the top/bottom
 *  chrome before this became a fixed-height layout. */
const CHROME_CLEARANCE = 130;
const MIN_RAIL_H = BUTTON_H * 2 + PADDING;

function toolsHeight(count: number): number {
  return count <= 0 ? 0 : count * BUTTON_H + (count - 1) * GAP;
}

/**
 * Desktop tool rail. Permanent — selection options live in a floating bar
 * above the element instead, so the tools never move.
 *
 * Fixed height, Milanote-style: a Trash button is always pinned at the
 * bottom; as the window gets shorter, tool buttons collapse one at a time
 * (from the end of the list) into a "…" button instead of the rail scrolling
 * or growing past the available space.
 *
 * Hidden below `md`, where the FAB and bottom sheet take over: a 64px column
 * is a fifth of a phone screen, and popovers anchored to its right edge run
 * straight off the viewport.
 */
export function CanvasRail({
  editor,
  canComment = false,
  trashOpen = false,
  onToggleTrash,
}: {
  editor: BoardEditor;
  /** COMMENT-role viewers can't edit the board (editor.isReadonly() is true
   *  for them) but still need a way to drop a comment pin — a stripped rail
   *  with just Wählen/Kommentar covers that instead of hiding the rail
   *  outright the way plain VIEW-role readonly does. */
  canComment?: boolean;
  trashOpen?: boolean;
  onToggleTrash?: () => void;
}) {
  useEditorTick(editor);
  const actions = useCanvasActions();
  const [popover, setPopover] = useState<"shape" | "draw" | "overflow" | null>(null);
  const railRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setPopover(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [popover]);

  // Screen-height driven, matching how the user described the behaviour
  // ("wenn die Bildschirmhöhe zu klein wird") rather than tracking the
  // rail's own box, which would be circular (its height is what we're
  // computing).
  const [windowH, setWindowH] = useState(0);
  useEffect(() => {
    const apply = () => setWindowH(window.innerHeight);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const readonly = editor.isReadonly();
  if (readonly && !canComment) return null;
  const active = editor.getTool();
  const tools = readonly ? TOOLS.filter((tool) => tool.id === "select" || tool.id === "comment") : TOOLS;
  const showTrash = !readonly && !!onToggleTrash;

  const railH = windowH > 0 ? Math.max(MIN_RAIL_H, windowH - CHROME_CLEARANCE) : MIN_RAIL_H;
  const trashBudget = showTrash ? BUTTON_H + GAP : 0;
  const budget = railH - PADDING - trashBudget;

  let visible = tools;
  let overflowed: ToolSpec[] = [];
  if (toolsHeight(tools.length) > budget) {
    const budgetWithEllipsis = budget - BUTTON_H - GAP;
    let k = tools.length - 1;
    while (k > 1 && toolsHeight(k) > budgetWithEllipsis) k--;
    visible = tools.slice(0, k);
    overflowed = tools.slice(k);
  }

  const runToolClick = (tool: ToolSpec) => {
    if (tool.popover) {
      editor.setTool(tool.id);
      setPopover((open) => (open === tool.popover ? null : tool.popover!));
      return;
    }
    setPopover(null);
    runTool(editor, actions, tool.id);
  };

  return (
    <aside
      ref={railRef}
      style={{ height: `${railH}px` }}
      className="vos-panel pointer-events-auto absolute left-2.5 top-1/2 z-[280] hidden w-16 -translate-y-1/2 flex-col items-center gap-0.5 rounded-[15px] py-2.5 md:flex"
      aria-label="Werkzeuge"
    >
      {visible.map((tool) => (
        <div key={tool.id} className="relative shrink-0">
          <RailButton
            label={tool.label}
            active={active === tool.id}
            icon={<tool.icon size={22} />}
            dragToolId={tool.id}
            onClick={() => runToolClick(tool)}
          />
          {popover === "shape" && tool.popover === "shape" && <ShapePicker editor={editor} />}
          {popover === "draw" && tool.popover === "draw" && <DrawOptions editor={editor} />}
        </div>
      ))}

      {overflowed.length > 0 && (
        <div className="relative shrink-0">
          <RailButton
            label="Mehr"
            active={popover === "overflow"}
            icon={<KebabIcon size={22} />}
            onClick={() => setPopover((open) => (open === "overflow" ? null : "overflow"))}
          />
          {popover === "overflow" && (
            <OverflowMenu tools={overflowed} active={active} onPick={runToolClick} />
          )}
        </div>
      )}

      {showTrash && (
        <div className="mt-auto shrink-0">
          <RailButton
            label="Papierkorb"
            active={trashOpen}
            icon={<TrashIcon size={22} />}
            onClick={() => onToggleTrash?.()}
          />
        </div>
      )}
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
    case "comment": return actions.promptComment(at);
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

/** Grid of the tools that didn't fit in the fixed-height rail — same visual
 *  language as the reference app's own overflow menu, anchored to the bottom
 *  so it opens upward from the "…" button near the foot of the rail instead
 *  of running off the bottom of the screen. */
function OverflowMenu({
  tools,
  active,
  onPick,
}: {
  tools: ToolSpec[];
  active: ToolId;
  onPick: (tool: ToolSpec) => void;
}) {
  return (
    <div
      className={`${POPOVER} top-auto bottom-0 grid w-[190px] grid-cols-3 gap-1`}
      role="group"
      aria-label="Weitere Werkzeuge"
    >
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onPick(tool)}
          title={tool.label}
          aria-pressed={active === tool.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, tool.id);
            e.dataTransfer.effectAllowed = "copy";
          }}
          className={`flex h-[54px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${
            active === tool.id
              ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
              : "text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
          }`}
        >
          <tool.icon size={20} />
          <span className="leading-none">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}

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
