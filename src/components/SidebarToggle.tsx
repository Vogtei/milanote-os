"use client";

// Lives in the app header (server component) while Sidebar.tsx (a separate
// client component elsewhere in the tree) owns the actual open/closed
// state — see the matching listener in Sidebar.tsx for why this uses a
// window event instead of props.
export function SidebarToggle() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
      aria-label="Menü öffnen"
      className="-ml-1 mr-auto text-lg text-zinc-500 hover:text-zinc-900 md:hidden dark:hover:text-zinc-100"
    >
      ☰
    </button>
  );
}
