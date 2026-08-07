"use client";

import type { BoardEditor } from "@/canvas/editor";
import { IconBtn } from "@/components/vos/IconBtn";
import { MinusIcon, PlusIcon, FitIcon } from "@/components/icons/VosIcons";
import { useEditorTick } from "@/components/canvas/useEditorTick";

// Docked bottom-right, matching Milanote's own zoom control — separate from
// the header entirely, always on screen rather than tucked behind a click.
export function ZoomPill({ editor }: { editor: BoardEditor }) {
  useEditorTick(editor);
  const pct = Math.round(editor.getCamera().z * 100);

  return (
    <div className="vos-panel vos-panel-shadow fixed bottom-3.5 right-3.5 z-[300] flex h-11 items-center gap-0.5 rounded-full px-1">
      <IconBtn label="Verkleinern" onClick={() => editor.zoomOut()}>
        <MinusIcon size={16} />
      </IconBtn>
      <span className="w-10 shrink-0 text-center text-[12px] font-medium tabular-nums text-[var(--vos-muted)]">
        {pct}%
      </span>
      <IconBtn label="Vergrößern" onClick={() => editor.zoomIn()}>
        <PlusIcon size={16} />
      </IconBtn>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--vos-border)]" />
      <IconBtn label="Auf Bildschirm einpassen" onClick={() => editor.zoomToFit()}>
        <FitIcon size={16} />
      </IconBtn>
    </div>
  );
}
