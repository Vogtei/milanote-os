import type { TextBlock, TextRun } from "@/canvas/types";
import { font } from "@/canvas/text";

// Word-wrapping a single styled string (text.ts's wrapText) doesn't cover
// this: a line here can be made of several runs with different weights,
// styles, sizes and colours, so wrapping has to happen across run
// boundaries, and painting has to walk segment-by-segment instead of one
// fillText call per line.

type Segment = { text: string; run: TextRun; width: number };
type Line = { segments: Segment[]; width: number; height: number };

const BULLET_GAP = 18;
const NUMBER_GAP = 22;
const LINE_HEIGHT_RATIO = 1.35;

function runFont(run: TextRun, baseSize: number): string {
  return font(run.size ?? baseSize, run.bold ? 700 : 400, !!run.italic);
}

/** Splits a block's runs into words while preserving each word's run
 *  formatting — the unit `layoutLines` wraps on. */
function wordsOf(runs: TextRun[]): { text: string; run: TextRun }[] {
  const words: { text: string; run: TextRun }[] = [];
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/)) {
      if (part !== "") words.push({ text: part, run });
    }
  }
  return words;
}

function layoutLines(ctx: CanvasRenderingContext2D, block: TextBlock, maxWidth: number, baseSize: number): Line[] {
  const lines: Line[] = [];
  let current: Segment[] = [];
  let currentWidth = 0;
  let lineHeight = baseSize * LINE_HEIGHT_RATIO;

  const pushLine = () => {
    lines.push({ segments: current, width: currentWidth, height: lineHeight });
    current = [];
    currentWidth = 0;
    lineHeight = baseSize * LINE_HEIGHT_RATIO;
  };

  for (const word of wordsOf(block.runs)) {
    if (word.text === "\n") {
      pushLine();
      continue;
    }
    ctx.font = runFont(word.run, baseSize);
    const width = ctx.measureText(word.text).width;
    if (currentWidth + width > maxWidth && current.length > 0 && word.text.trim() !== "") {
      pushLine();
    }
    const last = current.at(-1);
    if (last && last.run === word.run) {
      last.text += word.text;
      last.width += width;
    } else {
      current.push({ text: word.text, run: word.run, width });
    }
    currentWidth += width;
    lineHeight = Math.max(lineHeight, (word.run.size ?? baseSize) * LINE_HEIGHT_RATIO);
  }
  pushLine();
  return lines;
}

export type PaintBlocksOptions = {
  baseSize: number;
  baseColor: string;
  maxY?: number;
};

/**
 * Paints `blocks` inside the box, wrapping across runs and honouring
 * per-run bold/italic/underline/colour/size, block alignment, and
 * bullet/numbered markers. Returns the total height consumed, so callers can
 * decide whether content overflowed its card.
 */
export function paintBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: TextBlock[],
  box: { x: number; y: number; w: number },
  opts: PaintBlocksOptions,
): number {
  ctx.textBaseline = "alphabetic";
  let y = box.y;
  let numberIndex = 0;

  for (const block of blocks) {
    numberIndex = block.kind === "numbered" ? numberIndex + 1 : 0;
    const prefixWidth = block.kind === "bullet" ? BULLET_GAP : block.kind === "numbered" ? NUMBER_GAP : 0;
    const lines = layoutLines(ctx, block, box.w - prefixWidth, opts.baseSize);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (opts.maxY !== undefined && y + line.height > opts.maxY) return y - box.y;

      let x = box.x + prefixWidth;
      if (block.align === "center") x = box.x + prefixWidth + (box.w - prefixWidth - line.width) / 2;
      else if (block.align === "right") x = box.x + box.w - line.width;

      const baseline = y + line.height * 0.78;

      if (i === 0 && block.kind !== "paragraph") {
        ctx.font = font(opts.baseSize, 400);
        ctx.fillStyle = opts.baseColor;
        const marker = block.kind === "bullet" ? "•" : `${numberIndex}.`;
        ctx.fillText(marker, box.x, baseline);
      }

      let sx = x;
      for (const seg of line.segments) {
        ctx.font = runFont(seg.run, opts.baseSize);
        ctx.fillStyle = seg.run.color ?? opts.baseColor;
        ctx.fillText(seg.text, sx, baseline);
        if (seg.run.underline) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx, baseline + 2);
          ctx.lineTo(sx + seg.width, baseline + 2);
          ctx.stroke();
        }
        sx += seg.width;
      }

      y += line.height;
    }
  }

  return y - box.y;
}

/** Total height `blocks` would need at `maxWidth` — used to grow a note's
 *  card to fit its content instead of clipping or leaving dead space. */
export function measureBlocksHeight(
  ctx: CanvasRenderingContext2D,
  blocks: TextBlock[],
  maxWidth: number,
  baseSize: number,
): number {
  let total = 0;
  for (const block of blocks) {
    const prefixWidth = block.kind === "bullet" ? BULLET_GAP : block.kind === "numbered" ? NUMBER_GAP : 0;
    const lines = layoutLines(ctx, block, maxWidth - prefixWidth, baseSize);
    for (const line of lines) total += line.height;
  }
  return total;
}

// A throwaway, never-painted canvas purely for ctx.measureText — DOM overlay
// components (NoteEditor) need to measure text but have no canvas of their
// own to borrow a context from the way the renderer does.
let measureCanvas: HTMLCanvasElement | null = null;

export function getMeasureContext(): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return ctx;
}
