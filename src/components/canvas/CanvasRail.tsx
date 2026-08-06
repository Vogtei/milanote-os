"use client";

import type { BoardEditor, ToolId } from "@/canvas/editor";
import { DRAG_MIME, TOOLS } from "@/components/canvas/tools";
import { useCanvasActions } from "@/components/canvas/CanvasActions";
import { useEditorTick } from "@/components/canvas/useEditorTick";

/**
 * Desktop tool rail. Hidden below `md`, where the FAB and bottom sheet take
 * over — a 64px column is a fifth of a phone screen and popovers anchored to
 * its right edge run straight off the viewport.
 */
export function CanvasRail({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const actions = useCanvasActions();

  // ContextPanel takes this exact slot while something is selected. Both are
  // absolutely positioned at the same spot, so exactly one of them may render.
  if (editor.isReadonly() || editor.getSelection().size > 0) return null;
  const active = editor.getTool();

  return (
    <aside
      className="vos-panel pointer-events-auto absolute left-2.5 top-1/2 z-[280] hidden w-16 -translate-y-1/2 flex-col items-center gap-0.5 overflow-y-auto rounded-[15px] py-2.5 md:flex"
      style={{ maxHeight: "calc(100% - 130px)" }}
      aria-label="Werkzeuge"
    >
      {TOOLS.map((tool) => (
        <RailButton
          key={tool.id}
          label={tool.label}
          active={active === tool.id}
          icon={<tool.icon size={22} />}
          dragToolId={tool.id}
          onClick={() => runTool(editor, actions, tool.id)}
        />
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
) {
  switch (id) {
    case "link": return actions.promptLink(at);
    case "board": return actions.promptBoard(at);
    case "image": return actions.pickImage(at);
    case "file": return actions.pickFile(at);
    default:
      // Placement tools arm themselves; if a drop point is known, place the
      // item there immediately instead of making the user click twice.
      if (at && (id === "note" || id === "text" || id === "todo")) {
        const item = editor.createItem(id, at);
        editor.setSelection([item.id]);
        if (id !== "todo") editor.setEditing(item.id);
        return;
      }
      editor.setTool(id);
  }
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
