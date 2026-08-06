"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createNode, deleteNode, listChildren } from "@/lib/nodes";
import { NodeType } from "@/generated/prisma/enums";

type Node = {
  id: string;
  title: string;
};

function NewBoardForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pl-1 text-xs text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)]"
      >
        + Board
      </button>
    );
  }

  return (
    <form
      className="flex gap-1 pl-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startTransition(async () => {
          await createNode(NodeType.BOARD, title, null);
          setTitle("");
          setOpen(false);
          onCreated();
        });
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && setOpen(false)}
        placeholder="Board-Name"
        className="w-full rounded border border-[rgb(58,59,65)] bg-[#17181c] px-1.5 py-0.5 text-xs text-[rgb(231,229,224)] outline-none focus:border-[rgb(156,153,143)]"
        disabled={isPending}
      />
    </form>
  );
}

function NodeRow({ node, onChanged }: { node: Node; onChanged: () => void }) {
  const pathname = usePathname();
  const active = pathname === `/board/${node.id}`;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${node.title}" löschen?`)) return;
    try {
      await deleteNode(node.id);
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <li>
      <Link
        href={`/board/${node.id}`}
        className={`group flex items-center gap-1.5 rounded px-1.5 py-1 text-sm ${
          active
            ? "bg-[rgba(255,255,255,0.118)] text-[rgb(244,243,239)]"
            : "text-[rgb(156,153,143)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgb(244,243,239)]"
        }`}
      >
        <span className="shrink-0">🗒️</span>
        <span className="truncate">{node.title}</span>
        <button
          onClick={handleDelete}
          className="ml-auto hidden shrink-0 text-[rgb(120,118,112)] hover:text-red-400 group-hover:inline"
          aria-label="Löschen"
        >
          ✕
        </button>
      </Link>
    </li>
  );
}

export function Sidebar() {
  const [roots, setRoots] = useState<Node[] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  async function reload() {
    const kids = await listChildren(null);
    setRoots(kids as Node[]);
  }

  useEffect(() => {
    void reload();
  }, []);

  // Below `md`, the sidebar is a slide-in drawer — close it whenever the
  // route changes (e.g. after picking a board) so it doesn't stay covering
  // the canvas.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // The toggle button lives in the app header (a server component), outside
  // this component's tree, so it can't reach this state via props/context.
  // A board page's own left rail also occupies the top-left corner, so the
  // toggle can't float there either without re-creating the exact overlap
  // bug this responsive pass is meant to fix — a small window event is the
  // simplest way to bridge the two without lifting state into the server
  // layout.
  useEffect(() => {
    const handler = () => setMobileOpen((v) => !v);
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[490] bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[495] flex h-full w-64 shrink-0 flex-col border-r border-[rgb(58,59,65)] bg-[#17181c] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <Link href="/" className="text-sm font-semibold text-[rgb(244,243,239)]">
            milanote-os
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)] md:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2">
          <ul>
            {roots === null && <li className="px-2 py-1 text-xs text-[rgb(120,118,112)]">Lädt…</li>}
            {roots?.map((node) => (
              <NodeRow key={node.id} node={node} onChanged={reload} />
            ))}
          </ul>
          <div className="mt-1 px-2">
            <NewBoardForm onCreated={reload} />
          </div>
        </nav>
        <div className="border-t border-[rgb(58,59,65)] px-3 py-2">
          <Link
            href="/trash"
            className="text-xs text-[rgb(156,153,143)] hover:text-[rgb(244,243,239)]"
          >
            🗑️ Papierkorb
          </Link>
        </div>
      </aside>
    </>
  );
}
