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
      className="-ml-1 mr-auto text-lg text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)] md:hidden"
    >
      ☰
    </button>
  );
}
