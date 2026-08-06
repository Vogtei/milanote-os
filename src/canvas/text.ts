// Word wrapping is the single most expensive thing the renderer does — every
// measureText call forces a text-shaping pass — so results are memoised on the
// exact inputs that determine them. The cache is bounded because board text
// changes on every keystroke while editing.

const cache = new Map<string, string[]>();
const CACHE_LIMIT = 2000;

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string[] {
  const key = `${font}|${Math.round(maxWidth)}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  ctx.font = font;
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const candidate = line + word;
      if (line !== "" && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line.trimEnd());
  }

  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, lines);
  return lines;
}

/** Single line, truncated with an ellipsis — for titles and filenames. */
export function ellipsize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${text.slice(0, low)}…`;
}

export const FONT_STACK =
  'var(--font-inter), -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** The renderer can't resolve CSS custom properties, so it needs a literal
 *  family list. Resolved once from the document at startup. */
let resolvedFamily = 'Inter, -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function setFontFamily(family: string) {
  if (family) resolvedFamily = family;
}

export function font(size: number, weight: number | string = 400): string {
  return `${weight} ${size}px ${resolvedFamily}`;
}
