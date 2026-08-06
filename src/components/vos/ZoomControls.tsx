"use client";

import type { BoardEditor } from "@/canvas/editor";
import { PlusIcon, MinusIcon, FitIcon } from "@/components/icons/VosIcons";
import { useEditorTick } from "@/components/canvas/useEditorTick";

// Zoom pill. Solid rather than glass so the percentage stays readable over
// busy boards. Bottom-left, leaving the bottom-right corner to the mobile FAB.
export function ZoomControls({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);

  return (
    <div className="vos-panel-shadow absolute bottom-3.5 left-3.5 z-[290] flex h-[38px] items-center gap-0.5 rounded-[10px] border border-[var(--vos-border)] bg-[var(--vos-panel-solid)] p-[3px]">
      <ZoomBtn label="Verkleinern" onClick={() => editor.zoomOut()}>
        <MinusIcon size={18} />
      </ZoomBtn>
      <button
        type="button"
        title="Zoom zurücksetzen"
        onClick={() => editor.resetZoom()}
        className="h-8 min-w-[54px] rounded-lg px-1 text-xs font-medium tabular-nums text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
      >
        {Math.round(editor.getCamera().z * 100)}%
      </button>
      <ZoomBtn label="Vergrößern" onClick={() => editor.zoomIn()}>
        <PlusIcon size={18} />
      </ZoomBtn>
      <ZoomBtn label="Einpassen" onClick={() => editor.zoomToFit()}>
        <FitIcon size={18} />
      </ZoomBtn>
    </div>
  );
}

function ZoomBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
    >
      {children}
    </button>
  );
}
