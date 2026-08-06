import Link from "next/link";
import { ChevronDownIcon } from "@/components/icons/VosIcons";

// The floating glass topbar. Geometry (52px tall, 16px radius, inset 10/8,
// 14px left / 6px right padding) matches what the visualos.app chrome
// measures at in the browser; the markup and styling are our own.
export function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="vos-panel vos-panel-shadow absolute left-2.5 right-2.5 top-2 z-[300] flex h-[52px] items-center gap-0.5 rounded-2xl pl-3.5 pr-1.5">
      {children}
    </header>
  );
}

// Workspace chip: a coloured dot plus a chevron, standing in for the whole
// "which workspace am I in" switcher. Links home rather than opening a menu —
// we only have one workspace per user.
export function WorkspaceCrumb({ label }: { label: string }) {
  return (
    <Link
      href="/"
      title={label}
      className="flex items-center gap-1 rounded-[7px] px-1 py-1 text-[var(--vos-muted)] hover:bg-[var(--vos-hover-soft)] hover:text-[var(--vos-text-strong)]"
    >
      <span className="h-[9px] w-[9px] rounded-full bg-[rgb(96,97,104)]" />
      <ChevronDownIcon size={14} />
    </Link>
  );
}

export function CrumbDivider() {
  return <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--vos-border)]" />;
}

export function Crumb({ label, href }: { label: string; href?: string }) {
  const className =
    "truncate text-[15px] font-medium tracking-[-0.2px] text-[var(--vos-text)]";
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={`${className} hover:text-[var(--vos-text-strong)]`}>
      {label}
    </Link>
  );
}

export function CrumbSeparator() {
  return <span className="mx-1 text-[var(--vos-faint)]">/</span>;
}

export function TopBarSpacer() {
  return <div className="min-w-2 flex-1" />;
}
