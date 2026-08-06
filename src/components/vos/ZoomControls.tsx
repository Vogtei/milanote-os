"use client";

import { useValue } from "tldraw";
import type { Editor } from "tldraw";
import { PlusIcon, MinusIcon, FitIcon } from "@/components/icons/VosIcons";

// Zoom pill. Unlike the topbar this one is a solid panel (no backdrop blur)
// so the percentage stays readable over busy boards. Sits bottom-left rather
// than bottom-right: tldraw's own watermark is pinned to the bottom-right
// corner and we're not licensed to move or hide it.
export function ZoomControls({ editor }: { editor: Editor }) {
  const zoom = useValue("zoom", () => editor.getZoomLevel(), [editor]);

  return (
    <div className="vos-panel-shadow absolute bottom-3.5 left-3.5 z-[300] flex h-[38px] items-center gap-0.5 rounded-[10px] border border-[rgb(58,59,65)] bg-[rgb(35,36,40)] p-[3px]">
      <ZoomBtn label="Verkleinern" onClick={() => editor.zoomOut(undefined, { animation: { duration: 120 } })}>
        <MinusIcon size={18} />
      </ZoomBtn>
      <button
        type="button"
        title="Zoom zurücksetzen"
        onClick={() => editor.resetZoom(undefined, { animation: { duration: 120 } })}
        className="h-8 min-w-[54px] rounded-lg px-1 text-xs font-medium tabular-nums text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
      >
        {Math.round(zoom * 100)}%
      </button>
      <ZoomBtn label="Vergrößern" onClick={() => editor.zoomIn(undefined, { animation: { duration: 120 } })}>
        <PlusIcon size={18} />
      </ZoomBtn>
      <ZoomBtn label="Einpassen" onClick={() => editor.zoomToFit({ animation: { duration: 200 } })}>
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
      className="grid h-8 w-8 place-items-center rounded-lg text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
    >
      {children}
    </button>
  );
}
