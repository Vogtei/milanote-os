import type { ShapeKind } from "@/canvas/types";

// Miniatures of the twelve canvas shapes, for the Formen picker. Drawn as SVG
// rather than reusing the canvas renderer because the picker is DOM — but the
// silhouettes are kept in step with shapePath() in renderer.ts on purpose.
const PATHS: Record<ShapeKind, React.ReactNode> = {
  rect: <rect x="4" y="6" width="16" height="12" />,
  roundRect: <rect x="4" y="6" width="16" height="12" rx="3.5" />,
  ellipse: <circle cx="12" cy="12" r="7" />,
  triangle: <path d="M12 5 19.5 18.5h-15Z" />,
  diamond: <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" />,
  bubble: <path d="M4.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-7l-3.5 3v-3h-.5a2 2 0 0 1-2-2Z" />,
  parallelogram: <path d="M8 6h12l-4 12H4Z" />,
  star: <path d="m12 4 2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.7 9.6 9Z" />,
  blockArrow: <path d="M4 9.5h8V6l6 6-6 6v-3.5H4Z" />,
  line: <path d="M5 18 19 6" />,
  doubleArrow: <path d="M4 12 8.5 7v3h7V7L20 12l-4.5 5v-3h-7v3Z" />,
  pentagon: <path d="m12 4 8 5.8-3 9.2H7l-3-9.2Z" />,
};

export function ShapeGlyph({ kind, size = 22 }: { kind: ShapeKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {PATHS[kind]}
    </svg>
  );
}
