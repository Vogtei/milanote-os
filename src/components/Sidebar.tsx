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
        className="pl-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
        className="w-full rounded border border-zinc-300 px-1.5 py-0.5 text-xs outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-50"
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
            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        <span className="shrink-0">🗒️</span>
        <span className="truncate">{node.title}</span>
        <button
          onClick={handleDelete}
          className="ml-auto hidden shrink-0 text-zinc-400 hover:text-red-600 group-hover:inline"
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
          className="fixed inset-0 z-[490] bg-black/30 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[495] flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 md:static md:z-auto md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-950 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <Link href="/" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            milanote-os
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="text-zinc-400 hover:text-zinc-900 md:hidden dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2">
          <ul>
            {roots === null && <li className="px-2 py-1 text-xs text-zinc-400">Lädt…</li>}
            {roots?.map((node) => (
              <NodeRow key={node.id} node={node} onChanged={reload} />
            ))}
          </ul>
          <div className="mt-1 px-2">
            <NewBoardForm onCreated={reload} />
          </div>
        </nav>
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <Link
            href="/trash"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            🗑️ Papierkorb
          </Link>
        </div>
      </aside>
    </>
  );
}
