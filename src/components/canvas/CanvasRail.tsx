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
/** The pinned Trash block sits apart from the rest of the rail — a hairline
 *  divider plus roughly double the normal gap, not just another button in
 *  the same list. Matches the block's own pt-2 + divider + gap-2 below. */
const TRASH_BLOCK_GAP = 17;

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
/** Drag-only tools: no native draggable, no click-to-arm — a custom
 *  pointer-driven drag (see BoardShell's startToolDrag) is the only way to
 *  create them, with its own live-following ghost instead of the browser's
 *  static drag snapshot. Select, arrow and link are exempt: arrow has to be
 *  armed by a click so a drag *on the canvas* can draw it, link opens a URL
 *  prompt instead of dropping a premade card, and select isn't a placement
 *  tool. Popover tools (shape/draw) are exempt too — their individual
 *  glyphs keep native drag (see ShapePicker). In practice this only ever
 *  runs on the drag group below (CLICK_GROUP_IDS tools are rendered
 *  separately and never call it), but the guard clauses stay accurate. */
function isDragOnly(tool: ToolSpec): boolean {
  return !tool.popover && tool.id !== "select" && tool.id !== "arrow" && tool.id !== "link";
}

/** Tools that act on click instead of being dragged onto the board — shape
 *  and draw open a configuration popover, arrow arms itself for a drag *on
 *  the canvas*, and link opens a URL prompt. Milanote pins these together
 *  in their own block above the trash button, visually distinct from the
 *  drag group above, with no drag-affordance hover/press animation since
 *  they were never meant to be dragged in the first place. */
const CLICK_GROUP_ORDER: ToolId[] = ["shape", "draw", "arrow", "link"];

export function CanvasRail({
  editor,
  canComment = false,
  trashOpen = false,
  onToggleTrash,
  onToolDragStart,
}: {
  editor: BoardEditor;
  /** COMMENT-role viewers can't edit the board (editor.isReadonly() is true
   *  for them) but still need a way to drop a comment pin — a stripped rail
   *  with just Wählen/Kommentar covers that instead of hiding the rail
   *  outright the way plain VIEW-role readonly does. */
  canComment?: boolean;
  trashOpen?: boolean;
  onToggleTrash?: () => void;
  onToolDragStart?: (tool: ToolSpec, e: React.PointerEvent) => void;
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

  // The click group (shape/draw/arrow/link) never appears for a readonly
  // rail — none of those ids survive the `tools` filter above — so it's
  // naturally empty there without special-casing readonly again here.
  const clickTools = CLICK_GROUP_ORDER.map((id) => tools.find((t) => t.id === id)).filter(
    (t): t is ToolSpec => !!t,
  );
  const topTools = tools.filter((t) => !CLICK_GROUP_ORDER.includes(t.id));

  const railH = windowH > 0 ? Math.max(MIN_RAIL_H, windowH - CHROME_CLEARANCE) : MIN_RAIL_H;
  const clickBudget = clickTools.length > 0 ? TRASH_BLOCK_GAP + toolsHeight(clickTools.length) : 0;
  const trashBudget = showTrash ? TRASH_BLOCK_GAP + BUTTON_H : 0;
  const budget = railH - PADDING - clickBudget - trashBudget;

  let visible = topTools;
  let overflowed: ToolSpec[] = [];
  if (toolsHeight(topTools.length) > budget) {
    const budgetWithEllipsis = budget - BUTTON_H - GAP;
    let k = topTools.length - 1;
    while (k > 1 && toolsHeight(k) > budgetWithEllipsis) k--;
    visible = topTools.slice(0, k);
    overflowed = topTools.slice(k);
  }

  const runToolClick = (tool: ToolSpec) => {
    if (tool.popover) {
      editor.setTool(tool.id);
      setPopover((open) => (open === tool.popover ? null : tool.popover!));
      return;
    }
    setPopover(null);
    // The drag group creates its item by being dragged onto the board, not
    // by being clicked — a click here would otherwise create or open
    // something at the viewport centre with no further gesture, which is
    // exactly what this guards against. Select, arrow and link are the
    // exceptions: arrow has to be armed so a drag *on the canvas* can draw
    // it, link opens a URL prompt instead of dropping a premade card, and
    // select isn't a placement tool at all — all three (plus shape/draw,
    // handled above) belong to the click group, never the drag group.
    if (tool.id !== "select" && tool.id !== "arrow" && tool.id !== "link") return;
    runTool(editor, actions, tool.id);
  };

  return (
    <aside
      ref={railRef}
      // A hard height would force the rail to stretch and fill the whole
      // budget even when its content is shorter — the visible gap this was
      // reported against, between the drag group and the pinned block below
      // it. maxHeight keeps the same collapse-into-"…" ceiling (the visible/
      // overflowed split above already guarantees content never exceeds
      // `railH`) while letting the rail shrink to its natural content height
      // whenever there's slack.
      style={{ maxHeight: `${railH}px` }}
      className="vos-panel pointer-events-auto absolute left-2.5 top-1/2 z-[280] hidden w-16 -translate-y-1/2 flex-col items-center gap-0.5 rounded-[15px] py-2.5 md:flex"
      aria-label="Werkzeuge"
    >
      {visible.map((tool) => (
        <div key={tool.id} className="relative shrink-0">
          <RailButton
            label={tool.label}
            active={active === tool.id}
            icon={<tool.icon size={22} />}
            dragToolId={isDragOnly(tool) ? undefined : tool.id}
            onPointerDown={isDragOnly(tool) ? (e) => onToolDragStart?.(tool, e) : undefined}
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
            <OverflowMenu
              tools={overflowed}
              active={active}
              onPick={runToolClick}
              onToolDragStart={onToolDragStart}
            />
          )}
        </div>
      )}

      {(clickTools.length > 0 || showTrash) && (
        <div className="mt-auto flex w-full shrink-0 flex-col items-center gap-0.5">
          {clickTools.length > 0 && (
            <div className="flex w-full shrink-0 flex-col items-center gap-0.5 pt-2">
              <span className="mb-1.5 h-px w-8 shrink-0 bg-[var(--vos-border)] opacity-60" />
              {clickTools.map((tool) => (
                <div key={tool.id} className="relative shrink-0">
                  <RailButton
                    label={tool.label}
                    active={active === tool.id}
                    icon={<tool.icon size={22} />}
                    onClick={() => runToolClick(tool)}
                  />
                  {popover === "shape" && tool.popover === "shape" && <ShapePicker editor={editor} />}
                  {popover === "draw" && tool.popover === "draw" && <DrawOptions editor={editor} />}
                </div>
              ))}
            </div>
          )}

          {showTrash && (
            <div className="flex w-full shrink-0 flex-col items-center gap-2 pt-2">
              <span className="h-px w-8 shrink-0 bg-[var(--vos-border)] opacity-60" />
              <RailButton
                label="Papierkorb"
                active={trashOpen}
                icon={<TrashIcon size={22} />}
                onClick={() => onToggleTrash?.()}
              />
            </div>
          )}
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

/** Own positioning, deliberately not built on POPOVER — mixing its `top-0`
 *  with a `bottom-0` override in one className string left both rules in the
 *  compiled stylesheet (Tailwind classes don't cancel each other out by
 *  string order), which is what made this render squashed against the "…"
 *  trigger instead of as a proper flyout. Anchored to the bottom so it opens
 *  upward from the "…" button near the foot of the rail. */
const OVERFLOW_POPOVER =
  "vos-panel vos-panel-shadow absolute left-[60px] bottom-0 z-[400] rounded-2xl p-2.5";

/** Grid of the tools that didn't fit in the fixed-height rail. Each icon
 *  sits in its own soft chip, labelled below — same visual language as the
 *  reference app's own overflow menu. */
function OverflowMenu({
  tools,
  active,
  onPick,
  onToolDragStart,
}: {
  tools: ToolSpec[];
  active: ToolId;
  onPick: (tool: ToolSpec) => void;
  onToolDragStart?: (tool: ToolSpec, e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={`${OVERFLOW_POPOVER} grid w-[192px] grid-cols-3 gap-2`}
      role="group"
      aria-label="Weitere Werkzeuge"
    >
      {tools.map((tool) => {
        const dragOnly = isDragOnly(tool);
        return (
        <button
          key={tool.id}
          onClick={() => onPick(tool)}
          title={tool.label}
          aria-pressed={active === tool.id}
          draggable={!dragOnly}
          onPointerDown={dragOnly ? (e) => onToolDragStart?.(tool, e) : undefined}
          onDragStart={
            dragOnly
              ? undefined
              : (e) => {
                  e.dataTransfer.setData(DRAG_MIME, tool.id);
                  e.dataTransfer.effectAllowed = "copy";
                }
          }
          className="flex flex-col items-center gap-1.5 rounded-lg text-[10px] font-medium text-[var(--vos-muted)] transition-colors hover:text-[var(--vos-text-strong)]"
        >
          <span
            className={`grid h-11 w-11 place-items-center rounded-xl transition-colors ${
              active === tool.id
                ? "bg-[var(--vos-hover)] text-[var(--vos-text-strong)]"
                : "bg-[var(--vos-hover-soft)]"
            }`}
          >
            <tool.icon size={20} />
          </span>
          <span className="leading-none">{tool.label}</span>
        </button>
        );
      })}
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
  onPointerDown,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  dragToolId?: string;
  /** Custom pointer-driven drag (see BoardShell's startToolDrag) — mutually
   *  exclusive with dragToolId's native HTML5 drag. */
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
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
      className={`flex h-[50px] w-[52px] shrink-0 flex-col items-center gap-[3px] rounded-[10px] border-0 pb-1.5 pt-2 text-[10px] font-medium transition-[background-color,color] duration-150 ${
        dragToolId || onPointerDown
          ? "cursor-grab active:cursor-grabbing transition-[background-color,color,transform] duration-[220ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:translate-x-[3px] active:translate-x-[8px] active:duration-[120ms] active:ease-[cubic-bezier(0.4,0,0.2,1)]"
          : "cursor-pointer"
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
