// The Vellum brand mark — an "open folio" glyph (two page-like petals
// meeting at a point, reading as both an open notebook and a V) inside a
// squircle. Light mode: black glyph on a white squircle. Dark mode: the
// inverse. Both variants render at once; globals.css's .vellum-mark-light/
// .vellum-mark-dark rules (keyed off the same data-theme attribute every
// other token here uses) toggle which one is visible, since Tailwind's
// dark: variant tracks prefers-color-scheme, not our stamped attribute.
const GLYPH_PATH =
  "M50 79.5c-1 0-2-.35-2.8-1.05L16.9 51.9c-1.05-.9-1.65-2.2-1.65-3.6V23.6c0-3.55 4.15-5.5 6.9-3.25l24.5 20.1c1.1.9 1.85 2.2 2.05 3.6l1.3 9c.1.7 1.1.7 1.2 0l1.3-9c.2-1.4.95-2.7 2.05-3.6l24.5-20.1c2.75-2.25 6.9-.3 6.9 3.25v24.7c0 1.4-.6 2.7-1.65 3.6L52.8 78.45c-.8.7-1.8 1.05-2.8 1.05Z";

function VellumGlyph({ className, fill }: { className: string; fill: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="22" fill={fill === "#000000" ? "#ffffff" : "#000000"} />
      <path d={GLYPH_PATH} fill={fill} />
    </svg>
  );
}

export function VellumMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const style = { width: size, height: size };
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={style}>
      <VellumGlyph className="vellum-mark-light absolute inset-0 h-full w-full" fill="#000000" />
      <VellumGlyph className="vellum-mark-dark absolute inset-0 h-full w-full" fill="#ffffff" />
    </span>
  );
}
