"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BoardEditor, ToolId } from "@/canvas/editor";
import { render } from "@/canvas/renderer";
import { PALETTES } from "@/canvas/theme";
import { setFontFamily } from "@/canvas/text";
import { useTheme } from "@/components/ThemeProvider";
import { TextOverlay } from "@/components/canvas/TextOverlay";

const CURSORS: Partial<Record<ToolId, string>> = {
  hand: "grab",
  draw: "crosshair",
  arrow: "crosshair",
  shape: "crosshair",
  note: "copy",
  text: "text",
  todo: "copy",
};

/**
 * The React shell around the editor: owns the <canvas> element, keeps it sized
 * and device-pixel sharp, forwards input, and repaints on every editor change.
 *
 * All board logic lives in BoardEditor — this component is deliberately thin
 * so the interaction model isn't tangled up with React's render cycle.
 */
export function VosCanvas({ editor }: { editor: BoardEditor }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const { theme } = useTheme();
  const [, forceRender] = useState(0);

  // Resolve the actual font stack once so the canvas can use it — a 2D context
  // can't resolve `var(--font-inter)`.
  useEffect(() => {
    const container = containerRef.current;
    if (container) setFontFamily(getComputedStyle(container).fontFamily);
  }, []);

  // Repaint loop. Every editor change schedules at most one frame, so a drag
  // that fires 120 pointermove events still paints once per refresh.
  useEffect(() => {
    const paint = () => {
      frameRef.current = null;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const size = editor.getSize();
      render(ctx, {
        camera: editor.getCamera(),
        size,
        items: editor.store.getItems(),
        selected: editor.getSelection(),
        hovered: editor.getHovered(),
        editingId: editor.getEditingId(),
        marquee: editor.getMarquee(),
        palette: PALETTES[theme],
        showGrid: true,
        invalidate: schedule,
      });
    };

    const schedule = () => {
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(paint);
    };

    schedule();
    const unsubscribe = editor.subscribe((event) => {
      schedule();
      // Selection/tool changes drive the surrounding chrome too, which is
      // React state — re-render the tree, not just the bitmap.
      if (event.type === "change") forceRender((n) => n + 1);
    });
    return () => {
      unsubscribe();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [editor, theme]);

  // Size the backing store to the device pixel ratio so text and hairlines
  // aren't blurry on retina displays.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const apply = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      editor.setSize({ w: rect.width, h: rect.height });
      forceRender((n) => n + 1);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(container);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [editor]);

  // Pointer input. Listeners are native rather than React props so wheel can be
  // registered non-passive (needed to preventDefault browser zoom) and pointer
  // capture keeps a drag alive when the cursor leaves the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocal = (e: PointerEvent | WheelEvent | MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      canvas.setPointerCapture(e.pointerId);
      editor.onPointerDown(toLocal(e), {
        shift: e.shiftKey,
        middle: e.button === 1,
        alt: e.altKey,
      });
    };
    const onPointerMove = (e: PointerEvent) => editor.onPointerMove(toLocal(e));
    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      editor.onPointerUp();
    };
    const onDoubleClick = (e: MouseEvent) => editor.onDoubleClick(toLocal(e));
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      editor.onWheel(toLocal(e), { x: e.deltaX, y: e.deltaY }, e.ctrlKey || e.metaKey);
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [editor]);

  // Keyboard. Skipped entirely while focus is in a field so board shortcuts
  // can't fire from inside the text editor or a topbar input.
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " && !isTyping()) {
        editor.setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (isTyping()) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        editor.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        editor.duplicateSelection();
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        editor.deleteSelection();
        return;
      }
      if (e.key === "Escape") {
        editor.setEditing(null);
        editor.setSelection([]);
        editor.setTool("select");
        return;
      }
      const shortcuts: Record<string, ToolId> = {
        v: "select",
        h: "hand",
        n: "note",
        t: "text",
        r: "shape",
        d: "draw",
        a: "arrow",
      };
      const tool = shortcuts[e.key.toLowerCase()];
      if (tool && !mod) editor.setTool(tool);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") editor.setSpaceDown(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [editor]);

  const cursor = CURSORS[editor.getTool()] ?? "default";

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block touch-none" style={{ cursor }} />
      <TextOverlay editor={editor} />
    </div>
  );
}
