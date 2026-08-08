import Link from "next/link";
import { VellumMark } from "@/components/VellumMark";

// The docked glass topbar. Flush with the viewport's top edge, full width —
// only the bottom corners round off. Geometry otherwise (52px tall, 14px
// left / 6px right padding) still matches what the visualos.app chrome
// measures at in the browser; the markup and styling are our own.
export function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="vos-panel vos-panel-shadow fixed left-0 right-0 top-0 z-[300] flex h-[52px] items-center gap-2 pl-3.5 pr-1.5">
      {children}
    </header>
  );
}

// Workspace chip: the Vellum mark + "Home" label, standing in for the whole
// "which workspace am I in" switcher — same logo+label pairing the per-board
// breadcrumb uses (BoardTopBar.tsx), so both headers read the same way.
// Links home rather than opening a menu — we only have one workspace per user.
export function WorkspaceCrumb({ label }: { label: string }) {
  return (
    <Link
      href="/"
      title={label}
      className="flex shrink-0 items-center gap-2 truncate rounded-[7px] px-1.5 py-1 text-[13px] text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
    >
      <VellumMark size={18} />
      Home
    </Link>
  );
}

export function CrumbDivider() {
  return <span className="h-4 w-px shrink-0 bg-[var(--vos-border)]" />;
}

export function Crumb({ label, href }: { label: string; href?: string }) {
  const className = "shrink-0 truncate rounded-[7px] px-1.5 py-1 text-[13px] text-[var(--vos-muted)]";
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={`${className} hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]`}>
      {label}
    </Link>
  );
}

export function TopBarSpacer() {
  return <div className="min-w-2 flex-1" />;
}
