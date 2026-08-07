"use client";

import { useEffect, useRef } from "react";

/** Closes on the first pointerdown outside the ref'd element. The ref must
 *  wrap BOTH the trigger button and the popover together, not the popover
 *  alone — otherwise a second click on the trigger races its own toggle
 *  against this close, since pointerdown (which this listens for) fires
 *  before the button's click event. */
export function useClickAway(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, onClose]);
  return ref;
}
