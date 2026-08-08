import Image from "next/image";

// The Vellum brand mark — the real logo artwork (public/brand/), not a
// redrawn approximation. Light mode: black circle, white glyph
// (circle-light.png). Dark mode: the inverse (circle-dark.png, produced by
// inverting the source pixels directly, then clipping to the artwork's own
// measured circle radius to drop the opaque white margin the source PNG
// carries around it). Both render at once; globals.css's .vellum-mark-light/
// .vellum-mark-dark rules (keyed off the same data-theme attribute every
// other token here uses) toggle which is visible, since Tailwind's dark:
// variant tracks prefers-color-scheme, not our stamped attribute.
export function VellumMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const style = { width: size, height: size };
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={style}>
      <Image
        src="/brand/circle-light.png"
        alt=""
        width={size}
        height={size}
        className="vellum-mark-light absolute inset-0 h-full w-full"
        unoptimized
      />
      <Image
        src="/brand/circle-dark.png"
        alt=""
        width={size}
        height={size}
        className="vellum-mark-dark absolute inset-0 h-full w-full"
        unoptimized
      />
    </span>
  );
}
