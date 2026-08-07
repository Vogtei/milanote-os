// Rich text for notes. The document only ever stores this structured model —
// never raw HTML — so painting it is just data, and there's no path where an
// untrusted board could get arbitrary HTML executed in a viewer's session.
// contentEditable is the one place HTML exists at all, and it only ever sees
// HTML *serialized from this model*, never a stored string taken on trust.

import type { TextBlock, TextRun } from "@/canvas/types";

export type { TextBlock, TextRun };

export function emptyBlocks(): TextBlock[] {
  return [{ kind: "paragraph", align: "left", runs: [{ text: "" }] }];
}

export function plainTextBlocks(text: string): TextBlock[] {
  const lines = text.split("\n");
  return lines.map((line) => ({ kind: "paragraph" as const, align: "left" as const, runs: [{ text: line }] }));
}

export function blocksToPlainText(blocks: TextBlock[]): string {
  return blocks.map((b) => b.runs.map((r) => r.text).join("")).join("\n");
}

export function isBlocksEmpty(blocks: TextBlock[]): boolean {
  return blocks.every((b) => b.runs.every((r) => r.text === ""));
}

const TAG_BY_KIND: Record<TextBlock["kind"], "div" | "li"> = {
  paragraph: "div",
  bullet: "li",
  numbered: "li",
};

/** Structured model → HTML, for seeding the contentEditable surface. The
 *  only place in this module that produces markup — every value written into
 *  it comes from this same file's own types, so there's nothing to escape
 *  beyond the text content itself. */
export function blocksToHtml(blocks: TextBlock[]): string {
  const parts: string[] = [];
  let listOpen: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listOpen) parts.push(`</${listOpen}>`);
    listOpen = null;
  };

  for (const block of blocks) {
    const wantList = block.kind === "bullet" ? "ul" : block.kind === "numbered" ? "ol" : null;
    if (wantList !== listOpen) {
      closeList();
      if (wantList) {
        parts.push(`<${wantList}>`);
        listOpen = wantList;
      }
    }
    const tag = TAG_BY_KIND[block.kind];
    const style = block.align !== "left" ? ` style="text-align:${block.align}"` : "";
    const inner = block.runs.map(runToHtml).join("") || "<br>";
    parts.push(`<${tag}${style}>${inner}</${tag}>`);
  }
  closeList();
  return parts.join("");
}

function runToHtml(run: TextRun): string {
  let html = escapeHtml(run.text).replace(/ {2}/g, " &nbsp;");
  if (run.underline) html = `<u>${html}</u>`;
  if (run.italic) html = `<i>${html}</i>`;
  if (run.bold) html = `<b>${html}</b>`;
  const styles: string[] = [];
  if (run.color) styles.push(`color:${run.color}`);
  if (run.size) styles.push(`font-size:${run.size}px`);
  if (styles.length) html = `<span style="${styles.join(";")}">${html}</span>`;
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * HTML → structured model. This is the sanitizer: only text and the specific
 * tags/style properties below are ever read out of the DOM tree — an
 * `<img>`, a `<script>`, an `onerror` attribute, a pasted `<a>` with a
 * `javascript:` href, none of it has any representation in `TextBlock`, so
 * none of it survives the round trip regardless of what a paste or a
 * maliciously-edited stored document contained.
 */
const BLOCK_TAGS = new Set(["div", "p", "li"]);

/**
 * Recursively finds every "leaf" block — an element with block-level
 * children of its own is just a wrapper (Chromium's `insertUnorderedList`
 * wraps the new `<ul>` inside the current `<div>` rather than replacing it,
 * for instance) and gets descended into rather than treated as content.
 * This is what makes the parser robust to the exact DOM shape a given
 * browser's `execCommand` happens to produce, instead of matching one.
 */
export function parseHtmlToBlocks(html: string): TextBlock[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  const blocks: TextBlock[] = [];

  const hasBlockChild = (el: Element) =>
    Array.from(el.children).some((c) => {
      const tag = c.tagName.toLowerCase();
      return BLOCK_TAGS.has(tag) || tag === "ul" || tag === "ol";
    });

  const listKindOf = (el: Element): TextBlock["kind"] | null => {
    let node = el.parentElement;
    while (node && node !== container) {
      const tag = node.tagName.toLowerCase();
      if (tag === "ul") return "bullet";
      if (tag === "ol") return "numbered";
      node = node.parentElement;
    }
    return null;
  };

  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        walk(child);
        continue;
      }
      if (!BLOCK_TAGS.has(tag)) continue;
      if (hasBlockChild(child)) {
        walk(child);
        continue;
      }
      const kind = tag === "li" ? (listKindOf(child) ?? "paragraph") : "paragraph";
      const runs = flattenRuns(child);
      blocks.push({ kind, align: readAlign(child), runs: runs.length ? runs : [{ text: "" }] });
    }
  };

  walk(container);

  // A single-line edit often leaves its content with no block wrapper at
  // all — if nothing block-level turned up, the whole container is one
  // paragraph.
  if (blocks.length === 0) {
    const runs = flattenRuns(container);
    blocks.push({ kind: "paragraph", align: "left", runs: runs.length ? runs : [{ text: "" }] });
  }

  return blocks;
}

function readAlign(el: Element): TextBlock["align"] {
  const style = (el as HTMLElement).style?.textAlign;
  if (style === "center" || style === "right") return style;
  return "left";
}

/** Inline formatting state accumulates down the tree, so nested `<b><i>` (or
 *  a `<span style>` around either) merges correctly instead of only the
 *  innermost tag's formatting surviving. */
function flattenRuns(root: Node, inherited: Omit<TextRun, "text"> = {}): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) runs.push({ text, ...inherited });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      runs.push({ text: "\n", ...inherited });
      continue;
    }
    const next: Omit<TextRun, "text"> = { ...inherited };
    if (tag === "b" || tag === "strong" || el.style.fontWeight === "bold" || Number(el.style.fontWeight) >= 600) {
      next.bold = true;
    }
    if (tag === "i" || tag === "em") next.italic = true;
    if (tag === "u") next.underline = true;
    // execCommand('foreColor') produces <font color="..."> in Chromium, not
    // an inline style — the attribute has no representation in `.style` at
    // all, so it needs its own read alongside the CSS case.
    const fontColorAttr = tag === "font" ? el.getAttribute("color") : null;
    if (el.style.color) next.color = normalizeColor(el.style.color);
    else if (fontColorAttr) next.color = normalizeColor(fontColorAttr);
    if (el.style.fontSize) {
      const px = parseFloat(el.style.fontSize);
      if (Number.isFinite(px)) next.size = px;
    }
    runs.push(...flattenRuns(el, next));
  }
  return runs;
}

/** The DOM reports colours as `rgb(r, g, b)`; stored/painted values use hex
 *  so the renderer's own colour handling doesn't need two formats. */
function normalizeColor(value: string): string {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return value;
  const [, r, g, b] = match;
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
}
